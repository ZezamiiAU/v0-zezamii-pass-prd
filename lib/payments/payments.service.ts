import type { CheckoutInput } from "./payments.repo"
import { createStripePaymentIntent } from "./payments.repo"

export async function createPaymentIntentService(input: CheckoutInput, idempotencyKey: string) {
  const intent = await createStripePaymentIntent(input, idempotencyKey)
  return { clientSecret: intent.client_secret! }
}
