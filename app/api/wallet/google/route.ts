import { type NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import logger from "@/lib/logger"
import { SignJWT, importPKCS8 } from "jose"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const passId = searchParams.get("pass_id")

  if (!passId) {
    return NextResponse.json({ error: "Missing pass_id" }, { status: 400 })
  }

  try {
    const supabase = createServiceClient()
    const { data: pass, error } = await supabase
      .from("passes")
      .select(
        `
        *,
        pass_type:pass_types(*),
        lock_code:lock_codes(code),
        device:devices(name)
      `,
      )
      .eq("id", passId)
      .single()

    if (error || !pass) {
      logger.error({ error, passId }, "Pass not found for Google Wallet")
      return NextResponse.json({ error: "Pass not found" }, { status: 404 })
    }

    // Check for required environment variables
    const issuerId = process.env.WALLET_ISSUER_ID
    const serviceAccountJson = process.env.GOOGLE_WALLET_SA_JSON
    const APP_ORIGIN = process.env.APP_ORIGIN

    if (!issuerId || !serviceAccountJson || !APP_ORIGIN) {
      logger.error("Missing Google Wallet credentials")
      return NextResponse.json(
        {
          error: "Google Wallet not configured",
          message: "Please add WALLET_ISSUER_ID, GOOGLE_WALLET_SA_JSON, and APP_ORIGIN environment variables",
        },
        { status: 501 },
      )
    }

    let serviceAccount: any
    try {
      // Handle escaped newlines from Vercel env vars
      const normalizedJson = serviceAccountJson.replace(/\\n/g, "\n")
      serviceAccount = JSON.parse(normalizedJson)
    } catch (parseError) {
      logger.error({ parseError }, "Failed to parse GOOGLE_WALLET_SA_JSON")
      return NextResponse.json(
        {
          error: "Google Wallet configuration error",
          message: "Invalid service account JSON format",
        },
        { status: 500 },
      )
    }

    if (!serviceAccount.client_email || !serviceAccount.private_key || !serviceAccount.private_key_id) {
      logger.error("Service account JSON missing required fields")
      return NextResponse.json(
        {
          error: "Google Wallet configuration error",
          message: "Service account JSON is missing required fields (client_email, private_key, private_key_id)",
        },
        { status: 500 },
      )
    }

    const classId = `${issuerId}.zezamii_day_pass`
    const objectId = `${issuerId}.${pass.id}`

    const asset = (p: string) => `${APP_ORIGIN}${p}`
    const fmt = (iso?: string) => {
      if (!iso) return "N/A"
      const date = new Date(iso)
      return date.toLocaleString("en-AU", {
        timeZone: "Australia/Sydney",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
    }

    const passClass = {
      id: classId,
      classTemplateInfo: {
        cardTemplateOverride: {
          cardRowTemplateInfos: [
            {
              oneItem: {
                item: {
                  firstValue: {
                    fields: [
                      {
                        fieldPath: "object.textModulesData['pin']",
                      },
                    ],
                  },
                },
              },
            },
            {
              twoItems: {
                startItem: {
                  firstValue: {
                    fields: [
                      {
                        fieldPath: "object.textModulesData['access_point']",
                      },
                    ],
                  },
                },
                endItem: {
                  firstValue: {
                    fields: [
                      {
                        fieldPath: "object.textModulesData['pass_type']",
                      },
                    ],
                  },
                },
              },
            },
            {
              twoItems: {
                startItem: {
                  firstValue: {
                    fields: [
                      {
                        fieldPath: "object.textModulesData['valid_from']",
                      },
                    ],
                  },
                },
                endItem: {
                  firstValue: {
                    fields: [
                      {
                        fieldPath: "object.textModulesData['valid_to']",
                      },
                    ],
                  },
                },
              },
            },
            {
              oneItem: {
                item: {
                  firstValue: {
                    fields: [
                      {
                        fieldPath: "object.textModulesData['instructions']",
                      },
                    ],
                  },
                },
              },
            },
          ],
        },
      },
    }

    const pinCode = pass.lock_code?.[0]?.code || "N/A"
    const accessPointName = pass.device?.name || "Entry Access Point"
    const passTypeName = pass.pass_type?.name || "Day Pass"

    const instructions = `Enter this PIN at the keypad at ${accessPointName} to gain access. Your pass is valid until ${fmt(pass.valid_to)}.`

    const passObject = {
      id: objectId,
      classId: classId,
      cardTitle: {
        defaultValue: {
          language: "en-US",
          value: "Zezamii Day Pass",
        },
      },
      header: {
        defaultValue: {
          language: "en-US",
          value: "Your Access PIN",
        },
      },
      heroImage: { sourceUri: { uri: "https://www.zezamii.com/images/zezamii-logo-horizontal.png" } },
      logo: { sourceUri: { uri: "https://www.zezamii.com/images/zezamii-logo-horizontal.png" } },
      hexBackgroundColor: "#0B1E3D",
      state: "ACTIVE",
      textModulesData: [
        {
          id: "pin",
          header: "YOUR ACCESS PIN",
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
          id: "valid_from",
          header: "Valid From",
          body: fmt(pass.valid_from),
        },
        {
          id: "valid_to",
          header: "Valid Until",
          body: fmt(pass.valid_to),
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
      },
    }

    const requestOrigin =
      request.headers.get("origin") || request.headers.get("referer")?.split("/").slice(0, 3).join("/")

    const origins = [APP_ORIGIN].filter(Boolean)
    if (requestOrigin && requestOrigin !== APP_ORIGIN) {
      if (requestOrigin.includes("vercel.app") || requestOrigin.includes("localhost")) {
        origins.push(requestOrigin)
      }
    }

    // Throw error if origins is empty
    if (origins.length === 0) {
      logger.error("No valid origins configured for Google Wallet")
      return NextResponse.json(
        {
          error: "Google Wallet not configured",
          message: "APP_ORIGIN environment variable is required",
        },
        { status: 500 },
      )
    }

    // Create JWT payload
    const claims = {
      iss: serviceAccount.client_email,
      aud: "google",
      origins: origins,
      typ: "savetowallet",
      payload: {
        genericClasses: [passClass],
        genericObjects: [passObject],
      },
    }

    const privateKeyPem: string = serviceAccount.private_key
    const privateKey = await importPKCS8(privateKeyPem, "RS256")

    const token = await new SignJWT(claims)
      .setProtectedHeader({
        alg: "RS256",
        kid: serviceAccount.private_key_id, // CRITICAL: Required by Google for key validation
        typ: "JWT", // CRITICAL: Required by Google Wallet API
      })
      .setIssuedAt() // CRITICAL: Adds iat claim with current timestamp
      .setExpirationTime("2h") // Best practice: Token expires in 2 hours
      .sign(privateKey)

    const saveUrl = `https://pay.google.com/gp/v/save/${token}`

    logger.info({ passId, objectId }, "Google Wallet pass generated")

    return NextResponse.json({
      url: saveUrl,
      token: token,
    })
  } catch (error) {
    logger.error({ error, passId }, "Google Wallet pass generation error")
    return NextResponse.json(
      {
        error: "Failed to generate Google Wallet pass",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
