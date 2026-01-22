# PRD: Rooms PIN Webhook Integration

## Document Info
- **Version**: 4.0
- **Date**: January 2026
- **Author**: Zezamii Pass Team
- **Status**: Implemented

---

## 1. Executive Summary

This document describes the asynchronous PIN provisioning architecture where:
1. **PWA calls Rooms API** with `status: "Pending"` BEFORE payment
2. **User completes Stripe payment**
3. **Stripe webhook** calls Rooms API with `status: "Confirmed"` 
4. **Rooms generates PIN** and POSTs to **Portal webhook** (`/api/webhooks/rooms/pin`)
5. **Portal stores PIN** in `pass.lock_codes` table
6. **PWA polls** `by-session` API (3 retries, 8-second delays) to fetch PIN from `lock_codes`
7. **Fallback to backup code** if no PIN received after retries

**Key Point:** Rooms API does NOT return a PIN in its response. PIN is delivered asynchronously via Portal webhook.

### Architecture Flow

```
┌─────────┐      ┌─────────┐      ┌─────────┐      ┌─────────┐      ┌─────────┐
│   PWA   │      │ Stripe  │      │  Rooms  │      │ Portal  │      │   DB    │
└────┬────┘      └────┬────┘      └────┬────┘      └────┬────┘      └────┬────┘
     │                │                │                │                │
     │ 1. User clicks "Continue" (POST /api/payment-intents)             │
     │───────────────────────────────────────────────────────────────────>│
     │                │                │                │                │
     │ 2. Create pass in database                                        │
     │───────────────────────────────────────────────────────────────────>│
     │                │                │                │                │
     │ 3. POST reservation (status: "Pending") - NO PIN RETURNED         │
     │────────────────────────────────>│                │                │
     │                │                │                │                │
     │ 4. Create Stripe Payment Intent │                │                │
     │───────────────>│                │                │                │
     │                │                │                │                │
     │ 5. User enters card + pays      │                │                │
     │───────────────>│                │                │                │
     │                │                │                │                │
     │                │ 6. Stripe webhook (checkout.session.completed)   │
     │                │───────────────────────────────────────────────────>
     │                │                │                │                │
     │                │ 7. POST reservation (status: "Confirmed")        │
     │                │────────────────>                │                │
     │                │                │                │                │
     │                │                │ 8. Generate PIN                 │
     │                │                │────────────────────────────────>│
     │                │                │                │                │
     │                │                │ 9. POST /api/webhooks/rooms/pin │
     │                │                │───────────────>│                │
     │                │                │                │                │
     │                │                │                │ 10. Store PIN  │
     │                │                │                │    in lock_codes
     │                │                │                │───────────────>│
     │                │                │                │                │
     │ 11. Success page polls GET /api/passes/by-session (3x, 8s delays) │
     │───────────────────────────────────────────────────────────────────>│
     │                │                │                │                │
     │ 12. Return PIN from lock_codes (pinSource: "rooms")               │
     │<──────────────────────────────────────────────────────────────────│
     │                │                │                │                │
     │ 13. Display PIN to user         │                │                │
     │                │                │                │                │
```

### Fallback Flow (No PIN received)

```
     │ 11. Success page polls 3 times (8s each = 24s total)              │
     │───────────────────────────────────────────────────────────────────>│
     │                │                │                │                │
     │ 12. No PIN found after retries                                    │
     │<──────────────────────────────────────────────────────────────────│
     │                │                │                │                │
     │ 13. Display backup code (from Stripe metadata)                    │
     │                │                │                │                │
```

---

## 1.1 Key Field Mappings (Portal Dev Reference)

| What You Might Expect | Actual Column/Table |
|-----|-----|
| `valid_from` / `valid_until` on lock_codes | `starts_at` / `ends_at` |
| `valid_until` on passes | `valid_to` |
| `supabase.from('lock_codes')` | `supabase.schema('pass').from('lock_codes')` |
| `roomId` in Rooms API payload | Combined slug: `org-slug/site-slug/device-slug` |
| Backup code in site_settings | `pass.backup_pincodes` table (rotates fortnightly) |

