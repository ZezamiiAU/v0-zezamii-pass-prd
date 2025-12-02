# Lock Integration - Final Design

## Architecture Decision: Keep It Simple

After thorough analysis, we are **keeping the existing implementation** which is production-ready and appropriate for current needs.

## Current System (✓ Correct)

### Database Schema
\`\`\`sql
-- Passes (already exists)
pass.passes (
  id uuid PRIMARY KEY,
  org_id uuid,
  site_id uuid,
  pass_type_id uuid,
  valid_from timestamptz,
  valid_to timestamptz,
  status text,
  purchaser_email text,
  ...
)

-- Lock codes (already exists)
pass.lock_codes (
  id uuid PRIMARY KEY,
  pass_id uuid REFERENCES pass.passes(id),
  code text,              -- PLAINTEXT PIN (6 digits)
  provider text,          -- 'duvan_lock_system'
  starts_at timestamptz,  -- Inherited from pass.valid_from
  ends_at timestamptz,    -- Inherited from pass.valid_to
  created_at timestamptz
)

-- Integration config (already exists)
core.integrations (
  id uuid PRIMARY KEY,
  organisation_id uuid,
  integration_type text,  -- 'rooms_event_hub'
  status text,            -- 'active'
  config jsonb,           -- { base_url, webhook_path }
  credentials jsonb       -- { reservation_id_prefix }
)
\`\`\`

### Flow
\`\`\`
1. User pays via Stripe
   ↓
2. Webhook creates pass in pass.passes
   ↓
3. Call createRoomsReservation(orgId, payload)
   ↓
4. Duvan's API returns { pincode: "123456" }
   ↓
5. Store in pass.lock_codes table (plaintext)
   ↓
6. Display PIN on success page
\`\`\`

## Security Model: Plaintext Storage

**Decision:** Store PIN codes in plaintext.

**Rationale:**
- PINs are temporary (24h - 7d expiration)
- Must be displayed to users
- Customer support needs lookup capability
- Time-limited reduces risk window
- Protected by database RLS and TLS
- Industry standard for physical access codes

**Security layers:**
- Supabase Row Level Security (RLS)
- HTTPS/TLS for all transmission
- Time-based expiration
- Rate limiting at lock hardware
- No logging of PIN values
- Audit logging of access

See `docs/PIN_CODE_SECURITY.md` for complete security analysis.

## Tomorrow's Checklist with Duvan

### ✅ Confirmed Values from Duvan:

1. **Production API Endpoint**
   \`\`\`
   https://sender.rooms.zezamii.com/webhooks/zezamiiPass/reservation/z71owzgoNUxJtxOC
   \`\`\`

2. **Dev API Endpoint**
   \`\`\`
   Not available (need local deployment or Kishan's dev environment)
   \`\`\`

3. **Authentication**
   \`\`\`
   None required for webhook
   \`\`\`

4. **PIN Format**
   \`\`\`
   4 digits (numeric only)
   Example: "4345"
   \`\`\`

5. **Response Field**
   \`\`\`
   Can be: pincode, pin_code, pin, or code
   System checks all variants
   \`\`\`

6. **Gateway Limitation**
   \`\`\`
   Can only process ONE task at a time
   Don't send concurrent requests
   \`\`\`

### ⏳ Still Need from Duvan:

7. **Property ID** (your organization identifier in their system)
   \`\`\`
   Value: ________________ (REQUIRED)
   \`\`\`

8. **Lock ID** (specific lock/gate device identifier)
   \`\`\`
   Value: ________________ (REQUIRED)
   \`\`\`

9. **Your Organisation ID** (run this query):
   \`\`\`sql
   SELECT id, name FROM api.organisations WHERE name ILIKE '%your-org%';
   \`\`\`

10. **Your Site ID** (run this query):
    \`\`\`sql
    SELECT id, name FROM api.sites WHERE org_id = 'your-org-id';
    \`\`\`

### Request Payload Structure (Confirmed):

\`\`\`json
{
  "propertyId": "REQUIRED - Get from Duvan",
  "reservationId": "pass-uuid-from-your-db",
  "arrivalDate": "2025-12-02T10:00:00Z",
  "departureDate": "2025-12-02T22:00:00Z",
  "lockId": "REQUIRED - Get from Duvan",
  "guestId": "optional",
  "guestName": "optional",
  "guestEmail": "optional",
  "guestPhone": "optional"
}
\`\`\`

### Response Format (Confirmed):

\`\`\`json
{
  "success": true,
  "pincode": "4345"
}
\`\`\`

Or returns error:
\`\`\`json
{
  "error": "Property ID not found"
}
\`\`\`

Note: Duvan's system returns 200 OK even for errors to prevent retries.

### Database Update Script:

\`\`\`sql
-- See scripts/016_configure_rooms_integration.sql
-- Update with actual values from Duvan tomorrow
\`\`\`

## Files That Already Work

No code changes needed:
- ✓ `lib/integrations/rooms-event-hub.ts` - Perfect as-is
- ✓ `app/api/webhooks/stripe/route.ts` - Already integrated
- ✓ Database schema - `pass.lock_codes` exists and works

## Files to Ignore/Delete

These were created during exploration but are NOT needed:
- ❌ `lib/integrations/lock-api.ts` - Duplicate
- ❌ `lib/config/lock-integration.ts` - Config is in database
- ❌ `lib/db/credentials.ts` - Overcomplicated
- ❌ `scripts/015_credential_integration.sql` - Not needed
- ❌ `scripts/014_minimal_credential_setup.sql` - Not needed
- ❌ `docs/PASS_CREDENTIAL_INTEGRATION.md` - Future consideration only

## When to Refactor

Consider the complex `access.credentials` system only if:
- Need multiple credential types per pass (PIN + mobile + biometric)
- Need credential lifecycle management (revoke, renew)
- Need fine-grained access control per credential
- Supporting multiple lock vendors simultaneously

**Current verdict:** Simple model is sufficient. Don't over-engineer.

## Risk Assessment

**Current approach:** ✅ LOW RISK
- Proven architecture already in production
- Only updating configuration values
- No code changes required
- Clear rollback path

**Complex refactor:** ❌ HIGH RISK
- Schema changes to core tables
- Data migration required
- Integration testing across payment + lock systems
- Potential for subtle bugs

## Conclusion

The lock integration is **already built and production-ready**. Tomorrow is just a configuration session, not a development session.

**Time estimate:** 15-30 minutes of configuration + testing.
