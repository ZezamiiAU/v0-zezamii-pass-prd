import { type NextRequest, NextResponse } from "next/server"
import { createSchemaServiceClient } from "@/lib/supabase/server"
import { rateLimit, getRateLimitHeaders } from "@/lib/rate-limit"
import logger from "@/lib/logger"

type RouteParams = {
  params: Promise<{
    orgSlug: string
    siteSlug: string
    deviceSlug: string
  }>
}

export async function GET(request: NextRequest, context: RouteParams) {
  if (!rateLimit(request, 60, 60000)) {
    const headers = getRateLimitHeaders(request, 60)
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429, headers })
  }

  try {
    const { orgSlug, siteSlug, deviceSlug } = await context.params

    const passDb = createSchemaServiceClient("pass")

    const { data: slugMapping, error: slugError } = await passDb
      .from("accesspoint_slugs")
      .select("org_id, site_id, device_id, is_active")
      .eq("org_slug", orgSlug)
      .eq("site_slug", siteSlug)
      .eq("accesspoint_slug", deviceSlug)
      .eq("is_active", true)
      .maybeSingle()

    if (!slugMapping) {
      return NextResponse.json(
        { error: "Access point not found", debug: { orgSlug, siteSlug, deviceSlug, slugError: slugError?.message } },
        { status: 404 },
      )
    }

    // Now query the actual tables using the resolved IDs
    const coreDb = createSchemaServiceClient("core")

    // Get organization
    const { data: org, error: orgError } = await coreDb
      .from("organisations")
      .select("id, name, brand_settings, slug")
      .eq("id", slugMapping.org_id)
      .maybeSingle()

    if (!org) {
      return NextResponse.json(
        { error: "Organization not found", debug: { orgId: slugMapping.org_id, orgError: orgError?.message } },
        { status: 404 },
      )
    }

    // Get site
    const { data: site, error: siteError } = await coreDb
      .from("sites")
      .select("id, name")
      .eq("id", slugMapping.site_id)
      .maybeSingle()

    if (!site) {
      return NextResponse.json(
        { error: "Site not found", debug: { siteId: slugMapping.site_id, siteError: siteError?.message } },
        { status: 404 },
      )
    }

    // Get device
    const { data: device, error: deviceError } = await coreDb
      .from("devices")
      .select("id, name, custom_name, custom_description, custom_logo_url, slug")
      .eq("id", slugMapping.device_id)
      .maybeSingle()

    if (!device) {
      return NextResponse.json(
        { error: "Device not found", debug: { deviceId: slugMapping.device_id, deviceError: deviceError?.message } },
        { status: 404 },
      )
    }

    const { data: passTypes, error: passTypesError } = await passDb
      .from("pass_types")
      .select("id, name, price_cents, currency, description, duration_minutes, code")
      .eq("org_id", slugMapping.org_id)
      .eq("is_active", true)
      .order("price_cents", { ascending: true })

    if (passTypesError) {
      logger.error({ error: passTypesError.message }, "[DeviceAPI] Error fetching pass types")
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
      passTypes: passTypes || [],
    })
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : error }, "[DeviceAPI] API error")
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 },
    )
  }
}
