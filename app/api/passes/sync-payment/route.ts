import { type NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { createSchemaServiceClient } from "@/lib/supabase/server"
import { generateSecurePin } from "@/lib/pin-generator"
import logger from "@/lib/logger"
import { validateBody, handleValidationError } from "@/lib/utils/validate-request"
import { syncPaymentBodySchema } from "@/lib/schemas/api.schema"
import { ZodError } from "zod"
import { ENV } from "@/lib/env"

const { STRIPE_SECRET_KEY } = ENV.server()
const stripe = new Stripe(STRIPE_SECRET_KEY)

export async function POST(req: NextRequest) {
  try {
    const { paymentIntentId } = await validateBody(req, syncPaymentBodySchema)

    // Fetch the payment intent from Stripe to check its status
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)

    if (paymentIntent.status !== "succeeded") {
      return NextResponse.json(
        {
          error: "Payment not yet succeeded",
          status: paymentIntent.status,
        },
        { status: 400 },
      )
    }

    // Get the pass ID from metadata
    const passId = paymentIntent.metadata.pass_id

    if (!passId) {
      return NextResponse.json({ error: "No pass ID in payment metadata" }, { status: 400 })
    }

    const passDb = createSchemaServiceClient("pass")

    // Check if pass is already active
    const { data: existingPass } = await passDb.from("passes").select("status").eq("id", passId).single()

    if (existingPass?.status === "active") {
      return NextResponse.json({ success: true, alreadyActive: true })
    }

    const { data: existingLockCode } = await passDb.from("lock_codes").select("id, code").eq("pass_id", passId).single()

    if (!existingLockCode) {
      // Only create lock code if it doesn't exist
      const pin = generateSecurePin(6)
      const now = new Date()

      const { data: pass } = await passDb.from("passes").select("id, valid_from, valid_to").eq("id", passId).single()

      if (!pass) {
        return NextResponse.json({ error: "Pass not found" }, { status: 404 })
      }

      const startsAt = pass.valid_from || now.toISOString()
      const endsAt = pass.valid_to || new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()

      await passDb.from("lock_codes").insert({
        pass_id: pass.id,
        code: pin,
        provider: "zezamii",
        starts_at: startsAt,
        ends_at: endsAt,
      })
    }

    // Update pass status to active
    await passDb.from("passes").update({ status: "active" }).eq("id", passId)

    // Update payment status
    await passDb.from("payments").update({ status: "succeeded" }).eq("stripe_payment_intent", paymentIntentId)

    logger.info({ passId, paymentIntentId }, "Payment synced manually (webhook fallback)")

    return NextResponse.json({ success: true, passId, status: "active" })
  } catch (error) {
    if (error instanceof ZodError) {
      return handleValidationError(error)
    }
    logger.error({ error }, "Payment sync failed")
    return NextResponse.json({ error: "Failed to sync payment" }, { status: 500 })
  }
}
