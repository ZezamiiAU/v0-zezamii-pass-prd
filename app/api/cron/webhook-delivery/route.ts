import { type NextRequest, NextResponse } from "next/server"
import processWebhookDeliveries from "@/workers/webhook-delivery-worker"
import logger from "@/lib/logger"

// POST /api/cron/webhook-delivery - Cron endpoint for webhook delivery
// Configure Vercel Cron to call this every 1-5 minutes
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await processWebhookDeliveries()

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : error }, "[Cron] Webhook delivery error")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Allow GET for manual testing in development
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 })
  }

  try {
    await processWebhookDeliveries()
    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : error }, "[Cron] Webhook delivery error")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
