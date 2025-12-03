import { type NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import logger from "@/lib/logger"
import { SignJWT, importPKCS8 } from "jose"

// IMPORTANT: keep jose on Node runtime in Vercel
export const runtime = "nodejs"

function parseServiceAccount(raw?: string) {
  if (!raw) throw new Error("Missing GOOGLE_WALLET_SA_JSON")

  // Vercel envs often store JSON single-line with \\n escapes.
  // But sometimes people paste multi-line JSON. Normalize both.
  let normalized = raw.trim()

  // If it looks like JSON but has literal newlines in private_key, fix them.
  try {
    const obj = JSON.parse(normalized)
    if (obj?.private_key && typeof obj.private_key === "string") {
      obj.private_key = obj.private_key.replace(/\\n/g, "\n")
    }
    return obj
  } catch {
    // Fallback: try to replace literal newlines with escaped newlines, then parse.
    normalized = normalized.replace(/\n/g, "\\n")
    const obj = JSON.parse(normalized)
    if (obj?.private_key && typeof obj.private_key === "string") {
      obj.private_key = obj.private_key.replace(/\\n/g, "\n")
    }
    return obj
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const passId = searchParams.get("pass_id")
  const debugMode = searchParams.get("debug") === "1"
  const includeClass = searchParams.get("includeClass") === "1"

  if (!passId) {
    return NextResponse.json({ error: "Missing pass_id" }, { status: 400 })
  }

  try {
    const supabase = createServiceClient()

    const { data: pass, error } = await supabase
      .from("passes")
      .select(
        `
        id,
        lock_code,
        valid_from,
        valid_to,
        created_at,
        device:devices ( id, name ),
        pass_type:pass_types ( id, name )
      `,
      )
      .eq("id", passId)
      .single()

    if (error || !pass) {
      logger.error({ error, passId }, "Pass not found")
      return NextResponse.json({ error: "Pass not found" }, { status: 404 })
    }

    const issuerId = process.env.WALLET_ISSUER_ID
    const serviceAccountJson = process.env.GOOGLE_WALLET_SA_JSON
    const APP_ORIGIN = process.env.APP_ORIGIN

    if (!issuerId || !serviceAccountJson || !APP_ORIGIN) {
      logger.error("Missing Google Wallet credentials/env")
      return NextResponse.json(
        {
          error: "Google Wallet not configured",
          message: "Please add WALLET_ISSUER_ID, GOOGLE_WALLET_SA_JSON, and APP_ORIGIN environment variables",
        },
        { status: 501 },
      )
    }

    const serviceAccount = parseServiceAccount(serviceAccountJson)
    const classId = `${issuerId}.zezamii_day_pass`
    const objectId = `${issuerId}.${pass.id}`

    const asset = (p: string) => `${APP_ORIGIN}${p}`
    const fmt = (iso?: string) => {
      if (!iso) return "N/A"
      return new Date(iso).toLocaleString("en-AU", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    }

    const pinCode = pass.lock_code?.[0]?.code || "N/A"
    const accessPointName = pass.device?.[0]?.name || "Entry Access Point"
    const passTypeName = pass.pass_type?.[0]?.name || "Day Pass"

    const instructions = `Enter this PIN at the keypad at ${accessPointName} to gain access. Your pass is valid until ${fmt(
      pass.valid_to ?? undefined,
    )}.`

    // ----- Generic Object (dynamic per pass) -----
    const passObject = {
      id: objectId,
      classId,
      state: "ACTIVE",
      cardTitle: {
        defaultValue: { language: "en-US", value: "Zezamii Day Pass" },
      },
      header: {
        defaultValue: { language: "en-US", value: "Your Access PIN" },
      },
      heroImage: {
        sourceUri: {
          uri: "https://www.zezamii.com/images/zezamii-logo-horizontal.png",
        },
      },
      textModulesData: [
        {
          id: "pin",
          header: "PIN Code",
          body: pinCode,
        },
        {
          id: "access_point",
          header: "Access Point",
          body: accessPointName,
        },
        {
          id: "pass_type",
          header: "Pass Type",
          body: passTypeName,
        },
        {
          id: "instructions",
          header: "Instructions",
          body: instructions,
        },
      ],
      barcode: {
        type: "QR_CODE",
        value: pinCode,
        alternateText: "Zezamii PIN",
      },
      validTimeInterval: {
        start: { date: pass.valid_from ?? pass.created_at },
        end: { date: pass.valid_to ?? undefined },
      },
      linksModuleData: {
        uris: [
          {
            uri: asset(`/passes/${pass.id}`),
            description: "View pass details",
          },
        ],
      },
    }

    // ----- Optional Generic Class (usually pre-created in Issuer Console) -----
    const passClass = {
      id: classId,
      issuerName: "Zezamii",
      reviewStatus: "UNDER_REVIEW", // safe default if Google needs review
      classTemplateInfo: {
        cardTemplateOverride: {
          cardRowTemplateInfos: [
            {
              oneItem: {
                item: {
                  firstValue: {
                    fields: [{ fieldPath: "object.textModulesData['pin']" }],
                  },
                },
              },
            },
          ],
        },
      },
      // Logo / branding if you want it embedded at class-level
      heroImage: {
        sourceUri: {
          uri: "https://www.zezamii.com/images/zezamii-logo-horizontal.png",
        },
      },
    }

    // Origins must be valid https origins
    const origins = [APP_ORIGIN].filter(Boolean)
    if (origins.length === 0) {
      logger.error("No valid origins configured for Google Wallet")
      return NextResponse.json({ error: "APP_ORIGIN environment variable is required" }, { status: 500 })
    }

    // ----- JWT claims -----
    const now = Math.floor(Date.now() / 1000)
    const claims: any = {
      iss: serviceAccount.client_email,
      aud: "google",
      origins,
      typ: "savetowallet",
      iat: now,
      exp: now + 60 * 60, // 1 hour
      payload: includeClass
        ? {
            genericClasses: [passClass],
            genericObjects: [passObject],
          }
        : {
            genericObjects: [passObject],
          },
    }

    if (debugMode) {
      return NextResponse.json({
        debug: true,
        classId,
        objectId,
        claims,
        hints: [
          "If Google rejects, ensure class exists in Issuer Console or call with includeClass=1 once.",
          "Verify WALLET_ISSUER_ID matches your Issuer account.",
          "Ensure GOOGLE_WALLET_SA_JSON private_key is correct and not rotated.",
          "APP_ORIGIN must be https and match Vercel domain.",
        ],
      })
    }

    const privateKeyPem = serviceAccount.private_key
    const privateKey = await importPKCS8(privateKeyPem, "RS256")

    // ----- Added kid to protected header for Google Wallet JWT validation -----
    const token = await new SignJWT(claims)
      .setProtectedHeader({
        alg: "RS256",
        typ: "JWT",
        kid: serviceAccount.private_key_id,
      })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(privateKey)

    const saveUrl = `https://pay.google.com/gp/v/save/${token}`

    logger.info({ passId, objectId }, "Google Wallet pass generated")

    return NextResponse.json({ url: saveUrl, token })
  } catch (error) {
    logger.error({ error, passId }, "Google Wallet pass generation error")
    return NextResponse.json({ error: "Failed to generate Google Wallet pass" }, { status: 500 })
  }
}
