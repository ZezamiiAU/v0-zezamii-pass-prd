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

### Critical Values Needed:

1. **API Base URL**
   \`\`\`
   Dev:  ________________
   Prod: ________________
   \`\`\`

2. **Webhook Path**
   \`\`\`
   Current: /reservation/{reservation_id}
   Actual:  ________________
   \`\`\`

3. **Property ID** (your organization identifier)
   \`\`\`
   Value: ________________
   \`\`\`

4. **Reservation ID Prefix**
   \`\`\`
   Current: SAMPLE
   New:     ________________
   \`\`\`

5. **Response Field Name**
   \`\`\`
   Is it: pincode, pin_code, or pin?
   Answer: ________________
   \`\`\`

6. **PIN Format**
   \`\`\`
   Length: _____ digits (4? 6? 8?)
   \`\`\`

### Database Update Script:

\`\`\`sql
-- Update integration config with Duvan's values
UPDATE core.integrations
SET 
  config = jsonb_build_object(
    'base_url', 'https://FILL_FROM_DUVAN',
    'webhook_path', 'FILL_FROM_DUVAN'
  ),
  credentials = jsonb_build_object(
    'reservation_id_prefix', 'FILL_FROM_DUVAN'
  ),
  status = 'active'
WHERE integration_type = 'rooms_event_hub'
  AND organisation_id = (SELECT id FROM core.organisations LIMIT 1);
\`\`\`

### Testing Steps:

1. Verify config: `SELECT * FROM core.integrations WHERE integration_type = 'rooms_event_hub'`
2. Make test payment in Stripe test mode
3. Check logs: `SELECT * FROM core.integration_logs ORDER BY created_at DESC LIMIT 5`
4. Verify PIN: `SELECT * FROM pass.lock_codes ORDER BY created_at DESC LIMIT 5`
5. Test success page displays PIN

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
\`\`\`

```md file="docs/PASS_CREDENTIAL_INTEGRATION.md" isDeleted="true"
...deleted...
