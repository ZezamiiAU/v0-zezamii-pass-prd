import { createServiceClient } from "@/lib/supabase/server"
import logger from "@/lib/logger"
import { type Result, ok, err } from "./result"

export interface Payment {
  id: string
  pass_id: string
  stripe_checkout_session: string | null
  stripe_payment_intent: string | null
  amount_cents: number
  currency: string
  status: string
  created_at: string
  metadata?: Record<string, unknown> | null
}

export type PaymentWithPass = Payment & {
  pass: any
}

async function retryWithBackoff<T>(fn: () => Promise<T>, maxRetries = 2, initialDelay = 100): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(JSON.stringify(error))
      logger.debug({ attempt, maxRetries, error: lastError.message }, "[Payments] Retry attempt failed")

      if (attempt === maxRetries - 1) {
        throw lastError
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
    logger.error({ passId: data.passId, error: error.message }, "[Payments] Error creating payment")
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
    logger.error({ checkoutSessionId, status, error: error.message }, "[Payments] Error updating payment")
    return false
  }

  return true
}

export async function getPassByCheckoutSession(sessionId: string): Promise<PaymentWithPass | null> {
  try {
    return await retryWithBackoff(async () => {
      const supabase = createServiceClient()

      const { data: payment, error: paymentError } = await supabase
        .schema("pass")
        .from("payments")
        .select(`
          id,
          pass_id,
          stripe_checkout_session,
          stripe_payment_intent,
          amount_cents,
          currency,
          status,
          created_at
        `)
        .eq("stripe_checkout_session", sessionId)
        .single()

      if (paymentError) {
        logger.error(
          {
            sessionId,
            code: paymentError.code,
            message: paymentError.message,
            details: paymentError.details,
            hint: paymentError.hint,
          },
          "[Payments] Payment query error",
        )

        if (paymentError.code === "PGRST116") {
          return null
        }
        throw paymentError
      }

      if (!payment) {
        return null
      }

      const { data: pass, error: passError } = await supabase
        .schema("pass")
        .from("passes")
        .select(`
          id,
          pass_type_id,
          device_id,
          site_id,
          org_id,
          valid_from,
          valid_to,
          status,
          purchaser_email,
          vehicle_plate,
          single_use,
          created_at,
          terms_accepted_at
        `)
        .eq("id", payment.pass_id)
        .single()

      if (passError || !pass) {
        logger.error({ passId: payment.pass_id, error: passError?.message }, "[Payments] Pass query error")
        return null
      }

      const { data: passType, error: passTypeError } = await supabase
        .schema("pass")
        .from("pass_types")
        .select("id, name, code, duration_minutes")
        .eq("id", pass.pass_type_id)
        .single()

      if (passTypeError || !passType) {
        logger.error(
          { passTypeId: pass.pass_type_id, error: passTypeError?.message },
          "[Payments] Pass type query error",
        )
        return null
      }

      const result = {
        ...payment,
        pass: {
          ...pass,
          pass_type: passType,
        },
      } as PaymentWithPass

      return result
    })
  } catch (error) {
    logger.error(
      { sessionId, error: error instanceof Error ? error.message : JSON.stringify(error) },
      "[Payments] Error fetching pass by session",
    )
    return null
  }
}

export async function getPassByPaymentIntent(intentId: string): Promise<PaymentWithPass | null> {
  try {
    return await retryWithBackoff(async () => {
      const supabase = createServiceClient()

      const { data: payment, error: paymentError } = await supabase
        .schema("pass")
        .from("payments")
        .select(`
          id,
          pass_id,
          stripe_checkout_session,
          stripe_payment_intent,
          amount_cents,
          currency,
          status,
          created_at
        `)
        .eq("stripe_payment_intent", intentId)
        .single()

      if (paymentError) {
        logger.error(
          {
            intentId,
            code: paymentError.code,
            message: paymentError.message,
            details: paymentError.details,
            hint: paymentError.hint,
          },
          "[Payments] Payment query error",
        )

        if (paymentError.code === "PGRST116") {
          return null
        }
        throw paymentError
      }

      if (!payment) {
        return null
      }

      const { data: pass, error: passError } = await supabase
        .schema("pass")
        .from("passes")
        .select(`
          id,
          pass_type_id,
          device_id,
          site_id,
          org_id,
          valid_from,
          valid_to,
          status,
          purchaser_email,
          vehicle_plate,
          single_use,
          created_at,
          terms_accepted_at
        `)
        .eq("id", payment.pass_id)
        .single()

      if (passError || !pass) {
        logger.error({ passId: payment.pass_id, error: passError?.message }, "[Payments] Pass query error")
        return null
      }

      const { data: passType, error: passTypeError } = await supabase
        .schema("pass")
        .from("pass_types")
        .select("id, name, code, duration_minutes")
        .eq("id", pass.pass_type_id)
        .single()

      if (passTypeError || !passType) {
        logger.error(
          { passTypeId: pass.pass_type_id, error: passTypeError?.message },
          "[Payments] Pass type query error",
        )
        return null
      }

      const result = {
        ...payment,
        pass: {
          ...pass,
          pass_type: passType,
        },
      } as PaymentWithPass

      return result
    })
  } catch (error) {
    logger.error(
      { intentId, error: error instanceof Error ? error.message : JSON.stringify(error) },
      "[Payments] Error fetching pass by payment intent",
    )
    return null
  }
}

/**
 * Result-based wrapper functions
 * These provide better error handling without breaking existing code
 */

export async function createPaymentResult(data: Parameters<typeof createPayment>[0]): Promise<Result<Payment>> {
  const payment = await createPayment(data)
  if (!payment) {
    return err(new Error("Failed to create payment"))
  }
  return ok(payment)
}

export async function getPassByCheckoutSessionResult(sessionId: string): Promise<Result<PaymentWithPass>> {
  const payment = await getPassByCheckoutSession(sessionId)
  if (!payment) {
    return err(new Error(`Payment not found for session: ${sessionId}`))
  }
  return ok(payment)
}

export async function getPassByPaymentIntentResult(intentId: string): Promise<Result<PaymentWithPass>> {
  const payment = await getPassByPaymentIntent(intentId)
  if (!payment) {
    return err(new Error(`Payment not found for intent: ${intentId}`))
  }
  return ok(payment)
}

export async function updatePaymentStatusResult(
  checkoutSessionId: string,
  status: string,
  paymentIntentId?: string,
): Promise<Result<boolean>> {
  const success = await updatePaymentStatus(checkoutSessionId, status, paymentIntentId)
  if (!success) {
    return err(new Error(`Failed to update payment status: ${checkoutSessionId}`))
  }
  return ok(true)
}
