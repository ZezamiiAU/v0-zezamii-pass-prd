# Zezamii Pass - Architecture & Logic Flow

This document details the complete logic flow for the day pass purchase system, including all decision points, wait states, timeouts, and fallback mechanisms.

## Table of Contents

- [Overview](#overview)
- [Complete User Journey](#complete-user-journey)
- [Detailed Logic Flows](#detailed-logic-flows)
  - [1. QR Code Entry](#1-qr-code-entry)
  - [2. Pass Selection & Purchase Form](#2-pass-selection--purchase-form)
  - [3. Payment Intent Creation](#3-payment-intent-creation)
  - [4. Stripe Payment Processing](#4-stripe-payment-processing)
  - [5. Webhook Processing](#5-webhook-processing)
  - [6. Success Page & PIN Display](#6-success-page--pin-display)
- [Pincode Generation System](#pincode-generation-system)
- [Backup Pincode System](#backup-pincode-system)
- [Events Outbox Pattern](#events-outbox-pattern)
- [Configuration Reference](#configuration-reference)
- [Database Schema](#database-schema)
- [Error Handling & Recovery](#error-handling--recovery)

---

## Overview

The Zezamii Pass system enables users to purchase digital access passes by:

1. Scanning a QR code at a physical access point
2. Selecting a pass type (day pass or camping pass)
3. Completing payment via Stripe
4. Receiving a PIN code to unlock the door/gate

The system uses a **primary + fallback** approach for PIN generation:
- **Primary**: Rooms Event Hub API (creates PIN on the physical lock)
- **Fallback**: Pre-generated backup pincodes (rotated fortnightly)

---

## Complete User Journey

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  1. QR SCAN                                                                 │
│     User scans QR code → /p/{orgSlug}/{siteSlug}/{deviceSlug}              │
└──────────────────────────────────────────┬──────────────────────────────────┘
                                           ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│  2. PASS SELECTION                                                          │
│     Display available pass types (Day Pass, Camping Pass, etc.)             │
│     User selects pass type and number of days (if camping)                  │
└──────────────────────────────────────────┬──────────────────────────────────┘
                                           ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│  3. PURCHASE FORM                                                           │
│     Collect: Email/Phone, Vehicle Plate (optional), Terms acceptance        │
│     Click "Continue to Payment"                                             │
└──────────────────────────────────────────┬──────────────────────────────────┘
                                           ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│  4. PAYMENT INTENT CREATION (Server)                                        │
│     • Create pass record (status: "pending")                                │
│     • Query & cache backup pincode                                          │
│     • Create Stripe PaymentIntent with metadata                             │
│     • Return clientSecret                                                   │
└──────────────────────────────────────────┬──────────────────────────────────┘
                                           ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│  5. STRIPE PAYMENT (Client)                                                 │
│     Display Stripe Payment Element                                          │
│     User enters card details → stripe.confirmPayment()                      │
└──────────────────────────────────────────┬──────────────────────────────────┘
                                           ↓
                              ┌────────────┴────────────┐
                              ↓                         ↓
              ┌───────────────────────────┐  ┌─────────────────────────────────┐
              │  WEBHOOK (background)     │  │  SUCCESS PAGE (client)          │
              │  Processes payment        │  │  /success?payment_intent={id}   │
              └───────────┬───────────────┘  └─────────────┬───────────────────┘
                          ↓                                ↓
              ┌───────────────────────────┐  ┌─────────────────────────────────┐
              │ Call Rooms Event Hub API  │  │ Start 20-second countdown       │
              │ (20 second timeout)       │  │ Poll for pass details           │
              └─────┬─────────────┬───────┘  └─────────────┬───────────────────┘
                    ↓             ↓                        ↓
              ┌─────────┐  ┌──────────────┐  ┌─────────────────────────────────┐
              │ SUCCESS │  │ TIMEOUT/     │  │ Display PIN when available      │
              │ Got PIN │  │ FAILURE      │  │ • Rooms PIN: show immediately   │
              └────┬────┘  └──────┬───────┘  │ • Backup PIN: show at countdown │
                   │              │          └─────────────────────────────────┘
                   │              ↓
                   │       ┌──────────────┐
                   │       │ Use backup   │
                   │       │ pincode      │
                   │       └──────┬───────┘
                   │              │
                   └──────┬───────┘
                          ↓
              ┌─────────────────────────────┐
              │ Store in lock_codes table   │
              │ provider: "rooms" | "backup"│
              │ Post to events.outbox       │
              └─────────────────────────────┘
```

---

## Detailed Logic Flows

### 1. QR Code Entry

**File**: `app/p/[orgSlug]/[siteSlug]/[deviceSlug]/page.tsx`

```
User scans QR code
         │
         ↓
┌─────────────────────────────────────┐
│ URL: /p/{orgSlug}/{siteSlug}/{device}│
└─────────────────────────────────────┘
         │
         ↓
┌─────────────────────────────────────┐
│ Fetch device & pass types from API  │
│ GET /p/.../api                      │
└─────────────────────────────────────┘
         │
         ├── SUCCESS → Display pass selection
         │
         └── ERROR → Show error page with retry option
```

### 2. Pass Selection & Purchase Form

**File**: `components/pass-purchase-form.tsx`

```
Pass Types Displayed
         │
         ↓
┌─────────────────────────────────────┐
│ User selects pass type              │
│ • Day Pass: Single day              │
│ • Camping Pass: 1-28 days           │
└─────────────────────────────────────┘
         │
         ↓
┌─────────────────────────────────────┐
│ Collect user information            │
│ • Contact method: Email OR Phone    │
│ • Vehicle plate (optional)          │
│ • Terms acceptance (required)       │
└─────────────────────────────────────┘
         │
         ↓
┌─────────────────────────────────────┐
│ Validation (Zod schema)             │
│ • Email: valid format               │
│ • Phone: 7-15 digits, +prefix ok    │
│ • Pass type: valid UUID             │
└─────────────────────────────────────┘
         │
         ├── VALID → Continue to payment
         │
         └── INVALID → Show validation errors
```

### 3. Payment Intent Creation

**File**: `app/api/payment-intents/route.ts`

```
POST /api/payment-intents
         │
         ├── Rate limit check (10 req/min)
         │   └── EXCEEDED → 429 Too Many Requests
         │
         ├── Validate request body
         │   └── INVALID → 400 Invalid input
         │
         ├── Resolve device hierarchy
         │   device → floor → building → site
         │   └── NOT FOUND → 400/500 Error
         │
         ├── Get pass type by ID
         │   └── NOT FOUND → 400 Invalid pass type
         │
         ├── Calculate validity period
         │   ├── Day Pass: today until 11:59:59 PM AEDT
         │   └── Camping: today + (days-1) until 11:59:59 PM AEDT
         │
         ├── Create pass record
         │   └── status: "pending"
         │
         ├── Query backup pincode ─────────────────────────┐
         │   ├── Found → Cache in metadata                 │
         │   └── Not found → Log warning, continue         │
         │                                                 │
         ├── Create Stripe PaymentIntent                   │
         │   metadata: {                                   │
         │     org_slug, pass_id, access_point_id,        │
         │     backup_pincode, ←───────────────────────────┘
         │     backup_pincode_fortnight,
         │     valid_from, valid_to, ...
         │   }
         │
         ├── Create payment record (status: "pending")
         │
         └── Return { clientSecret }
```

### 4. Stripe Payment Processing

**File**: `components/payment-form.tsx`

```
Client receives clientSecret
         │
         ↓
┌─────────────────────────────────────┐
│ Display Stripe Payment Element      │
│ • Card number                       │
│ • Expiry date                       │
│ • CVC                               │
│ • Optional: Apple Pay, Google Pay   │
└─────────────────────────────────────┘
         │
         ↓
User clicks "Pay Now"
         │
         ↓
stripe.confirmPayment({
  redirect: "if_required"
})
         │
         ├── SUCCESS → Redirect to /success?payment_intent={id}
         │
         ├── REQUIRES_ACTION → 3D Secure flow
         │
         └── ERROR → Display error message
```

### 5. Webhook Processing

**File**: `app/api/webhooks/stripe/route.ts`

```
POST /api/webhooks/stripe
         │
         ├── Verify Stripe signature
         │   └── INVALID → 400 Bad signature
         │
         ├── Check idempotency (processed_webhooks table)
         │   └── status = "completed" → Return duplicate response
         │
         ├── Insert/update processed_webhooks
         │   status: "processing"
         │
         ├── Route by event type:
         │   ├── payment_intent.succeeded → handlePaymentIntentSucceeded()
         │   ├── payment_intent.payment_failed → handlePaymentIntentFailed()
         │   └── checkout.session.completed → handleCheckoutSessionCompleted()
         │
         ↓
handlePaymentIntentSucceeded()
         │
         ├── Parse metadata from PaymentIntent
         │
         ├── Lookup organisation
         │
         ├── Activate pass (status: "active")
         │
         ├── Update payment (status: "succeeded")
         │
         ├── PRIMARY: Call Rooms Event Hub API ────────────────┐
         │   ├── Timeout: 20 seconds (configurable)            │
         │   ├── SUCCESS + pincode → Use Rooms pincode         │
         │   └── FAILURE/TIMEOUT → Continue to fallback        │
         │                                                     │
         ├── FALLBACK: Use backup pincode from metadata ◄──────┘
         │   ├── Found → Use backup pincode
         │   └── Not found → No pincode available
         │
         ├── Store pincode in lock_codes table
         │   { pass_id, code, provider: "rooms"|"backup" }
         │
         ├── Post event to outbox
         │   topic: "pass.pass_paid.v1"
         │
         ├── Update processed_webhooks
         │   status: "completed"
         │
         └── Return success response

handlePaymentIntentFailed()
         │
         ├── Delete any lock codes
         ├── Update pass status: "cancelled"
         ├── Update payment status: "failed"
         └── Return success response
```

### 6. Success Page & PIN Display

**File**: `app/success/page.tsx`

```
/success?payment_intent={id}
         │
         ├── Validate URL parameters
         │   └── INVALID → Show error
         │
         ├── Check online status
         │   └── OFFLINE → Show offline message with retry
         │
         ↓
┌─────────────────────────────────────────────────────────────┐
│ START PARALLEL PROCESSES                                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  COUNTDOWN TIMER              FETCH PASS DETAILS            │
│  ┌─────────────┐              ┌─────────────────┐           │
│  │ Start: 20s  │              │ GET /api/passes │           │
│  │ Tick: 1s    │              │ /by-session     │           │
│  │ Display:    │              │                 │           │
│  │ Circular    │              │ Retry on pending│           │
│  │ progress    │              │ with backoff    │           │
│  └─────────────┘              └─────────────────┘           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
         │
         ↓
┌─────────────────────────────────────────────────────────────┐
│ PIN DISPLAY LOGIC                                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  IF pinSource === "rooms" AND code exists:                  │
│     → Display PIN immediately (don't wait for countdown)    │
│     → Stop countdown                                        │
│                                                             │
│  ELSE cache code and wait for countdown:                    │
│     → At countdown = 0, display backup code                 │
│     → Show "Backup Code" label                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
         │
         ↓
┌─────────────────────────────────────────────────────────────┐
│ DISPLAY PASS DETAILS                                        │
│ • PIN code (large, prominent)                               │
│ • Access point name                                         │
│ • Pass type                                                 │
│ • Valid from/to dates                                       │
│ • Vehicle plate (if provided)                               │
│ • Instructions                                              │
├─────────────────────────────────────────────────────────────┤
│ ACTIONS                                                     │
│ • "Share via SMS" → Pre-filled SMS message                  │
│ • "Done" → Return to purchase page                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Pincode Generation System

### Primary Path: Rooms Event Hub

**File**: `lib/integrations/rooms-event-hub.ts`

The Rooms Event Hub is an Azure-based service that creates PINs directly on physical locks.

```
┌─────────────────────────────────────────────────────────────┐
│ ROOMS EVENT HUB INTEGRATION                                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Lookup integration config from database                 │
│     SELECT config FROM integrations                         │
│     WHERE organisation_id = ? AND type = 'rooms_event_hub'  │
│                                                             │
│  2. Build payload                                           │
│     {                                                       │
│       propertyId: siteId,                                   │
│       reservationId: passId,                                │
│       arrivalDate: validFrom,                               │
│       departureDate: validTo,                               │
│       guestId: generateGuestId(email|phone),                │
│       roomId: deviceId,                                     │
│       status: "Unconfirmed"                                 │
│     }                                                       │
│                                                             │
│  3. POST to Rooms API                                       │
│     URL: {base_url}{webhook_path}                           │
│     Timeout: 20 seconds (ROOMS_API_TIMEOUT_MS)              │
│                                                             │
│  4. Parse response                                          │
│     Look for: pincode, pin_code, pin, code, accessCode      │
│                                                             │
│  5. Log to integration_logs table                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Fallback Path: Backup Pincodes

**File**: `lib/db/backup-pincodes.ts`

Pre-generated pincodes that rotate on a fortnightly basis.

```
┌─────────────────────────────────────────────────────────────┐
│ BACKUP PINCODE SYSTEM                                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  FORTNIGHT CALCULATION                                      │
│  • Start date: January 17, 2026                             │
│  • Period: 14 days each                                     │
│  • Total fortnights: 26 (covers ~1 year)                    │
│                                                             │
│  QUERY                                                      │
│  SELECT pincode, fortnight_number                           │
│  FROM backup_pincodes                                       │
│  WHERE org_id = ? AND site_id = ? AND device_id = ?         │
│    AND period_start <= NOW()                                │
│    AND period_end >= NOW()                                  │
│                                                             │
│  WHEN USED                                                  │
│  • Queried at payment intent creation (proactive cache)     │
│  • Stored in Stripe PaymentIntent metadata                  │
│  • Used by webhook if Rooms API fails                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Events Outbox Pattern

**Purpose**: Reliable async event delivery to downstream systems.

```
┌─────────────────────────────────────────────────────────────┐
│ OUTBOX PATTERN                                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Webhook completes                                          │
│         │                                                   │
│         ↓                                                   │
│  INSERT INTO events.outbox                                  │
│  {                                                          │
│    topic: "pass.pass_paid.v1",                              │
│    payload: {                                               │
│      org_id, pass_id, pin_code, pin_provider,               │
│      customer_email, customer_phone,                        │
│      valid_from, valid_to, ...                              │
│    }                                                        │
│  }                                                          │
│         │                                                   │
│         ↓                                                   │
│  External worker/cron reads outbox                          │
│         │                                                   │
│         ↓                                                   │
│  Delivers to subscribers:                                   │
│  • Email service (confirmation emails)                      │
│  • SMS service (PIN notifications)                          │
│  • Analytics/BI systems                                     │
│  • Audit logging                                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Note**: The outbox is for async downstream processing. It is NOT used for the Rooms API call, which must be synchronous because the user is actively waiting for their PIN.

---

## Configuration Reference

### Environment Variables

#### Server-side (API routes, webhooks)

| Variable | Default | Range | Description |
|----------|---------|-------|-------------|
| `ROOMS_API_TIMEOUT_MS` | `20000` | 1000-120000 | Timeout for Rooms Event Hub API calls |
| `LOCK_CODE_MAX_RETRIES` | `3` | 1-10 | Max retries when fetching lock codes |
| `LOCK_CODE_RETRY_DELAY_MS` | `500` | 100-5000 | Base delay between lock code retries |

#### Client-side (Success page)

| Variable | Default | Range | Description |
|----------|---------|-------|-------------|
| `NEXT_PUBLIC_PIN_COUNTDOWN_SECONDS` | `20` | 1-60 | Countdown before showing backup PIN |
| `NEXT_PUBLIC_PASS_FETCH_MAX_RETRIES` | `3` | 1-10 | Max retries for pass details fetch |
| `NEXT_PUBLIC_PASS_FETCH_BASE_DELAY_MS` | `2000` | 500-10000 | Base delay for retry backoff |
| `NEXT_PUBLIC_PASS_FETCH_BACKOFF_MULTIPLIER` | `1.5` | 1-3 | Exponential backoff multiplier |

### Timing Alignment

Both the Rooms API timeout and the success page countdown are aligned at **20 seconds** to ensure:

1. If Rooms responds successfully, the PIN is shown immediately (no countdown wait)
2. If Rooms times out, the backup code is shown right as the countdown completes
3. No scenario where user sees backup code but Rooms PIN arrives later

---

## Database Schema

### Key Tables

```sql
-- pass.passes
-- Stores pass records
{
  id: UUID,
  pass_type_id: UUID,
  device_id: UUID,
  site_id: UUID,
  org_id: UUID,
  status: "pending" | "active" | "cancelled" | "expired",
  vehicle_plate: TEXT,
  purchaser_email: TEXT,
  valid_from: TIMESTAMPTZ,
  valid_to: TIMESTAMPTZ
}

-- pass.payments
-- Stores payment records
{
  id: UUID,
  pass_id: UUID,
  stripe_payment_intent: TEXT,
  stripe_checkout_session: TEXT,
  amount_cents: INTEGER,
  currency: TEXT,
  status: "pending" | "succeeded" | "failed",
  metadata: JSONB
}

-- pass.lock_codes
-- Stores generated pincodes
{
  id: UUID,
  pass_id: UUID,
  code: TEXT,
  provider: "rooms" | "backup",
  provider_ref: TEXT,
  starts_at: TIMESTAMPTZ,
  ends_at: TIMESTAMPTZ
}

-- pass.backup_pincodes
-- Pre-generated fallback codes
{
  id: UUID,
  org_id: UUID,
  site_id: UUID,
  device_id: UUID,
  fortnight_number: INTEGER,
  pincode: TEXT,
  period_start: TIMESTAMPTZ,
  period_end: TIMESTAMPTZ
}

-- pass.processed_webhooks
-- Webhook idempotency tracking
{
  id: UUID,
  event_id: TEXT,
  event_type: TEXT,
  status: "processing" | "completed" | "failed",
  processed_at: TIMESTAMPTZ,
  completed_at: TIMESTAMPTZ,
  error_message: TEXT
}

-- events.outbox
-- Async event queue
{
  id: UUID,
  topic: TEXT,
  payload: JSONB,
  created_at: TIMESTAMPTZ
}
```

---

## Error Handling & Recovery

### Webhook Idempotency

The webhook uses a status-based idempotency pattern:

```
┌─────────────────────────────────────────────────────────────┐
│ WEBHOOK IDEMPOTENCY STATES                                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  "processing" → Webhook is currently being processed        │
│                 If Stripe retries, will re-attempt          │
│                                                             │
│  "completed"  → Successfully processed                      │
│                 If Stripe retries, returns duplicate        │
│                                                             │
│  "failed"     → Processing failed with error                │
│                 If Stripe retries, will re-attempt          │
│                 error_message stored for debugging          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Failure Scenarios

| Scenario | Handling |
|----------|----------|
| Rooms API timeout | Use backup pincode from metadata |
| Rooms API error | Use backup pincode from metadata |
| No backup pincode available | User must contact support |
| Webhook crashes mid-processing | Stripe retries, status remains "processing" |
| User closes browser before seeing PIN | Use "Share via SMS" or contact support |
| Payment succeeds but pass not active | Success page retries with exponential backoff |

### Recovery Mechanisms

1. **Stripe webhook retries**: Stripe automatically retries failed webhooks
2. **Status-based idempotency**: Prevents duplicate processing, allows retry on failure
3. **Backup pincode system**: Ensures user always gets access even if Rooms fails
4. **Success page polling**: Retries pass fetch with exponential backoff
5. **Technical details section**: Copyable error info for support team

---

## File Reference

| Path | Purpose |
|------|---------|
| `app/api/payment-intents/route.ts` | Create payment intent, cache backup pincode |
| `app/api/webhooks/stripe/route.ts` | Process payments, generate pincodes |
| `app/api/passes/by-session/route.ts` | Fetch pass details for success page |
| `app/success/page.tsx` | Display PIN with countdown |
| `lib/integrations/rooms-event-hub.ts` | Rooms API integration |
| `lib/db/backup-pincodes.ts` | Backup pincode queries |
| `lib/db/lock-codes.ts` | Lock code CRUD operations |
| `lib/env.ts` | Environment variable configuration |
| `components/pass-purchase-form.tsx` | Purchase form UI |
| `components/payment-form.tsx` | Stripe payment element |