### roomId Format

The `roomId` field sent to the Rooms API uses the **combined slug path** format:

```
{org-slug}/{site-slug}/{device-slug}
```

Example: `griffith-boat-club/marina/main-gate`

This value is also stored in `core.devices.zezamii_room_id` for reference. Migration script `039-update-zezamii-room-id-to-slug.sql` updates existing devices.

**Required Fields When Creating lock_code:**

```javascript
{
  pass_id: pass.id,
  status: 'pending',       // 'pending' | 'active' | 'expired' | 'cancelled'
  provider: 'rooms',       // Required
  provider_ref: pass.id,   // For tracking - use pass_id or reservation_id
  starts_at: startDate,    // NOT valid_from
  ends_at: endDate,        // NOT valid_until
}
```

**When Webhook Receives PIN:**

```javascript
await supabase
  .schema('pass')
  .from('lock_codes')
  .update({
    code: pinCode,
    status: 'active',
    webhook_received_at: new Date().toISOString(),
  })
  .eq('provider', 'rooms')
  .eq('provider_ref', reservationId)  // Match by reservation ID
```

---

## 2. Benefits

| Aspect | Previous | New (Webhook) |
|--------|----------|---------------|
| **Timeout risk** | PWA waits 30s for Rooms response | Rooms has unlimited time to process |
| **Retry handling** | Complex retry logic in PWA | Rooms handles retries internally |
| **Error recovery** | Hard - user sees failure | Easy - PIN arrives later, user refreshes |
| **Scalability** | Each PWA instance polls Rooms | Single webhook receives all PINs |
| **Offline locks** | Immediate failure | PIN delivered when lock comes online |

---

## 3. Database Schema

### Existing Table: `pass.lock_codes`

Already exists with these columns:
```sql
pass.lock_codes:
  - id: uuid
  - pass_id: uuid
  - code: text                    -- The PIN code
  - code_hmac: text               -- HMAC for verification
  - starts_at: timestamp          -- When code becomes valid
  - ends_at: timestamp            -- When code expires
  - provider: text                -- "rooms" or "backup"
  - provider_ref: text            -- Rooms reservation ID
  - status: text                  -- "pending", "active", "used", "expired"
  - created_at: timestamp
  - used_at: timestamp
  - attempt_count: integer
```

### Usage

When PWA creates a reservation:
1. Insert `lock_codes` row with `status = 'pending'`, `code = NULL`
2. Rooms webhook updates row with `code = <PIN>`, `status = 'active'`
3. PWA polls `lock_codes` for `code IS NOT NULL`

---

## 4. Webhook Endpoint Specification

### Endpoint

```
POST /api/webhooks/rooms/pin
```

**Location:** This endpoint should be created in the **Portal** application (not PWA), as it handles system-level callbacks.

Alternatively, if the PWA needs to be self-contained:
```
POST /api/webhooks/rooms/pin  (in PWA)
```

### Authentication

**Option A: Shared Secret (Recommended)**
```
Authorization: Bearer <ROOMS_WEBHOOK_SECRET>
```

**Option B: HMAC Signature**
```
X-Rooms-Signature: sha256=<hmac_of_body>
```

### Request Payload (from Rooms)

```json
{
  "event": "pin.created",
  "timestamp": "2026-01-21T10:30:00Z",
  "data": {
    "reservationId": "483876d8-0e8b-4d34-bef6-00240e89cc58",
    "propertyId": "02140c92-06b9-4967-9cb3-fcea633339ed",
    "roomId": "8b2299fe-05cf-4432-97d8-a7a97714127a",
    "pinCode": "4829",
    "validFrom": "2025-11-13T00:00:00Z",
    "validUntil": "2025-11-14T00:00:00Z",
    "guestName": "John Smith"
  }
}
```

### Response

**Success (200):**
```json
{
  "success": true,
  "message": "PIN stored successfully"
}
```

