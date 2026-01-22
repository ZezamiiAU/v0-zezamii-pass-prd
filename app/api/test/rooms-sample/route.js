import { createServiceClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

/**
 * GET /api/test/rooms-sample
 * 
 * Returns a sample Rooms API payload for Griffith Boat Club with real database values.
 * This endpoint does NOT call Rooms - it just generates the payload for testing.
 */
export async function GET() {
  const supabase = createServiceClient()
  const coreDb = supabase.schema("core")

  // Find Griffith Boat Club
  const { data: org, error: orgError } = await coreDb
    .from("organisations")
    .select("id, slug, name, zezamii_property_id")
    .ilike("slug", "%griffith%")
    .single()

  if (orgError || !org) {
    // List available orgs
    const { data: orgs } = await coreDb
      .from("organisations")
      .select("slug, name")
      .not("slug", "is", null)
      .limit(10)

    return NextResponse.json({
      error: "Griffith Boat Club not found",
      availableOrgs: orgs?.map(o => ({ slug: o.slug, name: o.name })) || [],
    }, { status: 404 })
  }

  // Find devices for this org
  const { data: devices, error: devicesError } = await coreDb
    .from("devices")
    .select("id, slug, name, site_id, zezamii_room_id")
    .eq("org_id", org.id)
    .not("slug", "is", null)
    .limit(10)

  if (devicesError || !devices || devices.length === 0) {
    return NextResponse.json({
      error: "No devices found for Griffith Boat Club",
      org,
    }, { status: 404 })
  }

  // Get site info for first device
  const device = devices[0]
  const { data: site } = await coreDb
    .from("sites")
    .select("id, slug, name, timezone")
    .eq("id", device.site_id)
    .single()

  // Build slug path
  const slugPath = `${org.slug}/${site?.slug || "site"}/${device.slug}`

  // Generate a test pass ID
  const testPassId = crypto.randomUUID()
  
  // Generate dates (today midnight to tomorrow 11:59pm in site timezone)
  const now = new Date()
  const validFrom = new Date(now)
  validFrom.setHours(0, 0, 0, 0)
  const validTo = new Date(validFrom)
  validTo.setDate(validTo.getDate() + 1)
  validTo.setHours(23, 59, 59, 999)

  // Build the exact payload that would be sent to Rooms
  const roomsPayload = {
    propertyId: site?.id || device.site_id,
    reservationId: testPassId,
    arrivalDate: validFrom.toISOString(),
    departureDate: validTo.toISOString(),
    guestId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890", // Deterministic test UUID
    guestFirstName: "Test",
    guestLastName: "User",
    guestEmail: "test@example.com",
    guestPhone: "+61400000000",
    roomId: slugPath,
    roomName: slugPath,
    status: "Confirmed",
  }

  return NextResponse.json({
    message: "Sample Rooms API payload for Griffith Boat Club",
    
    // Database info
    database: {
      organisation: {
        id: org.id,
        slug: org.slug,
        name: org.name,
        zezamiiPropertyId: org.zezamii_property_id,
      },
      site: site ? {
        id: site.id,
        slug: site.slug,
        name: site.name,
        timezone: site.timezone,
      } : null,
      device: {
        id: device.id,
        slug: device.slug,
        name: device.name,
        zezamiiRoomId: device.zezamii_room_id,
      },
      allDevices: devices.map(d => ({
        id: d.id,
        slug: d.slug,
        name: d.name,
      })),
    },

    // The payload to send to Rooms API
    roomsPayload,
    
    // Test pass ID for webhook testing
    testPassId,
    slugPath,

    // Instructions for portal dev
    portalWebhookTest: {
      description: "To test the webhook, POST to /api/webhooks/rooms/pin with this payload:",
      endpoint: "POST /api/webhooks/rooms/pin",
      payload: {
        event: "pin.created",
        data: {
          reservationId: testPassId,
          pinCode: "1234",
          validFrom: validFrom.toISOString(),
          validUntil: validTo.toISOString(),
        },
      },
      note: "First create a pass.lock_codes record with provider='rooms' and provider_ref=reservationId",
    },
  })
}
