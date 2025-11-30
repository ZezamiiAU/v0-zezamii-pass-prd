import { generateWebhookSignature } from "./signature"

export interface WebhookDeliveryResult {
  success: boolean
  statusCode?: number
  responseBody?: string
  error?: string
}

/**
 * Deliver webhook event to subscriber URL
 */
export async function deliverWebhook(
  url: string,
  secret: string,
  payload: any,
  attemptNumber = 1,
): Promise<WebhookDeliveryResult> {
  try {
    const payloadString = JSON.stringify(payload)
    const signature = generateWebhookSignature(payloadString, secret)

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
        "X-Webhook-Attempt": attemptNumber.toString(),
        "User-Agent": "Zezamii-Webhooks/1.0",
      },
      body: payloadString,
      signal: AbortSignal.timeout(30000), // 30 second timeout
    })

    const responseBody = await response.text()

    return {
      success: response.ok,
      statusCode: response.status,
      responseBody: responseBody.substring(0, 1000), // Limit stored response
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Calculate next retry time with exponential backoff
 * Attempts: 1min, 5min, 30min, 2hr, 12hr
 */
export function calculateNextRetry(attemptNumber: number): Date {
  const delays = [60, 300, 1800, 7200, 43200] // seconds
  const delaySeconds = delays[Math.min(attemptNumber - 1, delays.length - 1)]
  return new Date(Date.now() + delaySeconds * 1000)
}

/**
 * Check if delivery should be retried
 */
export function shouldRetry(attemptNumber: number, statusCode?: number): boolean {
  // Max 5 attempts
  if (attemptNumber >= 5) {
    return false
  }

  // Don't retry client errors (4xx except 429)
  if (statusCode && statusCode >= 400 && statusCode < 500 && statusCode !== 429) {
    return false
  }

  return true
}
