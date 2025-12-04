import { type NextRequest, NextResponse } from "next/server"
import { createSchemaServiceClient } from "@/lib/supabase/server"
import { headers } from "next/headers"
import { rateLimit, getRateLimitHeaders } from "@/lib/rate-limit"
import logger from "@/lib/logger"

export async function POST(request: NextRequest) {
  if (!rateLimit(request, 30, 60000)) {
    const headersObj = getRateLimitHeaders(request, 30)
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: headersObj },
    )
  }

  try {
    const body = await request.json()
    const headersList = await headers()

    const supabase = createSchemaServiceClient("analytics")

    const { error } = await supabase.from("qr_scans").insert({
      device_id: body.deviceId || null,
      qr_instance_id: body.qrInstanceId || null,
      org_id: body.orgId || null,
      user_agent: headersList.get("user-agent") || null,
      ip_address: headersList.get("x-forwarded-for") || headersList.get("x-real-ip") || null,
      source: body.source || "qr",
      scanned_at: new Date().toISOString(),
    })

    if (error) {
      logger.warn({ error: error.message }, "[TrackScan] Failed to insert QR scan tracking")
      // Don't fail the request if tracking fails
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : error }, "[TrackScan] Error in track-scan API")
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
