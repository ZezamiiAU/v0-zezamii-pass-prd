# Webhook System Documentation

The Zezamii Day Pass system supports **hybrid event delivery** - both database polling (for internal services) and HTTP webhooks (for external integrations).

## Architecture Overview

\`\`\`
┌─────────────────┐
│  Stripe Payment │
│    Webhook      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Payment Handler │
│  (route.ts)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ events.outbox   │◄──── Database Polling (Internal Services)
│   (Event Queue) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Webhook Worker  │
│  (Cron: 2min)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ HTTP POST to    │
│  Subscribers    │
└─────────────────┘
\`\`\`

## Event Publishing

### What Gets Published

**Event Topic**: `pass.pass_paid.v1`

**Trigger**: When Stripe payment succeeds (`checkout.session.completed` or `payment_intent.succeeded`)

**Event Payload**:
\`\`\`json
{
  "organisation_id": "uuid",
  "product": "pass",
  "variant": "day_pass",
  "pass_id": "uuid",
  "access_point_id": "uuid",
  "pin_code": "123456",
  "starts_at": "2025-01-08T10:00:00Z",
  "ends_at": "2025-01-08T22:00:00Z",
  "customer_identifier": "user@example.com",
  "customer_email": "user@example.com",
  "customer_phone": "+61412345678",
  "customer_plate": "ABC123",
  "provider": "stripe",
  "provider_session_id": "cs_xxx",
  "provider_intent_id": "pi_xxx",
  "amount_cents": 2500,
  "currency": "aud",
  "occurred_at": "2025-01-08T10:00:00Z"
}
\`\`\`

## Subscription Methods

### Method 1: Database Polling (Internal Services)

**Best for**: Internal services like Rooms engine that already have database access

**How it works**:
1. Poll `events.outbox` table every 5-30 seconds
2. Process events with `status = 'pending'`
3. Update status to `'processed'` after handling

**Required Permissions**:
\`\`\`sql
GRANT SELECT, UPDATE ON events.outbox TO subscriber_user;
GRANT SELECT, UPDATE ON pass.lock_codes TO subscriber_user;
GRANT SELECT ON pass.passes TO subscriber_user;
GRANT SELECT ON pass.gates TO subscriber_user;
\`\`\`

**Example Query**:
\`\`\`sql
-- Fetch pending events
SELECT * FROM events.outbox 
WHERE status = 'pending' 
ORDER BY created_at ASC 
LIMIT 10;

-- Mark as processed
UPDATE events.outbox 
SET status = 'processed', processed_at = NOW() 
WHERE id = 'event-uuid';
\`\`\`

### Method 2: HTTP Webhooks (External Services)

**Best for**: External third-party services, services without database access, real-time integrations

**How it works**:
1. Register webhook URL via API
2. Receive HTTP POST when events occur
3. Verify webhook signature
4. Return 2xx status code to confirm receipt

## HTTP Webhook Setup

### 1. Register Webhook Subscription

**Endpoint**: `POST /api/webhooks/subscriptions`

**Request**:
\`\`\`json
{
  "organisation_id": "uuid",
  "url": "https://your-service.com/webhooks/zezamii",
  "events": ["pass.pass_paid.v1"],
  "description": "Production webhook for lock provisioning"
}
\`\`\`

**Response**:
\`\`\`json
{
  "subscription": {
    "id": "uuid",
    "organisation_id": "uuid",
    "url": "https://your-service.com/webhooks/zezamii",
    "secret": "whsec_abc123...",
    "events": ["pass.pass_paid.v1"],
    "status": "active",
    "created_at": "2025-01-08T10:00:00Z"
  }
}
\`\`\`

**Important**: Save the `secret` - it's only returned once and is needed to verify webhook signatures.

### 2. Receive Webhook Events

**Your endpoint receives**:
\`\`\`http
POST /webhooks/zezamii HTTP/1.1
Host: your-service.com
Content-Type: application/json
X-Webhook-Signature: t=1704715200,v1=abc123...
X-Webhook-Attempt: 1
User-Agent: Zezamii-Webhooks/1.0

{
  "topic": "pass.pass_paid.v1",
  "event_id": "uuid",
  "created_at": "2025-01-08T10:00:00Z",
  "data": {
    "organisation_id": "uuid",
    "pass_id": "uuid",
    "access_point_id": "uuid",
    "pin_code": "123456",
    ...
  }
}
\`\`\`

### 3. Verify Webhook Signature

**Why**: Prevents unauthorized requests and replay attacks

**Signature Format**: `t=timestamp,v1=signature`

**Verification Steps**:
1. Extract timestamp and signature from `X-Webhook-Signature` header
2. Check timestamp is within 5 minutes (prevents replay attacks)
3. Compute HMAC SHA-256 of `{timestamp}.{raw_body}` using your secret
4. Compare computed signature with received signature using timing-safe comparison

**Example (Node.js)**:
\`\`\`javascript
import crypto from 'crypto';

function verifyWebhook(rawBody, signature, secret) {
  const parts = signature.split(',');
  const timestamp = parseInt(parts.find(p => p.startsWith('t=')).split('=')[1]);
  const receivedSig = parts.find(p => p.startsWith('v1=')).split('=')[1];

  // Check timestamp (5 min tolerance)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Math.floor(timestamp / 1000)) > 300) {
    throw new Error('Webhook timestamp too old');
  }

  // Verify signature
  const signedPayload = `${timestamp}.${rawBody}`;
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(receivedSig), Buffer.from(expectedSig))) {
    throw new Error('Invalid webhook signature');
  }

  return true;
}
\`\`\`

### 4. Respond to Webhook

**Success**: Return `200-299` status code within 30 seconds

**Failure**: Return `4xx` or `5xx` status code

**Retry Logic**:
- **5xx errors**: Automatic retry with exponential backoff (1min, 5min, 30min, 2hr, 12hr)
- **429 (Rate Limit)**: Automatic retry
- **4xx errors** (except 429): No retry (considered permanent failure)
- **Timeout** (>30s): Automatic retry
- **Max attempts**: 5

## API Reference

### List Subscriptions

\`\`\`http
GET /api/webhooks/subscriptions
\`\`\`

**Response**:
\`\`\`json
{
  "subscriptions": [
    {
      "id": "uuid",
      "organisation_id": "uuid",
      "url": "https://...",
      "events": ["pass.pass_paid.v1"],
      "status": "active",
      "description": "...",
      "created_at": "...",
      "last_delivery_at": "..."
    }
  ]
}
\`\`\`

### Update Subscription

\`\`\`http
PATCH /api/webhooks/subscriptions/:id
\`\`\`

**Request**:
\`\`\`json
{
  "status": "paused",
  "events": ["pass.pass_paid.v1", "pass.pass_activated.v1"],
  "description": "Updated description"
}
\`\`\`

### Delete Subscription

\`\`\`http
DELETE /api/webhooks/subscriptions/:id
\`\`\`

## Monitoring & Debugging

### Check Delivery Status

Query `events.webhook_deliveries` table:

\`\`\`sql
SELECT 
  wd.id,
  wd.attempt_number,
  wd.status,
  wd.http_status_code,
  wd.error_message,
  wd.delivered_at,
  wd.next_retry_at,
  ws.url,
  e.topic,
  e.payload
FROM events.webhook_deliveries wd
JOIN events.webhook_subscriptions ws ON wd.subscription_id = ws.id
JOIN events.outbox e ON wd.outbox_id = e.id
WHERE ws.organisation_id = 'your-org-id'
ORDER BY wd.created_at DESC
LIMIT 50;
\`\`\`

### Common Issues

**Issue**: Webhooks not being delivered

**Solutions**:
- Check subscription status is `'active'`
- Verify cron job is running (`/api/cron/webhook-delivery`)
- Check `events.webhook_deliveries` for error messages
- Ensure your endpoint returns 2xx status code within 30 seconds

**Issue**: Signature verification failing

**Solutions**:
- Verify you're using the correct secret
- Ensure you're using the raw request body (not parsed JSON)
- Check timestamp tolerance (default 5 minutes)
- Verify HMAC computation matches expected format

**Issue**: Events being delivered multiple times

**Solutions**:
- Implement idempotency using `event_id` field
- Store processed event IDs to prevent duplicate processing
- Return 2xx status even if already processed

## Security Best Practices

1. **Always verify webhook signatures** - Never trust unverified webhooks
2. **Use HTTPS endpoints** - Webhooks contain sensitive data
3. **Implement idempotency** - Handle duplicate deliveries gracefully
4. **Rate limit your endpoint** - Protect against abuse
5. **Rotate secrets periodically** - Update webhook subscriptions with new secrets
6. **Monitor failed deliveries** - Set up alerts for repeated failures
7. **Validate payload structure** - Don't assume fields exist or have expected types

## Deployment Configuration

### Vercel Cron Setup

The webhook delivery worker runs as a Vercel Cron job every 2 minutes.

**Configuration** (`vercel.json`):
\`\`\`json
{
  "crons": [
    {
      "path": "/api/cron/webhook-delivery",
      "schedule": "*/2 * * * *"
    }
  ]
}
\`\`\`

### Environment Variables

\`\`\`env
# Required for cron authentication
CRON_SECRET=your-secure-random-token
\`\`\`

Generate a secure token:
\`\`\`bash
openssl rand -hex 32
\`\`\`

### Cron Authentication

The cron endpoint requires authentication to prevent unauthorized access:

\`\`\`http
POST /api/cron/webhook-delivery
Authorization: Bearer your-cron-secret
\`\`\`

Vercel automatically includes this header when calling cron jobs.

## Migration from Database Polling

If you're currently using database polling and want to add HTTP webhooks:

1. **Keep existing polling** - Don't remove it yet
2. **Register webhook subscription** - Add your HTTP endpoint
3. **Test in parallel** - Verify both methods receive events
4. **Monitor for 24-48 hours** - Ensure HTTP webhooks are reliable
5. **Gradually reduce polling frequency** - Once confident in webhooks
6. **Eventually disable polling** - When fully migrated

Both methods can coexist indefinitely - use what works best for each integration.

## Support

For webhook issues:
- Check Vercel logs for cron job execution
- Query `events.webhook_deliveries` for delivery status
- Review error messages and HTTP status codes
