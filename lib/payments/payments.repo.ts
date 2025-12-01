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

  if (!passType.price_cents || passType.price_cents <= 0) {
    throw new Error("Pass type has invalid pricing configuration")
  }

  if (!passType.currency || passType.currency.length !== 3) {
    throw new Error("Pass type has invalid currency configuration")
  }

  // Ensure amount is always a valid integer
  const amount = Math.round(passType.price_cents)
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error(`Invalid payment amount: ${amount}. Must be a positive integer in smallest currency unit.`)
  }

  // Create PaymentIntent with required amount field
  const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
    amount, // Required: amount in smallest currency unit (cents)
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

  return stripe.paymentIntents.create(paymentIntentParams, { idempotencyKey })
}