**Not Found (404):**
```json
{
  "success": false,
  "error": "RESERVATION_NOT_FOUND",
  "message": "No pending pass found for reservation 483876d8-..."
}
```

**Auth Error (401):**
```json
{
  "success": false,
  "error": "UNAUTHORIZED"
}
```

---

## 5. Webhook Handler Implementation

### Route: `/app/api/webhooks/rooms/pin/route.ts`

```typescript
import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import logger from "@/lib/logger"
import { z } from "zod"

// Validate webhook payload
const RoomsPinWebhook = z.object({
  event: z.literal("pin.created"),
  timestamp: z.string(),
  data: z.object({
    reservationId: z.string().uuid(),
    propertyId: z.string(),
    roomId: z.string(),
    pinCode: z.string().min(4).max(6),
    validFrom: z.string(),
    validUntil: z.string(),
    guestName: z.string().optional(),
  }),
})

export async function POST(request: Request) {
  const startTime = Date.now()

  try {
    // Verify webhook authentication
    const authHeader = request.headers.get("authorization")
    const expectedSecret = process.env.ROOMS_WEBHOOK_SECRET

    if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
      logger.warn({ authHeader: authHeader?.substring(0, 20) }, "Rooms webhook: unauthorized request")
      return NextResponse.json(
        { success: false, error: "UNAUTHORIZED" },
        { status: 401 }
      )
    }

    // Parse and validate payload
    const body = await request.json()
    const validation = RoomsPinWebhook.safeParse(body)

    if (!validation.success) {
      logger.warn({ errors: validation.error.errors }, "Rooms webhook: invalid payload")
      return NextResponse.json(
        { success: false, error: "INVALID_PAYLOAD", details: validation.error.errors },
        { status: 400 }
      )
    }

    const { data } = validation.data
    const passId = data.reservationId // reservationId IS our pass_id

    logger.info({ 
      passId, 
      roomId: data.roomId,
      pinCode: data.pinCode.substring(0, 2) + "**" 
    }, "Rooms webhook: PIN received")

    // Update lock_codes with the PIN
    const supabase = createServiceClient()
    
    // First check if we have a pending lock_code for this pass
    const { data: existingCode, error: fetchError } = await supabase
      .schema("pass")
      .from("lock_codes")
      .select("id, status")
      .eq("pass_id", passId)
      .eq("provider", "rooms")
      .maybeSingle()

    if (fetchError) {
      logger.error({ passId, error: fetchError.message }, "Rooms webhook: database error")
      return NextResponse.json(
        { success: false, error: "DATABASE_ERROR" },
        { status: 500 }
      )
    }

    if (existingCode) {
      // Update existing record
      const { error: updateError } = await supabase
        .schema("pass")
        .from("lock_codes")
        .update({
          code: data.pinCode,
          status: "active",
          starts_at: data.validFrom,
          ends_at: data.validUntil,
        })
        .eq("id", existingCode.id)

      if (updateError) {
        logger.error({ passId, error: updateError.message }, "Rooms webhook: failed to update lock_code")
        return NextResponse.json(
          { success: false, error: "UPDATE_FAILED" },
          { status: 500 }
        )
      }
    } else {
      // Insert new record (in case webhook arrives before PWA created pending record)
      const { error: insertError } = await supabase
        .schema("pass")
        .from("lock_codes")
        .insert({
          pass_id: passId,
          code: data.pinCode,
          provider: "rooms",
          provider_ref: data.reservationId,
          status: "active",
          starts_at: data.validFrom,
          ends_at: data.validUntil,
        })

      if (insertError) {
        // Could be duplicate - that's OK
        if (insertError.code !== "23505") {
          logger.error({ passId, error: insertError.message }, "Rooms webhook: failed to insert lock_code")
          return NextResponse.json(
            { success: false, error: "INSERT_FAILED" },
            { status: 500 }
          )
        }
      }
    }

    // Also update the pass status if needed
    await supabase
      .schema("pass")
      .from("passes")
      .update({ status: "active" })
      .eq("id", passId)
      .eq("status", "pending")

    const duration = Date.now() - startTime
    logger.info({ passId, duration }, "Rooms webhook: PIN stored successfully")

    return NextResponse.json({
      success: true,
      message: "PIN stored successfully",
    })

  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? error.message : String(error) 
    }, "Rooms webhook: unexpected error")

    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR" },
      { status: 500 }
    )
  }
}
```

