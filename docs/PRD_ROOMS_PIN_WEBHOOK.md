# PRD: Rooms PIN Webhook Integration

## Document Info
- **Version**: 3.0
- **Date**: January 2026
- **Author**: Zezamii Pass Team
- **Status**: Ready for Development

---

## 1. Executive Summary

This document describes the two-phase PIN provisioning architecture where:
1. **PWA calls Rooms API directly** with status (Pending/Confirmed/Cancelled)
2. **Rooms pushes PIN to Portal webhook** after processing
3. **PWA polls Portal DB** for PIN with countdown timer
4. **Backup codes remain** as existing fortnight-rotating system

### Architecture Flow

```
┌─────────┐      ┌─────────┐      ┌─────────┐      ┌─────────┐
│   PWA   │      │  Rooms  │      │ Portal  │      │   DB    │
└────┬────┘      └────┬────┘      └────┬────┘      └────┬────┘
     │                │                │                │
     │ 1. POST reservation (status: "Pending")         │
     │───────────────>│                │                │
     │                │                │                │
     │ 2. Create pass + pending lock_code              │
     │─────────────────────────────────────────────────>│
     │                │                │                │
     │ 3. Create Stripe Payment Intent                 │
     │─────────────────────────────────────────────────>│
     │                │                │                │
     │ ... User completes payment ...  │                │
     │                │                │                │
     │ 4. POST reservation (status: "Confirmed")       │
     │───────────────>│                │                │
     │                │                │                │
     │                │ 5. Generate PIN + POST webhook │
     │                │───────────────>│                │
     │                │                │ 6. Update      │
     │                │                │    lock_code   │
     │                │                │───────────────>│
     │                │                │                │
     │ 7. Poll GET /api/passes/by-session              │
     │<────────────────────────────────────────────────│
     │                │                │                │
     │ 8. Display PIN │                │                │
```

---

## 1.1 Key Field Mappings (Portal Dev Reference)

| What You Might Expect | Actual Column/Table |
|-----|-----|
| `valid_from` / `valid_until` on lock_codes | `starts_at` / `ends_at` |
| `valid_until` on passes | `valid_to` |
| `supabase.from('lock_codes')` | `supabase.schema('pass').from('lock_codes')` |
| Backup code in site_settings | `pass.backup_pincodes` table (rotates fortnightly) |

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

## 6. PWA Changes Required

### 6.1 Remove Synchronous PIN Expectation

**Current flow in `rooms-event-hub.ts`:**
```typescript
// Current: Expects PIN in response
const response = await createRoomsReservation(orgId, payload)
if (response.success && response.pincode) {
  return response.pincode  // Uses PIN from response
}
```

**New flow:**
```typescript
// New: Don't expect PIN in response
const response = await createRoomsReservation(orgId, payload)
if (response.success) {
  // Reservation created, PIN will arrive via webhook
  // Create pending lock_code record
  await createPendingLockCode(passId, validFrom, validTo)
  return null  // PIN will be fetched from database later
}
```

### 6.2 Create Pending Lock Code

Add function to create pending lock_code when reservation is made:

```typescript
async function createPendingLockCode(
  passId: string, 
  startsAt: string, 
  endsAt: string
): Promise<void> {
  const supabase = createSchemaServiceClient("pass")
  
  await supabase
    .from("lock_codes")
    .upsert({
      pass_id: passId,
      provider: "rooms",
      provider_ref: passId,  // Use pass_id as reference
      status: "pending",
      code: null,
      starts_at: startsAt,
      ends_at: endsAt,
    }, {
      onConflict: "pass_id,provider"
    })
}
```

### 6.3 Update Success Page Polling

**Current:** Polls Rooms API or checks Stripe metadata
**New:** Polls `pass.lock_codes` table

```typescript
// In success page or by-session API
async function getPinForPass(passId: string): Promise<string | null> {
  const supabase = createSchemaServiceClient("pass")
  
  const { data } = await supabase
    .from("lock_codes")
    .select("code, status")
    .eq("pass_id", passId)
    .eq("status", "active")
    .maybeSingle()
  
  return data?.code || null
}
```

### 6.4 Fallback to Backup Code

If after N seconds (e.g., 30s) no PIN arrives, use backup code:

```typescript
const PIN_WAIT_TIMEOUT_MS = 30000

// In success page
const [countdown, setCountdown] = useState(30)
const [pin, setPin] = useState<string | null>(null)

useEffect(() => {
  const pollInterval = setInterval(async () => {
    const code = await getPinForPass(passId)
    if (code) {
      setPin(code)
      clearInterval(pollInterval)
    }
  }, 2000)  // Poll every 2 seconds

  const timeout = setTimeout(() => {
    clearInterval(pollInterval)
    if (!pin) {
      // Use backup code
      setPin(backupCode)
      setPinSource("backup")
    }
  }, PIN_WAIT_TIMEOUT_MS)

  return () => {
    clearInterval(pollInterval)
    clearTimeout(timeout)
  }
}, [passId])
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

### PWA Changes
- [ ] Modify `createRoomsReservation` to not expect PIN in response
- [ ] Add `createPendingLockCode` function
- [ ] Update success page to poll `lock_codes` table
- [ ] Implement timeout → backup code fallback
- [ ] Update `by-session` API to check `lock_codes` table

### Rooms Configuration
- [ ] Configure webhook URL in Rooms system
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

## 13. Open Questions for Rooms Team

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
