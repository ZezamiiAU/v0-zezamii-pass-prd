import { NextResponse } from "next/server"
import Stripe from "stripe"
import logger from "@/lib/logger"
import { ENV } from "@/lib/env"
import { stripeMetaSchema } from "@/lib/schemas/api.schema"
import { safeValidate } from "@/lib/utils/validate-request"
import { createServiceClient } from "@/lib/supabase/server"
import { updatePaymentStatus, getPassByPaymentIntent } from "@/lib/db/payments"
import { updatePassStatus } from "@/lib/db/passes"
import { getPassTypeById } from "@/lib/db/pass-types"

const { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET } = ENV.server()

/**
 * @param {Request} request
 */
export async function POST(request) {
  const body = await request.text()
  const signature = request.headers.get("stripe-signature")

  if (!signature) {
    logger.warn("[Stripe Webhook] Missing stripe-signature header")
    return NextResponse.json({ error: "Missing signature" }, { status: 400 })
  }

  if (!STRIPE_SECRET_KEY) {
    logger.error("[Stripe Webhook] STRIPE_SECRET_KEY not configured")
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 })
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY)

  let event
  try {
    event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET || "")
  } catch (err) {
    logger.error({ error: err.message }, "[Stripe Webhook] Signature verification failed")
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  logger.info({ type: event.type, id: event.id }, "[Stripe Webhook] Received event")

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutComplete(event.data.object)
        break

      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(event.data.object)
        break

      case "payment_intent.payment_failed":
        await handlePaymentIntentFailed(event.data.object)
        break

      default:
        logger.info({ type: event.type }, "[Stripe Webhook] Unhandled event type")
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    logger.error({ error: error.message, type: event.type }, "[Stripe Webhook] Error handling event")
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 })
  }
}

/**
 * Handle checkout.session.completed event
 * @param {Stripe.Checkout.Session} session
 */
async function handleCheckoutComplete(session) {
  const metaResult = safeValidate(session.metadata ?? {}, stripeMetaSchema)
  if (!metaResult.ok) {
    logger.warn({ sessionId: session.id, errors: metaResult.error.errors }, "[Stripe Webhook] Invalid session metadata")
    return
  }

  const meta = metaResult.data
  const passId = meta.passId || meta.pass_id
  const passTypeId = meta.passTypeId || meta.pass_type_id

  if (!passId || !passTypeId) {
    logger.warn({ sessionId: session.id, meta }, "[Stripe Webhook] Missing passId or passTypeId in metadata")
    return
  }

  logger.info({ sessionId: session.id, passId, passTypeId }, "[Stripe Webhook] Processing checkout completion")

  // Get pass type for duration calculation
  const passType = await getPassTypeById(passTypeId)
  if (!passType) {
    logger.error({ passTypeId }, "[Stripe Webhook] Pass type not found")
    return
  }

  // Calculate validity period
  const now = new Date()
  const validFrom = now
  const validTo = new Date(now.getTime() + passType.duration_minutes * 60 * 1000)

  // Update pass status to active with validity dates
  const updateResult = await updatePassStatus(passId, "active", validFrom, validTo)
  if (!updateResult.success) {
    logger.error({ passId }, "[Stripe Webhook] Failed to activate pass")
    return
  }

  // Update payment status
  await updatePaymentStatus(session.id, "completed", session.payment_intent)

  logger.info(
    { passId, validFrom, validTo, durationMinutes: passType.duration_minutes },
    "[Stripe Webhook] Pass activated successfully",
  )
}

/**
 * Handle payment_intent.succeeded event
 * @param {Stripe.PaymentIntent} paymentIntent
 */
async function handlePaymentIntentSucceeded(paymentIntent) {
  const metaResult = safeValidate(paymentIntent.metadata ?? {}, stripeMetaSchema)
  if (!metaResult.ok) {
    logger.warn(
      { paymentIntentId: paymentIntent.id, errors: metaResult.error.errors },
      "[Stripe Webhook] Invalid payment intent metadata",
    )
    return
  }

  const meta = metaResult.data
  const passId = meta.passId || meta.pass_id
  const passTypeId = meta.passTypeId || meta.pass_type_id

  if (!passId) {
    logger.warn({ paymentIntentId: paymentIntent.id }, "[Stripe Webhook] Missing passId in metadata")
    return
  }

  logger.info({ paymentIntentId: paymentIntent.id, passId }, "[Stripe Webhook] Payment succeeded")

  // Check if pass already activated (by checkout.session.completed)
  const existingPayment = await getPassByPaymentIntent(paymentIntent.id)
  if (existingPayment && existingPayment.pass.status === "active") {
    logger.info({ passId }, "[Stripe Webhook] Pass already activated, skipping")
    return
  }

  // Get pass type for duration calculation
  const passType = passTypeId ? await getPassTypeById(passTypeId) : null
  if (!passType) {
    logger.error({ passTypeId }, "[Stripe Webhook] Pass type not found")
    return
  }

  // Calculate validity period
  const now = new Date()
  const validFrom = now
  const validTo = new Date(now.getTime() + passType.duration_minutes * 60 * 1000)

  // Update pass status to active
  const updateResult = await updatePassStatus(passId, "active", validFrom, validTo)
  if (!updateResult.success) {
    logger.error({ passId }, "[Stripe Webhook] Failed to activate pass")
    return
  }

  // Update payment record if exists
  const supabase = createServiceClient()
  await supabase
    .schema("pass")
    .from("payments")
    .update({ status: "completed" })
    .eq("stripe_payment_intent", paymentIntent.id)

  logger.info({ passId, validFrom, validTo }, "[Stripe Webhook] Pass activated via payment_intent.succeeded")
}

/**
 * Handle payment_intent.payment_failed event
 * @param {Stripe.PaymentIntent} paymentIntent
 */
async function handlePaymentIntentFailed(paymentIntent) {
  const metaResult = safeValidate(paymentIntent.metadata ?? {}, stripeMetaSchema)
  if (!metaResult.ok) {
    logger.warn(
      { paymentIntentId: paymentIntent.id, errors: metaResult.error.errors },
      "[Stripe Webhook] Invalid payment intent metadata",
    )
    return
  }

  const meta = metaResult.data
  const passId = meta.passId || meta.pass_id

  if (!passId) {
    logger.warn({ paymentIntentId: paymentIntent.id }, "[Stripe Webhook] Missing passId in metadata")
    return
  }

  const failureMessage = paymentIntent.last_payment_error?.message || "Payment failed"

  logger.warn({ paymentIntentId: paymentIntent.id, passId, error: failureMessage }, "[Stripe Webhook] Payment failed")

  // Update pass status to failed
  await updatePassStatus(passId, "payment_failed")

  // Update payment record
  const supabase = createServiceClient()
  await supabase
    .schema("pass")
    .from("payments")
    .update({ status: "failed" })
    .eq("stripe_payment_intent", paymentIntent.id)
}
