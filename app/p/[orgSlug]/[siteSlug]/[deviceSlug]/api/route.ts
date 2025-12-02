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
      .from("core.devices")
      .select("id, name, custom_name, custom_description, custom_logo_url, lock_id, site_id, slug, org_id")
      .eq("slug", deviceSlug)
      .maybeSingle()

    console.log("[v0] Device query result:", { device, deviceError })

    if (!device) {
      console.log("[v0] Device not found with slug:", deviceSlug)
      return NextResponse.json({ error: "Device not found" }, { status: 404 })
    }

    const { data: site, error: siteError } = await supabase
      .from("core.sites")
      .select("id, name, slug, org_id")
      .eq("id", device.site_id)
      .single()

    console.log("[v0] Site query result:", { site, siteError })

    if (!site) {
      console.log("[v0] Site not found for device.site_id:", device.site_id)
      return NextResponse.json({ error: "Device not found" }, { status: 404 })
    }

    if (site.slug !== siteSlug) {
      console.log("[v0] Site slug mismatch. Expected:", siteSlug, "Got:", site.slug)
      return NextResponse.json({ error: "Device not found" }, { status: 404 })
    }

    const { data: org, error: orgError } = await supabase
      .from("core.organisations")
      .select("id, name, slug, brand_settings")
      .eq("id", site.org_id)
      .single()

    console.log("[v0] Organization query result:", { org, orgError })

    if (!org) {
      console.log("[v0] Organization not found for site.org_id:", site.org_id)
      return NextResponse.json({ error: "Device not found" }, { status: 404 })
    }

    if (org.slug !== orgSlug) {
      console.log("[v0] Org slug mismatch. Expected:", orgSlug, "Got:", org.slug)
      return NextResponse.json({ error: "Device not found" }, { status: 404 })
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
    console.error("[v0] Access point API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
