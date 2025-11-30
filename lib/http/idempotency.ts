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
