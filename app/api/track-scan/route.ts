import { NextResponse } from "next/server"
import { createSchemaServiceClient } from "@/lib/supabase/server"
import { headers } from "next/headers"

export async function POST(request: Request) {
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
      console.error("[v0] Failed to insert QR scan tracking:", error)
      // Don't fail the request if tracking fails
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error in track-scan API:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
