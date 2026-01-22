import { createServiceClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { buildRoomsPayload, createRoomsReservation } from "@/lib/integrations/rooms-event-hub"

/**
 * GET /api/test/rooms-payload
 * 
 * Generates a sample Rooms API payload for testing.
 * Query params:
 *   - org: org slug (default: griffith-boat-club)
 *   - device: device slug (default: gate-entry)
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const orgSlug = searchParams.get("org") || "griffith-boat-club"
  const deviceSlug = searchParams.get("device") || "gate-entry"

  const supabase = createServiceClient()
  const coreDb = supabase.schema("core")

  // Find the organisation
  const { data: org, error: orgError } = await coreDb
    .from("organisations")
    .select("id, slug, name, zezamii_property_id")
    .eq("slug", orgSlug)
    .single()

  if (orgError || !org) {
    return NextResponse.json({ error: `Organisation not found: ${orgSlug}`, details: orgError }, { status: 404 })
  }

  // Find device by slug within this org
  const { data: device, error: deviceError } = await coreDb
    .from("devices")
    .select("id, slug, name, site_id, zezamii_room_id")
    .eq("org_id", org.id)
    .eq("slug", deviceSlug)
    .single()

  if (deviceError || !device) {
    // List available devices for this org
    const { data: availableDevices } = await coreDb
      .from("devices")
      .select("slug, name")
      .eq("org_id", org.id)
      .not("slug", "is", null)
      .limit(10)

    return NextResponse.json({
      error: `Device not found: ${deviceSlug}`,
      availableDevices: availableDevices?.map(d => ({ slug: d.slug, name: d.name })) || [],
      details: deviceError
    }, { status: 404 })
  }

  // Get site info
  const { data: site, error: siteError } = await coreDb
    .from("sites")
    .select("id, slug, name, timezone")
    .eq("id", device.site_id)
    .single()

  if (siteError || !site) {
    return NextResponse.json({ error: `Site not found for device`, details: siteError }, { status: 404 })
  }

  // Build the slug path
  const slugPath = `${org.slug}/${site.slug}/${device.slug}`

  // Create a mock pass for testing
  const mockPassId = "00000000-0000-0000-0000-000000000001"
  const now = new Date()
  const validFrom = new Date(now)
  validFrom.setHours(0, 0, 0, 0)
  const validTo = new Date(validFrom)
  validTo.setDate(validTo.getDate() + 1)
  validTo.setHours(23, 59, 59, 999)

  // Build the Rooms payload
  const roomsPayload = buildRoomsPayload({
    siteId: site.id,
    passId: mockPassId,
    validFrom: validFrom.toISOString(),
    validTo: validTo.toISOString(),
    fullName: "Test User",
    email: "test@example.com",
    phone: "+61400000000",
    slugPath,
    status: "Confirmed",
  })

  // Get integration config
  const { data: integration } = await coreDb
    .from("integrations")
    .select("config, credentials")
    .eq("organisation_id", org.id)
    .eq("integration_type", "rooms")
    .eq("status", "active")
    .single()

  const baseUrl = integration?.config?.base_url || "NOT_CONFIGURED"
  const webhookPath = integration?.config?.webhook_path || "/api/v1/reservations"

  return NextResponse.json({
    info: {
      organisation: { id: org.id, slug: org.slug, name: org.name, zezamiiPropertyId: org.zezamii_property_id },
      site: { id: site.id, slug: site.slug, name: site.name, timezone: site.timezone },
      device: { id: device.id, slug: device.slug, name: device.name, zezamiiRoomId: device.zezamii_room_id },
      slugPath,
    },
    endpoint: {
      url: `${baseUrl}${webhookPath}`,
      method: "POST",
    },
    payload: roomsPayload,
    curlCommand: `curl -X POST "${baseUrl}${webhookPath}" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '${JSON.stringify(roomsPayload, null, 2)}'`,
    testCommand: `curl -X POST "/api/test/rooms-payload?org=${orgSlug}&device=${deviceSlug}" -H "Content-Type: application/json"`
  })
}

/**
 * POST /api/test/rooms-payload
 * 
 * Actually calls the Rooms API with a test payload.
 * Query params:
 *   - org: org slug (default: griffith-boat-club)
 *   - device: device slug (default: gate-entry)
 * 
 * Optional body:
 *   - email: guest email (default: test@example.com)
 *   - phone: guest phone (default: +61400000000)
 *   - fullName: guest name (default: Test User)
 */
export async function POST(request) {
  const { searchParams } = new URL(request.url)
  const orgSlug = searchParams.get("org") || "griffith-boat-club"
  const deviceSlug = searchParams.get("device") || "gate-entry"

  let body = {}
  try {
    body = await request.json()
  } catch (e) {
    // Empty body is fine
  }

  const supabase = createServiceClient()
  const coreDb = supabase.schema("core")

  // Find the organisation
  const { data: org, error: orgError } = await coreDb
    .from("organisations")
    .select("id, slug, name")
    .eq("slug", orgSlug)
    .single()

  if (orgError || !org) {
    return NextResponse.json({ error: `Organisation not found: ${orgSlug}` }, { status: 404 })
  }

  // Find device by slug within this org
  const { data: device, error: deviceError } = await coreDb
    .from("devices")
    .select("id, slug, name, site_id")
    .eq("org_id", org.id)
    .eq("slug", deviceSlug)
    .single()

  if (deviceError || !device) {
    const { data: availableDevices } = await coreDb
      .from("devices")
      .select("slug, name")
      .eq("org_id", org.id)
      .not("slug", "is", null)
      .limit(10)

    return NextResponse.json({
      error: `Device not found: ${deviceSlug}`,
      availableDevices: availableDevices?.map(d => ({ slug: d.slug, name: d.name })) || [],
    }, { status: 404 })
  }

  // Get site info
  const { data: site, error: siteError } = await coreDb
    .from("sites")
    .select("id, slug, name, timezone")
    .eq("id", device.site_id)
    .single()

  if (siteError || !site) {
    return NextResponse.json({ error: `Site not found for device` }, { status: 404 })
  }

  // Build the slug path
  const slugPath = `${org.slug}/${site.slug}/${device.slug}`

  // Create a test pass ID (use provided or generate)
  const testPassId = body.passId || crypto.randomUUID()
  const now = new Date()
  const validFrom = new Date(now)
  validFrom.setHours(0, 0, 0, 0)
  const validTo = new Date(validFrom)
  validTo.setDate(validTo.getDate() + 1)
  validTo.setHours(23, 59, 59, 999)

  // Build the Rooms payload
  const roomsPayload = buildRoomsPayload({
    siteId: site.id,
    passId: testPassId,
    validFrom: validFrom.toISOString(),
    validTo: validTo.toISOString(),
    fullName: body.fullName || "Test User",
    email: body.email || "test@example.com",
    phone: body.phone || "+61400000000",
    slugPath,
    status: "Confirmed",
  })

  console.log("[v0] Calling Rooms API with payload:", JSON.stringify(roomsPayload, null, 2))

  // Actually call the Rooms API
  const result = await createRoomsReservation(org.id, roomsPayload)

  console.log("[v0] Rooms API result:", JSON.stringify(result, null, 2))

  return NextResponse.json({
    test: {
      organisation: org.slug,
      site: site.slug,
      device: device.slug,
      slugPath,
      passId: testPassId,
    },
    payload: roomsPayload,
    result,
  }, { status: result.success ? 200 : 500 })
}
