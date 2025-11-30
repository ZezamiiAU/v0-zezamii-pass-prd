# Rooms Event Hub Integration

This document describes how the system integrates with the Rooms Event Hub API to generate lock credentials (pincodes) for guests.

## Architecture

**Flow**:
1. Customer completes Stripe payment
2. Stripe webhook triggers payment handler
3. Payment handler **calls Rooms Event Hub API synchronously**
4. Rooms API returns pincode in response
5. Pincode stored in database and displayed to customer

**Key Difference from Webhook Delivery**:
- We **call** Rooms API (outbound request)
- We **wait** for the response with pincode
- No webhook delivery worker needed
- No polling or retry logic needed

## Configuration

### 1. Run Database Migration

\`\`\`bash
# Run the integration tables migration
psql $DATABASE_URL -f scripts/006_add_integrations_table.sql
\`\`\`

### 2. Insert Rooms Integration Config

\`\`\`sql
INSERT INTO core.integrations (
  organisation_id,
  integration_type,
  name,
  config,
  credentials,
  status
) VALUES (
  'your-organisation-uuid',
  'rooms_event_hub',
  'Zezamii Pass Production',
  '{
    "base_url": "https://sender.rooms.zezamii.com/v1/webhooks",
    "webhook_path": "zezamiiPass/reservation"
  }'::jsonb,
  '{
    "reservation_id_prefix": "SAMPLE"
  }'::jsonb,
  'active'
);
\`\`\`

### 3. Configure Property ID

The `propertyId` is currently hardcoded in the Stripe webhook handler:

\`\`\`typescript
// app/api/webhooks/stripe/route.ts
propertyId: "z71owzgoNUxJtxOC"
\`\`\`

**TODO**: Make this configurable per organisation by adding to integration config.

## API Call Details

### Request

**URL**: `https://sender.rooms.zezamii.com/v1/webhooks/zezamiiPass/reservation/{reservationId}`

**Method**: `POST`

**Headers**:
\`\`\`json
{
  "Content-Type": "application/json"
}
\`\`\`

**Body**:
\`\`\`json
{
  "propertyId": "z71owzgoNUxJtxOC",
  "arrivalDate": "2025-01-15",
  "departureDate": "2025-01-16",
  "lockId": "access-point-uuid-or-identifier",
  "guestName": "John Smith",
  "guestPhone": "+61412345678",
  "guestEmail": "john@example.com"
}
\`\`\`

### Response

**Success** (200):
\`\`\`json
{
  "success": true,
  "pincode": "123456",
  "reservationId": "SAMPLExyz789"
}
\`\`\`

**Error** (4xx/5xx):
\`\`\`json
{
  "success": false,
  "error": "Error message"
}
\`\`\`

## Error Handling

### Fallback Strategy

If Rooms API fails:
1. Log error to `core.integration_logs`
2. Check if pass already has a pincode from previous attempt
3. If yes, use existing pincode
4. If no, payment succeeds but customer sees error message

**Important**: Payment is NOT refunded if Rooms API fails. The pass is still created and marked as "active", but without a valid pincode.

### Retry Logic

Currently **NO automatic retries** - the Stripe webhook handler makes a single synchronous call.

**Future Enhancement**: Could add retry logic with exponential backoff if Rooms API is temporarily unavailable.

## Monitoring

### Check Integration Status

\`\`\`sql
SELECT 
  i.name,
  i.integration_type,
  i.status,
  i.last_used_at,
  i.created_at
FROM core.integrations i
WHERE i.integration_type = 'rooms_event_hub';
\`\`\`

### Check Recent API Calls

\`\`\`sql
SELECT 
  il.created_at,
  il.operation,
  il.status,
  il.http_status_code,
  il.duration_ms,
  il.error_message,
  il.request_payload->>'lockId' as lock_id,
  il.response_payload->>'pincode' as pincode
FROM core.integration_logs il
JOIN core.integrations i ON il.integration_id = i.id
WHERE i.integration_type = 'rooms_event_hub'
ORDER BY il.created_at DESC
LIMIT 50;
\`\`\`

### Check Failed Calls

\`\`\`sql
SELECT 
  il.created_at,
  il.status,
  il.http_status_code,
  il.error_message,
  il.request_payload
FROM core.integration_logs il
JOIN core.integrations i ON il.integration_id = i.id
WHERE i.integration_type = 'rooms_event_hub'
  AND il.status IN ('error', 'timeout')
ORDER BY il.created_at DESC;
\`\`\`

## Migration from Webhook Delivery

### What to Remove

1. **Webhook delivery worker**: `workers/webhook-delivery-worker.ts`
2. **Webhook delivery cron**: `/api/cron/webhook-delivery/route.ts`
3. **Webhook subscription management**: `/app/api/webhooks/subscriptions/`
4. **Database tables**: `events.webhook_subscriptions`, `events.webhook_deliveries`

### What to Keep

1. **Events outbox table**: Keep for audit trail
2. **Stripe webhook handler**: Updated to call Rooms directly
3. **Lock codes table**: Still stores pincodes
4. **Payment flow**: Mostly unchanged

### Migration Steps

1. ✅ Create `core.integrations` table
2. ✅ Create `core.integration_logs` table
3. ✅ Create Rooms API integration module
4. ✅ Update Stripe webhook handler to call Rooms
5. ⏳ Test in production with real payments
6. ⏳ Remove webhook delivery worker once confirmed working
7. ⏳ Remove webhook subscription tables

## Testing

### Test Rooms Integration

\`\`\`bash
# Call the Stripe webhook endpoint with test payload
curl -X POST http://localhost:3000/api/webhooks/stripe \
  -H "stripe-signature: test" \
  -H "Content-Type: application/json" \
  -d @test-webhook.json
\`\`\`

Check logs for:
- `[v0] Calling Rooms Event Hub: ...`
- `[v0] Rooms Event Hub response: 200 { pincode: "123456" }`

### Verify Pincode Storage

\`\`\`sql
SELECT 
  lc.code,
  lc.provider,
  lc.provider_ref,
  lc.starts_at,
  lc.ends_at,
  p.id as pass_id,
  p.status
FROM pass.lock_codes lc
JOIN pass.passes p ON lc.pass_id = p.id
WHERE lc.provider = 'rooms'
ORDER BY lc.created_at DESC
LIMIT 10;
\`\`\`

## Security Considerations

1. **No authentication required**: Rooms API currently doesn't require API keys in headers
2. **HTTPS only**: Always use HTTPS for API calls
3. **Timeout protection**: 30-second timeout prevents hanging requests
4. **Audit logging**: All API calls logged with request/response
5. **Credential storage**: Store API keys in `credentials` JSONB field (encrypted at rest)

## Support

For Rooms API issues:
- Check `core.integration_logs` for error details
- Verify integration config in `core.integrations`
- Check Rooms API status/documentation
- Contact Rooms support with reservation IDs from logs