---

## 6. PWA Implementation (Current State)

### 6.1 Rooms API Call Points

**Location 1: `/api/payment-intents/route.ts`** (BEFORE payment)
```typescript
// Called when user clicks "Continue" - before Stripe payment
const roomsPayload = buildRoomsPayload({
  siteId,
  passId: pass.id,
  validFrom,
  validTo,
  fullName,
  email,
  phone,
  slugPath,  // e.g. "griffith-boat/club/gate-entry"
  status: "Pending",  // Pending until payment succeeds
})

const roomsResult = await createRoomsReservation(passType.org_id, roomsPayload)
// Note: roomsResult does NOT contain a pincode - PIN arrives via Portal webhook
```

**Location 2: `/api/webhooks/stripe/route.ts`** (AFTER payment)
```typescript
// Called by Stripe webhook after checkout.session.completed
const roomsPayload = buildRoomsPayload({
  // ... same fields ...
  status: "Confirmed",  // Payment succeeded
})

const roomsResult = await createRoomsReservation(org.id, roomsPayload)
// Note: roomsResult does NOT contain a pincode - PIN arrives via Portal webhook
```

### 6.2 Rooms Response Type

```typescript
// lib/integrations/rooms-event-hub.ts
export interface RoomsReservationResponse {
  success: boolean
  reservationId?: string  // The pass_id we sent
  error?: string
  statusCode?: number
  // Note: PIN is NOT returned - it's sent async via Portal webhook
}
```

### 6.3 Success Page Polling (3 retries, 8-second delays)

**Location: `/app/success/page.tsx`**

```typescript
let pinRetryCount = 0
const MAX_PIN_RETRIES = 3
const PIN_RETRY_DELAY_MS = 8000  // 8 seconds between retries

const fetchPassDetails = async () => {
  const response = await fetch(`/api/passes/by-session?${queryParam}`)
  const data = await response.json()
  
  // Check if we got a Rooms PIN code
  const hasRoomsPin = data.code && data.pinSource === "rooms"
  
  // If no Rooms PIN yet and we haven't exhausted retries, poll again
  if (!hasRoomsPin && pinRetryCount < MAX_PIN_RETRIES) {
    pinRetryCount++
    console.log(`PIN retry ${pinRetryCount}/${MAX_PIN_RETRIES}, waiting ${PIN_RETRY_DELAY_MS}ms`)
    
    // Schedule retry
    setTimeout(() => fetchPassDetails(), PIN_RETRY_DELAY_MS)
    return
  }
  
  // After retries exhausted, use backup code if no Rooms PIN
  const codeToDisplay = data.code || data.backupCode
  setDisplayedCode(codeToDisplay)
  setPinSource(data.pinSource || "backup")
}
```

### 6.4 PIN Source Determination

**Location: `/api/passes/by-session/route.ts`**

```typescript
// Determine pin source from lock_codes provider field
const lockCodeRecord = await getLockCodeByPassId(pass.id)
lockCode = lockCodeRecord?.code || null

if (lockCodeRecord?.provider === "rooms") {
  pinSource = "rooms"
} else if (lockCode) {
  pinSource = "backup"
}

// Response includes:
return {
  code: lockCode,           // PIN from lock_codes table (or null)
  backupCode: backupCode,   // Backup from Stripe metadata
  pinSource: pinSource,     // "rooms" or "backup"
}
```

---

## 7. Environment Variables

### PWA
```env
# No longer needed - PIN comes via database, not API response
# ROOMS_API_URL=https://sender.rooms.zezamii.com
```

