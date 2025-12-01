import { type NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { deliverWebhook } from "@/lib/webhooks/delivery"
import { assertDevOnly } from "@/lib/assertDevOnly"

// POST /api/webhooks/subscriptions/:id/test - Test webhook delivery
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const devCheck = await assertDevOnly(request, { requireAdmin: true })
  if (devCheck) return devCheck

  try {
    const { id } = await params

    const supabase = createServiceClient()

    // Fetch subscription
    const { data: subscription, error } = await supabase.from("webhook_subscriptions").select("*").eq("id", id).single()

    if (error || !subscription) {
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 })
    }

    // Create a test payload
    const testPayload = {
      event: "webhook.test.v1",
      timestamp: new Date().toISOString(),
      data: {
        message: "This is a test webhook delivery",
        subscription_id: id,
      },
    }

    // Attempt delivery
    const result = await deliverWebhook(subscription.url, subscription.secret, testPayload, 1)

    return NextResponse.json({
      success: result.success,
      statusCode: result.statusCode,
      responseBody: result.responseBody,
      error: result.error,
    })
  } catch (error) {
    console.error("[v0] Unexpected error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
