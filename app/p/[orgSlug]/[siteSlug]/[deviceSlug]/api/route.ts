import { type NextRequest, NextResponse } from "next/server"
import { createSchemaServiceClient } from "@/lib/supabase/server"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ orgSlug: string; siteSlug: string; deviceSlug: string }> },
) {
  try {
    const coreDb = createSchemaServiceClient("core")
    const { orgSlug, siteSlug, deviceSlug } = await context.params

    console.log("[v0] Fetching device:", { orgSlug, siteSlug, deviceSlug })

    // Step 1: Get organization by slug
    const { data: org, error: orgError } = await coreDb
      .from("organisations")
      .select("id, name, brand_settings, slug")
      .eq("slug", orgSlug)
      .maybeSingle()

    console.log("[v0] Organization query result:", { org, orgError, searchedSlug: orgSlug })

    if (orgError || !org) {
      console.log("[v0] Organization not found:", orgSlug, orgError)
      return NextResponse.json(
        {
          error: "Organization not found",
          debug: {
            searchedSlug: orgSlug,
            error: orgError?.message,
          },
        },
        { status: 404 },
      )
    }

    // Step 2: Get site by slug and org_id
    const { data: site, error: siteError } = await coreDb
      .from("sites")
      .select("id, name, slug")
      .eq("slug", siteSlug)
      .eq("org_id", org.id)
      .maybeSingle()

    console.log("[v0] Site query result:", { site, siteError, searchedSlug: siteSlug })

    if (siteError || !site) {
      console.log("[v0] Site not found:", siteSlug, siteError)
      return NextResponse.json(
        {
          error: "Site not found",
          debug: { searchedSlug: siteSlug, error: siteError?.message },
        },
        { status: 404 },
      )
    }

    // Step 3: Get device by slug and site_id
    const { data: allDevices } = await coreDb.from("devices").select("id, slug, name, active").eq("site_id", site.id)

    console.log("[v0] All devices for site:", allDevices)

    const { data: device, error: deviceError } = await coreDb
      .from("devices")
      .select("id, name, custom_name, custom_description, custom_logo_url, lock_id, slug, active")
      .eq("slug", deviceSlug)
      .eq("site_id", site.id)
      .maybeSingle()

    console.log("[v0] Device query result:", { device, deviceError, searchedSlug: deviceSlug })

    if (deviceError || !device) {
      console.log("[v0] Device not found:", deviceSlug, deviceError)
      return NextResponse.json(
        {
          error: "Device not found",
          debug: {
            searchedSlug: deviceSlug,
            error: deviceError?.message,
            availableDevices: allDevices?.map((d) => ({ slug: d.slug, name: d.name, active: d.active })),
          },
        },
        { status: 404 },
      )
    }

    console.log("[v0] Device found successfully:", device.id)

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
    console.error("[v0] Access point API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