### Portal / Webhook Receiver
```env
# Secret for authenticating Rooms webhook calls
ROOMS_WEBHOOK_SECRET=your-secure-random-string-here
```

### Rooms System (configure on their side)
```
Webhook URL: https://portal.zezamii.com/api/webhooks/rooms/pin
Authorization: Bearer <ROOMS_WEBHOOK_SECRET>
Events: pin.created
```

---

## 8. Backup Code Strategy

With the webhook approach, backup codes become more important as a fallback when:
1. Rooms webhook is delayed (gateway offline, queue backlog)
2. Rooms webhook fails permanently (configuration error)
3. Lock never comes online

### Backup Code Flow

```
1. PWA creates reservation → Rooms API
2. PWA creates pending lock_code → Database
3. PWA displays "Generating PIN..." with countdown
4. Poll database every 2s for 30s
5. If PIN arrives via webhook → Display PIN (source: "rooms")
6. If timeout → Assign backup code → Display backup (source: "backup")
```

### Backup Code Assignment (Separate PRD)

See `PRD_BACKUP_CODE_POOL.md` for the backup code pool system that provides unique 5-digit codes.

---

## 9. Monitoring & Alerting

### Metrics to Track

| Metric | Threshold | Alert |
|--------|-----------|-------|
| Webhook latency (reservation → PIN) | > 30s | Warning |
| Webhook failures (4xx/5xx) | > 5/hour | Warning |
| Pending lock_codes older than 5 min | > 10 | Warning |
| Backup code usage rate | > 10% | Warning |

### Logging

```typescript
// Log all webhook receipts
logger.info({
  event: "rooms_pin_webhook_received",
  passId,
  latency_ms: Date.now() - new Date(timestamp).getTime(),
  pinLastDigits: pinCode.slice(-2)
})

// Log PIN delivery to user
logger.info({
  event: "pin_delivered_to_user",
  passId,
  source: "rooms" | "backup",
  wait_time_ms
})
```

---

## 10. Sequence Diagram

```
┌─────┐          ┌─────────┐         ┌───────┐         ┌────────┐
│ PWA │          │ Database│         │ Rooms │         │Webhook │
└──┬──┘          └────┬────┘         └───┬───┘         └───┬────┘
   │                  │                  │                 │
   │ 1. Payment Success                  │                 │
   │──────────────────>                  │                 │
   │                  │                  │                 │
   │ 2. Create Reservation               │                 │
   │────────────────────────────────────>│                 │
   │                  │                  │                 │
   │ 3. 200 OK (no PIN)                  │                 │
   │<────────────────────────────────────│                 │
   │                  │                  │                 │
   │ 4. Insert pending lock_code         │                 │
   │─────────────────>│                  │                 │
   │                  │                  │                 │
   │ 5. Display "Generating PIN..."      │                 │
   │                  │                  │                 │
   │                  │    6. Process reservation          │
   │                  │                  │────────────────>│
   │                  │                  │                 │
   │                  │    7. POST /webhooks/rooms/pin     │
   │                  │<─────────────────────────────────────
   │                  │                  │                 │
   │                  │ 8. Update lock_code with PIN       │
   │                  │<─────────────────────────────────────
   │                  │                  │                 │
   │ 9. Poll for PIN  │                  │                 │
   │─────────────────>│                  │                 │
   │                  │                  │                 │
   │ 10. Return PIN   │                  │                 │
   │<─────────────────│                  │                 │
   │                  │                  │                 │
   │ 11. Display PIN  │                  │                 │
   │                  │                  │                 │
```

---

## 11. Implementation Checklist

### Portal (Webhook Receiver)
- [ ] Create `/api/webhooks/rooms/pin` endpoint
- [ ] Add `ROOMS_WEBHOOK_SECRET` to environment
- [ ] Add logging and monitoring
- [ ] Test with sample webhook payloads

