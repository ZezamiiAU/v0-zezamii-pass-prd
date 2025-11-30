import crypto from "node:crypto"

/**
 * Generate HMAC SHA-256 signature for webhook payload
 * Format: t=timestamp,v1=signature
 */
export function generateWebhookSignature(payload: string, secret: string, timestamp: number = Date.now()): string {
  const signedPayload = `${timestamp}.${payload}`
  const signature = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex")

  return `t=${timestamp},v1=${signature}`
}

/**
 * Verify webhook signature
 * Prevents replay attacks by checking timestamp (5 min tolerance)
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
  toleranceSeconds = 300,
): boolean {
  const parts = signature.split(",")
  const timestamp = Number.parseInt(parts.find((p) => p.startsWith("t="))?.split("=")[1] || "0")
  const receivedSig = parts.find((p) => p.startsWith("v1="))?.split("=")[1]

  if (!timestamp || !receivedSig) {
    return false
  }

  // Check timestamp tolerance (prevent replay attacks)
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - Math.floor(timestamp / 1000)) > toleranceSeconds) {
    return false
  }

  // Verify signature
  const signedPayload = `${timestamp}.${payload}`
  const expectedSig = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex")

  return crypto.timingSafeEqual(Buffer.from(receivedSig), Buffer.from(expectedSig))
}
