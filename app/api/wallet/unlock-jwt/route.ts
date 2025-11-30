import { type NextRequest, NextResponse } from "next/server"
import * as jose from "jose"
import { randomBytes } from "node:crypto"
import { validateSearchParams, handleValidationError } from "@/lib/utils/validate-request"
import { unlockJwtQuerySchema } from "@/lib/schemas/api.schema"
import { ZodError } from "zod"

export async function GET(req: NextRequest) {
  try {
    const { userId, deviceId } = validateSearchParams(req, unlockJwtQuerySchema)

    const GOOGLE_WALLET_SA_JSON = process.env.GOOGLE_WALLET_SA_JSON
    if (!GOOGLE_WALLET_SA_JSON) {
      return NextResponse.json({ error: "Service account not configured" }, { status: 500 })
    }

    let svc: any
    try {
      svc = JSON.parse(GOOGLE_WALLET_SA_JSON)
    } catch (parseError) {
      return NextResponse.json({ error: "Invalid service account configuration" }, { status: 500 })
    }

    if (!svc.private_key || !svc.private_key_id) {
      return NextResponse.json({ error: "Invalid service account structure" }, { status: 500 })
    }

    // Generate a random nonce for replay protection
    const nonce = randomBytes(16).toString("hex")

    // Create JWT payload with 60 second expiration
    const payload = {
      user_id: userId,
      device_id: deviceId,
      nonce,
      exp: Math.floor(Date.now() / 1000) + 60,
    }

    // Sign the JWT with the service account private key
    const privateKey = await jose.importPKCS8(svc.private_key, "RS256")
    const token = await new jose.SignJWT(payload)
      .setProtectedHeader({ alg: "RS256", kid: svc.private_key_id })
      .setIssuedAt()
      .setExpirationTime("60s")
      .sign(privateKey)

    return NextResponse.json({ token })
  } catch (error) {
    if (error instanceof ZodError) {
      return handleValidationError(error)
    }
    return NextResponse.json({ error: "Failed to generate unlock token" }, { status: 500 })
  }
}
