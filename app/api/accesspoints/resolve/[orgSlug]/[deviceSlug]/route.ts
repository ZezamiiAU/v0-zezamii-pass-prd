import { type NextRequest, NextResponse } from "next/server"
import { createSchemaServiceClient } from "@/lib/supabase/server"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgSlug: string; deviceSlug: string }> },
) {
  try {
    const { orgSlug, deviceSlug } = await params

    if (!orgSlug || !deviceSlug) {
      return NextResponse.json({ error: "Organization slug and device slug are required" }, { status: 400 })
    }

    const supabase = createSchemaServiceClient("core")

    // Query devices with org slug and device slug
    const { data, error } = await supabase
      .from("devices")
      .select(`
        id,
        name,
        slug,
        slug_is_active,
        custom_name,
        custom_description,
        custom_logo_url,
        org_id,
        site_id,
        organisations!inner(
          id,
          name,
          slug,
          brand_settings,
          billing_email
        ),
        sites(
          id,
          name
        )
      `)
      .eq("organisations.slug", orgSlug)
      .eq("slug", deviceSlug)
      .eq("slug_is_active", true)
      .single()

    if (error || !data) {
      console.error("[v0] Device lookup failed:", error)
      return NextResponse.json({ error: "Device not found or inactive" }, { status: 404 })
    }

    // Extract nested data
    const org = Array.isArray(data.organisations) ? data.organisations[0] : data.organisations
    const site = Array.isArray(data.sites) ? data.sites[0] : data.sites

    // Return formatted response
    return NextResponse.json({
      device_id: data.id,
      device_name: data.name,
      device_slug: data.slug,
      device_custom_name: data.custom_name,
      device_custom_description: data.custom_description,
      device_custom_logo_url: data.custom_logo_url,
      org_id: data.org_id,
      org_name: org?.name,
      org_slug: org?.slug,
      org_brand_settings: org?.brand_settings,
      org_support_email: org?.billing_email,
      org_logo_url: org?.brand_settings?.logo_url,
      site_id: data.site_id,
      site_name: site?.name,
    })
  } catch (error) {
    console.error("[v0] Resolve API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
