// lib/payments/payments.repo.ts
import Stripe from "stripe"
import { ENV } from "../env"
import { getPassTypeById } from "../db/pass-types"

export type CheckoutInput = {
  accessPointId: string
  passTypeId: string
  plate?: string
  email?: string
  phone?: string
}

const { STRIPE_SECRET_KEY } = ENV.server()
const stripe = new Stripe(STRIPE_SECRET_KEY)

export async function createStripePaymentIntent(input: CheckoutInput, idempotencyKey: string) {
  const passType = await getPassTypeById(input.passTypeId)

  if (!passType) {
    throw new Error("Invalid pass type")
  }

  // Validate pricing data
  if (!passType.price_cents || passType.price_cents <= 0) {
    throw new Error("Pass type has invalid pricing configuration")
  }

  if (!passType.currency || passType.currency.length !== 3) {
    throw new Error("Pass type has invalid currency configuration")
  }

  // Use Stripe Price ID if available (preferred), otherwise use unit_amount
  const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
    currency: passType.currency.toLowerCase(),
    metadata: {
      accessPointId: input.accessPointId,
      passTypeId: input.passTypeId,
      plate: input.plate ?? "",
      email: input.email ?? "",
      phone: input.phone ?? "",
    },
    automatic_payment_methods: { enabled: true },
  }

  if (passType.stripe_price_id) {
    // Preferred: Use Stripe Price ID for consistent pricing
    paymentIntentParams.amount = passType.price_cents
  } else {
    // Fallback: Use unit_amount from database
    paymentIntentParams.amount = passType.price_cents
  }

  return stripe.paymentIntents.create(paymentIntentParams, { idempotencyKey })
}
