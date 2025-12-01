/**
 * Generate a unique idempotency key for API requests
 *
 * Idempotency keys are used to prevent duplicate processing of requests,
 * particularly important for payment operations where retries could cause
 * double charges.
 *
 * Uses crypto.randomUUID() when available (modern browsers and Node.js),
 * falls back to timestamp + random number for older environments.
 *
 * @returns A unique string suitable for use as an idempotency key
 *
 * @example
 * const key = newIdemKey()
 * fetch('/api/payment', {
 *   headers: { 'Idempotency-Key': key }
 * })
 */
export const newIdemKey = () =>
  (typeof crypto !== "undefined" && "randomUUID" in crypto && crypto.randomUUID()) || `${Date.now()}-${Math.random()}`

/**
 * Storage key for the current payment attempt's idempotency key
 * Stored in sessionStorage to persist across page reloads but reset when tab closes
 */
const IDEM_KEY_STORAGE = "payment-idempotency-key"

/**
 * Get or create a stable idempotency key for the current payment attempt
 *
 * Rules:
 * - Generates a new key on first call per browser session
 * - Reuses the same key on retries (network failures, page reloads)
 * - Stored in sessionStorage to survive reloads but clear when tab closes
 * - Call clearPaymentAttempt() when starting a new purchase flow
 *
 * @returns A stable UUID for the current payment attempt
 *
 * @example
 * // At start of new purchase flow:
 * clearPaymentAttempt()
 *
 * // When creating payment intent (safe to retry):
 * const key = getOrCreatePaymentAttemptKey()
 * fetch('/api/payment-intents', {
 *   headers: { 'X-Idempotency-Key': key }
 * })
 */
export function getOrCreatePaymentAttemptKey(): string {
  if (typeof window === "undefined") {
    // Server-side: generate fresh key (should rarely happen for this function)
    return newIdemKey()
  }

  try {
    // Try to retrieve existing key from sessionStorage
    const existing = sessionStorage.getItem(IDEM_KEY_STORAGE)
    if (existing) {
      return existing
    }

    // No existing key: generate new one and store it
    const newKey = newIdemKey()
    sessionStorage.setItem(IDEM_KEY_STORAGE, newKey)
    return newKey
  } catch (err) {
    // sessionStorage might be disabled (private browsing, etc.)
    // Fall back to generating fresh key each time
    console.warn("[v0] sessionStorage unavailable, idempotency keys won't persist across retries")
    return newIdemKey()
  }
}

/**
 * Clear the stored idempotency key to start a fresh payment attempt
 *
 * Call this when:
 * - User starts a new purchase (e.g., changes pass type or form details)
 * - After successful payment completion
 * - When navigating away from purchase flow
 *
 * @example
 * // User clicked "Buy Pass" - start fresh attempt
 * clearPaymentAttempt()
 * const key = getOrCreatePaymentAttemptKey()
 */
export function clearPaymentAttempt(): void {
  if (typeof window === "undefined") return

  try {
    sessionStorage.removeItem(IDEM_KEY_STORAGE)
  } catch (err) {
    // Ignore errors (sessionStorage might be disabled)
  }
}
