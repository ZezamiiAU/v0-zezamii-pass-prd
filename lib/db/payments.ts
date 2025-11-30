import { createServiceClient } from "@/lib/supabase/server"

export interface Payment {
  id: string
  pass_id: string
  stripe_checkout_session: string | null
  stripe_payment_intent: string | null
  amount_cents: number
  currency: string
  status: string
  created_at: string
}

export type PaymentWithPass = Payment & {
  pass: any
}

async function retryWithBackoff<T>(fn: () => Promise<T>, maxRetries = 3, initialDelay = 100): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error

      if (attempt === maxRetries - 1) {
        throw error
      }

      const delay = initialDelay * Math.pow(2, attempt)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError
}

export async function createPayment(data: {
  passId: string
  stripeCheckoutSession?: string
  stripePaymentIntent?: string
  amountCents: number
  currency: string
  status?: string
}): Promise<Payment | null> {
  const supabase = createServiceClient()

  const { data: payment, error } = await supabase
    .schema("pass")
    .from("payments")
    .insert({
      pass_id: data.passId,
      stripe_checkout_session: data.stripeCheckoutSession || null,
      stripe_payment_intent: data.stripePaymentIntent || null,
      amount_cents: data.amountCents,
      currency: data.currency,
      status: data.status || "pending",
    })
    .select()
    .single()

  if (error) {
    console.error("Error creating payment:", error)
    return null
  }

  return payment
}

export async function updatePaymentStatus(
  checkoutSessionId: string,
  status: string,
  paymentIntentId?: string,
): Promise<boolean> {
  const supabase = createServiceClient()

  const updateData: any = { status }
  if (paymentIntentId) {
    updateData.stripe_payment_intent = paymentIntentId
  }

  const { error } = await supabase
    .schema("pass")
    .from("payments")
    .update(updateData)
    .eq("stripe_checkout_session", checkoutSessionId)

  if (error) {
    console.error("Error updating payment:", error)
    return false
  }

  return true
}

export async function getPassByCheckoutSession(sessionId: string): Promise<PaymentWithPass | null> {
  try {
    return await retryWithBackoff(async () => {
      const supabase = createServiceClient()

      const { data: payment, error: paymentError } = await supabase
        .schema("public")
        .from("v_pass_payments")
        .select(`
          *,
          pass:v_passes(
            *,
            pass_type:v_pass_types(name, code, duration_minutes)
          )
        `)
        .eq("stripe_checkout_session", sessionId)
        .single()

      if (paymentError) {
        if (paymentError.code === "PGRST116") {
          return null
        }
        throw paymentError
      }

      return payment as PaymentWithPass
    })
  } catch (error) {
    console.error("Error fetching pass by session:", error)
    return null
  }
}

export async function getPassByPaymentIntent(intentId: string): Promise<PaymentWithPass | null> {
  try {
    return await retryWithBackoff(async () => {
      const supabase = createServiceClient()

      const { data: payment, error: paymentError } = await supabase
        .schema("public")
        .from("v_pass_payments")
        .select(`
          *,
          pass:v_passes(
            *,
            pass_type:v_pass_types(name, code, duration_minutes)
          )
        `)
        .eq("stripe_payment_intent", intentId)
        .single()

      if (paymentError) {
        if (paymentError.code === "PGRST116") {
          return null
        }
        throw paymentError
      }

      return payment as PaymentWithPass
    })
  } catch (error) {
    console.error("Error fetching pass by payment intent:", error)
    return null
  }
}
