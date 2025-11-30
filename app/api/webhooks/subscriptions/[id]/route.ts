import { type NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { validateParams, validateBody, handleValidationError } from "@/lib/utils/validate-request"
import { subscriptionIdParamSchema, webhookSubscriptionUpdateSchema } from "@/lib/schemas/api.schema"
import { ZodError } from "zod"

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await params
    const { subscriptionId: id } = validateParams(
      { subscriptionId: rawId },
      subscriptionIdParamSchema
    )

    const supabase = createServiceClient()

    const { error } = await supabase
      .from("webhook_subscriptions")
      .delete()
      .eq("id", id)

    if (error) {
      console.error("Error deleting subscription:", error)
      return NextResponse.json(
        { error: "Failed to delete subscription" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof ZodError) {
      return handleValidationError(error)
    }
    console.error("Unexpected error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await params
    const { subscriptionId: id } = validateParams(
      { subscriptionId: rawId },
      subscriptionIdParamSchema
    )

    const updates = await validateBody(request, webhookSubscriptionUpdateSchema)
    const updateData: any = { updated_at: new Date().toISOString(), ...updates }

    const supabase = createServiceClient()

    const { data: subscription, error } = await supabase
      .from("webhook_subscriptions")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("Error updating subscription:", error)
      return NextResponse.json(
        { error: "Failed to update subscription" },
        { status: 500 }
      )
    }

    return NextResponse.json({ subscription })
  } catch (error) {
    if (error instanceof ZodError) {
      return handleValidationError(error)
    }
    console.error("Unexpected error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
