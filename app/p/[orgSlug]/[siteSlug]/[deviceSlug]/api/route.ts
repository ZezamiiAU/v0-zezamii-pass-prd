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

    // Step 1: Get the device with site filtering
    const { data: device, error: deviceError } = await supabase
      .from("core.devices")
      .select(
        `
        id,
        name,
        description,
        slug,
        site_id,
        lock_id
      `,
      )
      .eq("slug", deviceSlug)
      .single()

    if (deviceError || !device) {
      console.error("[v0] Device not found:", deviceError)
      return NextResponse.json({ error: "Device not found" }, { status: 404 })
    }

    console.log("[v0] Found device:", device)

    // Step 2: Get the site with slug validation
    const { data: site, error: siteError } = await supabase
      .from("core.sites")
      .select(
        `
        id,
        name,
        slug,
        org_id
      `,
      )
      .eq("id", device.site_id)
      .eq("slug", siteSlug)
      .single()

    if (siteError || !site) {
      console.error("[v0] Site not found or slug mismatch:", siteError)
      return NextResponse.json({ error: "Site not found" }, { status: 404 })
    }

    console.log("[v0] Found site:", site)

    // Step 3: Get the organization with slug validation
    const { data: organization, error: orgError } = await supabase
      .from("core.organisations")
      .select(
        `
        id,
        name,
        slug,
        logo_url
      `,
      )
      .eq("id", site.org_id)
      .eq("slug", orgSlug)
      .single()

    if (orgError || !organization) {
      console.error("[v0] Organization not found or slug mismatch:", orgError)
      return NextResponse.json({ error: "Organization not found" }, { status: 404 })
    }

    console.log("[v0] Found organization:", organization)

    // Return the access point data
    return NextResponse.json({
      organizationId: organization.id,
      organizationName: organization.name,
      organizationLogo: organization.logo_url,
      siteId: site.id,
      siteName: site.name,
      deviceId: device.id,
      deviceName: device.name,
      deviceDescription: device.description,
      lockId: device.lock_id,
    })
  } catch (error) {
    console.error("[v0] Access point API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
