// lib/payments/payments.repo.ts
import Stripe from "stripe"
import { ENV } from "../env"

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
  return stripe.paymentIntents.create(
    {
      amount: 1000, // TODO: compute from passTypeId
      currency: "aud",
      metadata: {
        accessPointId: input.accessPointId,
        passTypeId: input.passTypeId,
        plate: input.plate ?? "",
        email: input.email ?? "",
        phone: input.phone ?? "",
      },
      automatic_payment_methods: { enabled: true },
    },
    { idempotencyKey },
  )
}
