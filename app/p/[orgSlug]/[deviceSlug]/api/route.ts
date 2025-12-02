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

  const { data: device, error: deviceError } = await supabase
    .schema("core")
    .from("devices")
    .select("id, name, custom_name, custom_description, custom_logo_url, code, org_id, site_id, slug, slug_is_active")
    .eq("slug", deviceSlug)
    .eq("slug_is_active", true)
    .single()

  if (deviceError || !device) {
    console.error("[v0] API: Device lookup failed:", {
      error: deviceError?.message,
      code: deviceError?.code,
    })
    return NextResponse.json({ error: deviceError?.message || "Access point not found" }, { status: 404 })
  }

  console.log("[v0] API: Found device:", device.id, "site_id:", device.site_id)

  const { data: site, error: siteError } = await supabase
    .schema("core")
    .from("sites")
    .select("id, name, city, state, org_id")
    .eq("id", device.site_id)
    .single()

  if (siteError || !site) {
    console.error("[v0] API: Site lookup failed:", siteError)
    return NextResponse.json({ error: "Site configuration not found" }, { status: 404 })
  }

  console.log("[v0] API: Found site:", site.id, "org_id:", site.org_id)

  const { data: org, error: orgError } = await supabase
    .schema("core")
    .from("organisations")
    .select("id, name, slug, timezone")
    .eq("id", site.org_id)
    .single()

  if (orgError || !org) {
    console.error("[v0] API: Organization lookup failed:", orgError)
    return NextResponse.json({ error: "Organization not found" }, { status: 404 })
  }

  console.log("[v0] API: Found org:", org.id, "slug:", org.slug)

  if (org.slug !== orgSlug) {
    console.error("[v0] API: Organization slug mismatch:", { expected: orgSlug, actual: org.slug })
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
    siteId: site.id,
    siteName: site.name || "Site",
    deviceId: device.id,
    deviceName: device.custom_name || device.name,
    deviceDescription: device.custom_description,
  })
}
