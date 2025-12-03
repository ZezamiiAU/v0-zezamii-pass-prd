import { type NextRequest, NextResponse } from "next/server"
import logger from "@/lib/logger"

export async function GET(request: NextRequest) {
  try {
    const issuerId = process.env.WALLET_ISSUER_ID
    const serviceAccountJson = process.env.GOOGLE_WALLET_SA_JSON
    const appOrigin = process.env.APP_ORIGIN
    const classId = process.env.WALLET_CLASS_ID

    const checks = {
      env_vars: {
        WALLET_ISSUER_ID: !!issuerId,
        GOOGLE_WALLET_SA_JSON: !!serviceAccountJson,
        APP_ORIGIN: !!appOrigin,
        WALLET_CLASS_ID: !!classId,
      },
      service_account: {
        can_parse: false,
        has_client_email: false,
        has_private_key: false,
        has_private_key_id: false,
        client_email: null as string | null,
      },
      validation: {
        issuer_id_format: false,
        class_id_format: false,
        class_id_matches_issuer: false,
      },
      recommendations: [] as string[],
    }

    // Parse service account
    if (serviceAccountJson) {
      try {
        const normalizedJson = serviceAccountJson.replace(/\\n/g, "\n")
        const sa = JSON.parse(normalizedJson)
        checks.service_account.can_parse = true
        checks.service_account.has_client_email = !!sa.client_email
        checks.service_account.has_private_key = !!sa.private_key
        checks.service_account.has_private_key_id = !!sa.private_key_id
        checks.service_account.client_email = sa.client_email || null
      } catch (e) {
        checks.recommendations.push("GOOGLE_WALLET_SA_JSON is not valid JSON. Check for escaped newlines.")
      }
    }

    // Validate issuer ID format
    if (issuerId) {
      checks.validation.issuer_id_format = /^\d+$/.test(issuerId)
      if (!checks.validation.issuer_id_format) {
        checks.recommendations.push("WALLET_ISSUER_ID should be a numeric string (e.g., '3388000000000000000')")
      }
    }

    // Validate class ID format
    if (classId && issuerId) {
      checks.validation.class_id_format = classId.includes(".")
      checks.validation.class_id_matches_issuer = classId.startsWith(issuerId)

      if (!checks.validation.class_id_format) {
        checks.recommendations.push("WALLET_CLASS_ID must be in format 'ISSUER_ID.classSuffix'")
      }
      if (!checks.validation.class_id_matches_issuer) {
        checks.recommendations.push("WALLET_CLASS_ID must start with WALLET_ISSUER_ID")
      }
    }

    // Overall status
    const allEnvVarsPresent = Object.values(checks.env_vars).every((v) => v === true)
    const serviceAccountValid =
      checks.service_account.can_parse &&
      checks.service_account.has_client_email &&
      checks.service_account.has_private_key &&
      checks.service_account.has_private_key_id

    const validationPassed = checks.validation.issuer_id_format && checks.validation.class_id_format

    const status = allEnvVarsPresent && serviceAccountValid && validationPassed ? "READY" : "NEEDS_ATTENTION"

    logger.info({ status }, "Google Wallet debug check")

    return NextResponse.json(
      {
        status,
        checks,
        help: {
          setup_guide: "https://developers.google.com/wallet/generic/web/prerequisites",
          jwt_format: "Protected header must include: alg, kid, typ. Payload must include: iss, aud, iat, exp",
          next_steps:
            status === "READY"
              ? "Configuration looks good. Test with /api/wallet/google?pass_id=YOUR_PASS_ID"
              : "Fix the issues listed in recommendations",
        },
      },
      { status: status === "READY" ? 200 : 500 },
    )
  } catch (error) {
    logger.error({ error }, "Google Wallet debug error")
    return NextResponse.json(
      {
        status: "ERROR",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
