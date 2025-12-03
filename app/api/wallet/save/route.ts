import { type NextRequest, NextResponse } from "next/server"
import * as jose from "jose"
import { validateSearchParams, handleValidationError } from "@/lib/utils/validate-request"
import { walletSaveQuerySchema } from "@/lib/schemas/api.schema"
import { ZodError } from "zod"

export async function GET(req: NextRequest) {
  try {
    const queryParams = validateSearchParams(req, walletSaveQuerySchema)

    const GOOGLE_WALLET_SA_JSON = process.env.GOOGLE_WALLET_SA_JSON
    const ISSUER_ID = process.env.WALLET_ISSUER_ID
    const CLASS_ID = process.env.WALLET_CLASS_ID
    const APP_ORIGIN = process.env.APP_ORIGIN

    if (!GOOGLE_WALLET_SA_JSON || !ISSUER_ID || !CLASS_ID || !APP_ORIGIN) {
      return NextResponse.json(
        {
          error: "Google Wallet not configured",
          details: "Missing required environment variables. Please contact support.",
        },
        { status: 500 },
      )
    }

    if (!CLASS_ID?.includes(".") || !String(CLASS_ID).startsWith(String(ISSUER_ID))) {
      return NextResponse.json(
        {
          error: "WALLET_CLASS_ID must be '<ISSUER_ID>.<classSuffix>' and start with WALLET_ISSUER_ID",
        },
        { status: 500 },
      )
    }

    let svc: any
    try {
      svc = JSON.parse(GOOGLE_WALLET_SA_JSON)
    } catch (parseError) {
      return NextResponse.json(
        {
          error: "Google Wallet configuration error",
          details: "Invalid service account JSON format",
        },
        { status: 500 },
      )
    }

    if (!svc.client_email || !svc.private_key || !svc.private_key_id) {
      return NextResponse.json(
        {
          error: "Google Wallet configuration error",
          details: "Service account JSON is missing required fields",
        },
        { status: 500 },
      )
    }

    const userId = (queryParams.userId || "dev-001").toLowerCase().replace(/[^a-z0-9_-]/g, "")
    const deviceId = queryParams.deviceId || ""
    const passType = queryParams.passType || "Day Pass"
    const code = queryParams.code || ""
    const validFrom = queryParams.validFrom || ""
    const validTo = queryParams.validTo || ""
    const accessPointName = queryParams.accessPoint || "Entry Access Point"

    const timestamp = Date.now()
    const uniqueString = `${userId}_${passType.toLowerCase().replace(/[^a-z0-9]/g, "_")}_${code || timestamp}`
    const passId = `${ISSUER_ID}.${uniqueString}`.toLowerCase()

    let unlockUri = "https://zezamii.com/coming-soon"
    if (deviceId) {
      try {
        const unlockJwtResponse = await fetch(
          `${APP_ORIGIN}/api/wallet/unlock-jwt?userId=${userId}&deviceId=${deviceId}`,
        )

        if (unlockJwtResponse.ok) {
          const { token } = await unlockJwtResponse.json()
          unlockUri = `https://api.zezamii.com/unlock?j=${token}`
        }
      } catch (error) {}
    }

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

    const instructions = code
      ? `Enter this PIN at the keypad at ${accessPointName} to gain access. Your pass is valid until ${fmt(validTo)}.`
      : "Tap a link below to unlock, or enter your PIN at the keypad."

    const genericObject = {
      id: passId, // Use the explicitly named passId variable
      classId: CLASS_ID,
      cardTitle: {
        defaultValue: {
          language: "en-US",
          value: "Access Pass",
        },
      },
      header: {
        defaultValue: {
          language: "en-US",
          value: "Your Access PIN",
        },
      },
      heroImage: {
        sourceUri: { uri: "https://www.zezamii.com/images/zezamii-logo-horizontal.png" },
      },
      logo: {
        sourceUri: { uri: "https://www.zezamii.com/images/zezamii-logo-horizontal.png" },
      },
      hexBackgroundColor: "#0B1E3D",
      state: "ACTIVE",
      textModulesData: [
        ...(code
          ? [
              {
                id: "pin",
                header: "YOUR ACCESS PIN",
                body: code,
              },
            ]
          : []),
        {
          id: "access_point",
          header: "Access Point",
          body: accessPointName,
        },
        {
          id: "pass_type",
          header: "Pass Type",
          body: passType,
        },
        ...(validFrom
          ? [
              {
                id: "valid_from",
                header: "Valid From",
                body: fmt(validFrom),
              },
            ]
          : []),
        ...(validTo
          ? [
              {
                id: "valid_to",
                header: "Valid Until",
                body: fmt(validTo),
              },
            ]
          : []),
        {
          id: "instructions",
          header: "Instructions",
          body: instructions,
        },
      ],
      linksModuleData: {
        uris: [
          { id: "unlock-dynamic", uri: unlockUri, description: "Remote Unlock" },
          { id: "support", uri: "https://zezamii.com/support", description: "Help & Support" },
        ],
      },
      ...(code
        ? {
            barcode: {
              type: "QR_CODE",
              value: code,
            },
          }
        : {}),
    }

    const genericClass = {
      id: CLASS_ID,
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

    const requestOrigin = req.headers.get("origin") || req.headers.get("referer")?.split("/").slice(0, 3).join("/")
    const origins = [APP_ORIGIN]

    if (requestOrigin && requestOrigin !== APP_ORIGIN) {
      if (requestOrigin.includes("vercel.app") || requestOrigin.includes("localhost")) {
        origins.push(requestOrigin)
      }
    }

    const payload = {
      iss: svc.client_email,
      aud: "google",
      typ: "savetowallet",
      origins: origins,
      payload: {
        genericClasses: [genericClass],
        genericObjects: [genericObject],
      },
    }

    const privateKey = await jose.importPKCS8(svc.private_key, "RS256")

    let jwtBuilder = new jose.SignJWT(payload as any)
      .setProtectedHeader({ alg: "RS256", kid: svc.private_key_id, typ: "JWT" })
      .setIssuedAt()

    if (validTo) {
      const expirationDate = new Date(validTo)
      jwtBuilder = jwtBuilder.setExpirationTime(expirationDate)
    }

    const token = await jwtBuilder.sign(privateKey)

    console.log("[v0] Google Wallet JWT Payload:", JSON.stringify(payload, null, 2))
    console.log("[v0] Generic Object Pass ID:", passId) // Log the passId for debugging
    console.log("[v0] Class ID:", CLASS_ID)

    const saveUrl = `https://pay.google.com/gp/v/save/${token}`

    return NextResponse.json({
      saveUrl,
      objectId: passId, // Return passId as objectId for consistency
      jwtPayload: payload,
    })
  } catch (error) {
    if (error instanceof ZodError) {
      return handleValidationError(error)
    }
    return NextResponse.json(
      {
        error: "Failed to generate Google Wallet pass",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
