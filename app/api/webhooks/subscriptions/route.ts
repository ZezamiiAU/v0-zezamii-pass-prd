import { type NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import crypto from "node:crypto"
import { validateBody, handleValidationError } from "@/lib/utils/validate-request"
import { webhookSubscriptionBodySchema } from "@/lib/schemas/api.schema"
import { ZodError } from "zod"

// GET /api/webhooks/subscriptions - List webhook subscriptions
export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient()

    const { data: subscriptions, error } = await supabase
      .from("webhook_subscriptions")
      .select("id, org_id, url, events, status, description, created_at, last_delivery_at")
      .eq("status", "active")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching subscriptions:", error)
      return NextResponse.json({ error: "Failed to fetch subscriptions" }, { status: 500 })
    }

    return NextResponse.json({ subscriptions })
  } catch (error) {
    console.error("Unexpected error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/webhooks/subscriptions - Create webhook subscription
export async function POST(request: NextRequest) {
  try {
    const { org_id, url, events, description } = await validateBody(request, webhookSubscriptionBodySchema)

    // Generate webhook secret
    const secret = crypto.randomBytes(32).toString("hex")

    const supabase = createServiceClient()

    const { data: subscription, error } = await supabase
      .from("webhook_subscriptions")
      .insert({
        org_id,
        url,
        secret,
        events: events || ["pass.pass_paid.v1"],
        description,
        status: "active",
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating subscription:", error)

      // Handle duplicate URL
      if (error.code === "23505") {
        return NextResponse.json({ error: "Webhook URL already registered for this organisation" }, { status: 409 })
      }

      return NextResponse.json({ error: "Failed to create subscription" }, { status: 500 })
    }

    return NextResponse.json(
      {
        subscription: {
          id: subscription.id,
          org_id: subscription.org_id,
          url: subscription.url,
          secret: subscription.secret,
          events: subscription.events,
          status: subscription.status,
          description: subscription.description,
          created_at: subscription.created_at,
        },
      },
      { status: 201 },
    )
  } catch (error) {
    if (error instanceof ZodError) {
      return handleValidationError(error)
    }
    console.error("Unexpected error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