### PWA Changes (COMPLETED)
- [x] Modify `createRoomsReservation` to not expect PIN in response
- [x] Call Rooms API with "Pending" status in `/api/payment-intents` (before payment)
- [x] Call Rooms API with "Confirmed" status in Stripe webhook (after payment)
- [x] Update success page to poll `by-session` with 3 retries, 8-second delays
- [x] Implement fallback to backup code after retries exhausted
- [x] Update `by-session` API to read PIN from `lock_codes` table
- [x] Set `pinSource` based on `lock_codes.provider` field

### Rooms Configuration
- [ ] Configure webhook URL in Rooms system (Portal endpoint)
- [ ] Set up authentication header
- [ ] Test end-to-end with real reservation

### Testing
- [ ] Unit test webhook handler with valid/invalid payloads
- [ ] Integration test: reservation → webhook → PIN display
- [ ] Test timeout scenario → backup code
- [ ] Test duplicate webhook delivery (idempotency)
- [ ] Load test webhook endpoint

---

## 12. Timeline Estimate

| Phase | Duration | Owner |
|-------|----------|-------|
| Webhook endpoint (Portal) | 1 day | Portal Dev |
| PWA polling updates | 1 day | PWA Dev |
| Rooms webhook configuration | 0.5 day | Rooms Team |
| Integration testing | 1 day | Both |
| **Total** | **3-4 days** | |

---

## 13. Test Data (Griffith Boat Club)

### Test Identifiers
| Field | Value |
|-------|-------|
| **passId / reservationId** | `f47ac10b-58cc-4372-a567-0e02b2c3d479` |
| **guestId** | `6ba7b810-9dad-11d1-80b4-00c04fd430c8` |
| **roomId / slugPath** | `griffith-boat/club/gate-entry` |

### Sample Rooms API Payload (from PWA)
```json
{
  "propertyId": "griffith-boat",
  "reservationId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "arrivalDate": "2026-01-22T00:00:00.000Z",
  "departureDate": "2026-01-23T23:59:59.999Z",
  "guestId": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "guestFirstName": "John",
  "guestLastName": "Smith",
  "guestEmail": "john.smith@example.com",
  "guestPhone": "+61412345678",
  "roomId": "griffith-boat/club/gate-entry",
  "roomName": "griffith-boat/club/gate-entry",
  "status": "Pending"
}
```

### Sample Portal Webhook Payload (from Rooms)
```json
{
  "event": "pin.created",
  "data": {
    "reservationId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "pinCode": "4829",
    "validFrom": "2026-01-22T00:00:00.000Z",
    "validUntil": "2026-01-23T23:59:59.999Z"
  }
}
```

### Test Curl Commands

**1. Simulate Rooms webhook to Portal:**
```bash
curl -X POST "https://portal.zezamii.com/api/webhooks/rooms/pin" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_WEBHOOK_SECRET" \
  -d '{
    "event": "pin.created",
    "data": {
      "reservationId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "pinCode": "4829",
      "validFrom": "2026-01-22T00:00:00.000Z",
      "validUntil": "2026-01-23T23:59:59.999Z"
    }
  }'
```

---

## 14. Open Questions for Rooms Team

1. **Webhook payload format:** Confirm exact field names and structure
2. **Authentication method:** Bearer token or HMAC signature?
3. **Retry policy:** How many times will Rooms retry on 4xx/5xx?
4. **Event types:** Will there be `pin.updated` or `pin.deleted` events?
5. **Idempotency:** Can same PIN be sent multiple times for same reservation?

---

## Appendix: Error Handling Matrix

| Scenario | Webhook Behavior | PWA Behavior |
|----------|------------------|--------------|
| Reservation not found | Return 404 | N/A |
| PIN already exists | Return 200 (idempotent) | Show existing PIN |
| Database error | Return 500, Rooms retries | Continue polling |
| Auth failure | Return 401 | N/A |
| Webhook never arrives | N/A | Timeout → backup code |
| Duplicate webhook | Ignore duplicate | Show existing PIN |
