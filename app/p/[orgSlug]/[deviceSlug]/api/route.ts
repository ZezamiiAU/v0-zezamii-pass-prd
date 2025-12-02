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

  // First, get the device with basic joins
  const { data: devices, error: deviceError } = await supabase
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
      floor_id
    `)
    .eq("slug", deviceSlug)
    .eq("slug_is_active", true)

  if (deviceError || !devices || devices.length === 0) {
    console.error("[v0] API: Device lookup failed:", {
      error: deviceError?.message,
      code: deviceError?.code,
    })
    return NextResponse.json({ error: deviceError?.message || "Access point not found" }, { status: 404 })
  }

  const device = devices[0]

  // Then, get the floor → building → site → org chain
  const { data: floor, error: floorError } = await supabase
    .schema("core")
    .from("floors")
    .select(`
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
    `)
    .eq("id", device.floor_id)
    .single()

  if (floorError || !floor) {
    console.error("[v0] API: Floor lookup failed:", floorError)
    return NextResponse.json({ error: "Site configuration not found" }, { status: 404 })
  }

  const building = floor.buildings
  const site = building?.sites
  const org = site?.organisations

  // Verify the org slug matches
  if (!org || org.slug !== orgSlug) {
    console.error("[v0] API: Organization slug mismatch:", { expected: orgSlug, actual: org?.slug })
    return NextResponse.json({ error: "Access point not found" }, { status: 404 })
  }

  // Track QR scan if present
  if (qr) {
    try {
      await supabase
        .schema("analytics")
        .from("qr_scans")
        .insert({
          qr_instance_id: qr,
          device_id: device.id,
          org_id: device.org_id,
          source: source || "qr",
          scanned_at: new Date().toISOString(),
        })
      console.log("[v0] API: QR scan tracked:", qr)
    } catch (qrError) {
      console.error("[v0] API: QR tracking failed (non-fatal):", qrError)
    }
  }

  return NextResponse.json({
    organizationId: device.org_id,
    organizationName: org.name || "Organization",
    organizationLogo: device.custom_logo_url,
    siteId: site?.id,
    siteName: site?.name || "Site",
    deviceId: device.id,
    deviceName: device.custom_name || device.name,
    deviceDescription: device.custom_description,
  })
}
