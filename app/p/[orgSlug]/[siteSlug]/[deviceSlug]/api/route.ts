import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ orgSlug: string; siteSlug: string; deviceSlug: string }> },
) {
  try {
    const supabase = await createClient()
    const { orgSlug, siteSlug, deviceSlug } = await context.params

    console.log("[v0] Fetching device:", { orgSlug, siteSlug, deviceSlug })

    const { data: device, error: deviceError } = await supabase
      .from("core.qr_ready_devices")
      .select("*")
      .eq("org_slug", orgSlug)
      .eq("site_slug", siteSlug)
      .eq("device_slug", deviceSlug)
      .eq("is_qr_ready", true)
      .maybeSingle()

    console.log("[v0] Device query result:", { device, deviceError })

    if (deviceError) {
      console.error("[v0] Database error:", deviceError)
      return NextResponse.json({ error: "Database error" }, { status: 500 })
    }

    if (!device) {
      console.log("[v0] Device not found with slugs:", { orgSlug, siteSlug, deviceSlug })
      return NextResponse.json({ error: "Device not found" }, { status: 404 })
    }

    return NextResponse.json({
      organizationId: device.org_id,
      organizationName: device.org_name,
      organizationLogo: device.org_brand_settings?.logo_url || null,
      siteId: device.site_id,
      siteName: device.site_name,
      deviceId: device.device_id,
      deviceName: device.device_custom_name || device.device_name,
      deviceDescription: device.device_custom_description || null,
      deviceLogo: device.device_custom_logo_url || null,
      lockId: device.lock_id,
    })
  } catch (error) {
    console.error("[v0] Access point API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
