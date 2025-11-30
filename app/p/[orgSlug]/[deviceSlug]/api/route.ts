import { type NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest, context: { params: Promise<{ orgSlug: string; deviceSlug: string }> }) {
  const { orgSlug, deviceSlug } = await context.params
  const searchParams = request.nextUrl.searchParams
  const qr = searchParams.get("qr")
  const source = searchParams.get("source")

  const supabase = createServiceClient()

  console.log("[v0] API: Querying for:", { orgSlug, deviceSlug })

  const { data: accessPoint, error } = await supabase
    .schema("core")
    .from("devices")
    .select(`
      id,
      name,
      custom_name,
      custom_description,
      custom_logo_url,
      code,
      org_id,
      slug,
      slug_is_active,
      floor_id,
      floors:floor_id (
        id,
        building_id,
        buildings:building_id (
          id,
          site_id,
          sites:site_id (
            id,
            name,
            city,
            state,
            org_id,
            organisations:org_id (
              id,
              name,
              slug,
              timezone
            )
          )
        )
      )
    `)
    .eq("slug", deviceSlug)
    .eq("slug_is_active", true)
    .eq("floors.buildings.sites.organisations.slug", orgSlug)
    .single()

  if (error || !accessPoint) {
    console.error("[v0] API: Access point lookup failed:", {
      error: error?.message,
      code: error?.code,
    })

    return NextResponse.json({ error: error?.message || "Access point not found" }, { status: 404 })
  }

  const floor = Array.isArray(accessPoint.floors) ? accessPoint.floors[0] : accessPoint.floors
  const building = floor && (Array.isArray(floor.buildings) ? floor.buildings[0] : floor.buildings)
  const site = building && (Array.isArray(building.sites) ? building.sites[0] : building.sites)
  const org = site && (Array.isArray(site.organisations) ? site.organisations[0] : site.organisations)

  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 })
  }

  if (qr) {
    try {
      await supabase
        .schema("analytics")
        .from("qr_scans")
        .insert({
          qr_instance_id: qr,
          device_id: accessPoint.id,
          org_id: accessPoint.org_id,
          source: source || "qr",
          scanned_at: new Date().toISOString(),
        })
      console.log("[v0] API: QR scan tracked:", qr)
    } catch (qrError) {
      console.error("[v0] API: QR tracking failed (non-fatal):", qrError)
    }
  }

  return NextResponse.json({
    organizationId: accessPoint.org_id,
    organizationName: org.name || "Organization",
    organizationLogo: accessPoint.custom_logo_url,
    siteId: site?.id,
    siteName: site?.name || "Site",
    deviceId: accessPoint.id,
    deviceName: accessPoint.custom_name || accessPoint.name,
    deviceDescription: accessPoint.custom_description,
  })
}
