import { NextResponse } from "next/server"
import { createSchemaServiceClient } from "@/lib/supabase/server"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; siteSlug: string; deviceSlug: string }> },
) {
  try {
    const { orgSlug, siteSlug, deviceSlug } = await params
    const coreDb = createSchemaServiceClient("core")

    console.log("[v0] API Route hit:", { orgSlug, siteSlug, deviceSlug })

    // Get organization
    const { data: org, error: orgError } = await coreDb
      .from("organisations")
      .select("id, name, brand_settings, slug")
      .eq("slug", orgSlug)
      .maybeSingle()

    if (!org) {
      return NextResponse.json(
        { error: "Organization not found", debug: { orgSlug, orgError: orgError?.message } },
        { status: 404 },
      )
    }

    // Get site
    const { data: site, error: siteError } = await coreDb
      .from("sites")
      .select("id, name, slug")
      .eq("slug", siteSlug)
      .eq("org_id", org.id)
      .maybeSingle()

    if (!site) {
      return NextResponse.json(
        { error: "Site not found", debug: { siteSlug, siteError: siteError?.message } },
        { status: 404 },
      )
    }

    // Get device
    const { data: device, error: deviceError } = await coreDb
      .from("devices")
      .select("id, name, custom_name, custom_description, custom_logo_url, lock_id, slug")
      .eq("slug", deviceSlug)
      .eq("site_id", site.id)
      .maybeSingle()

    if (!device) {
      const { data: allDevices } = await coreDb.from("devices").select("slug, name").eq("site_id", site.id)
      return NextResponse.json(
        {
          error: "Device not found",
          debug: { deviceSlug, deviceError: deviceError?.message, availableDevices: allDevices },
        },
        { status: 404 },
      )
    }

    return NextResponse.json({
      organizationId: org.id,
      organizationName: org.name,
      organizationLogo: org.brand_settings?.logo_url || null,
      siteId: site.id,
      siteName: site.name,
      deviceId: device.id,
      deviceName: device.custom_name || device.name,
      deviceDescription: device.custom_description || null,
      deviceLogo: device.custom_logo_url || null,
      lockId: device.lock_id,
    })
  } catch (error) {
    console.error("[v0] API error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 },
    )
  }
}
