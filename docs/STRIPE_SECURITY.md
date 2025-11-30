# Stripe Payment Security

## Idempotency Keys

The payment intent endpoint accepts an `X-Idempotency-Key` header to prevent duplicate charges:

\`\`\`javascript
fetch("/api/payment-intents", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Idempotency-Key": crypto.randomUUID(), // Generate unique key per request
  },
  body: JSON.stringify({ gateId, passTypeId, email, plate, phone }),
})
\`\`\`

**How it works:**
- Client generates a unique idempotency key (UUID) for each payment attempt
- Stripe uses this key to detect and reject duplicate requests
- If the same key is sent twice, Stripe returns the original response without creating a new charge

## Webhook Security

### Signature Verification
All webhook events are verified using `stripe.webhooks.constructEvent()` with the webhook secret. This ensures only authentic Stripe events are processed.

### Duplicate Prevention
Webhook event IDs are stored in `pass.processed_webhooks` table. If the same event is received multiple times (Stripe retries), it's automatically skipped.

### Source of Truth
- Client never marks passes as "paid" or "active"
- Only webhook handlers update pass status after payment succeeds
- Payment status flows: pending → succeeded (via webhook only)

**Example webhook payload for pass purchase:**
\`\`\`json
{
  "metadata": {
    "org_slug": "zezamii",
    "product": "pass",
    "pass_id": "550e8400-e29b-41d4-a716-446655440000",
    "access_point_id": "123e4567-e89b-12d3-a456-426614174000"
  }
}
\`\`\`

## Rate Limiting

### Burst + Sustained Limits
- **Burst:** 3 requests per second (prevents rapid-fire attacks)
- **Sustained:** 10 requests per 60 seconds (prevents sustained abuse)

### Response Headers
\`\`\`
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 2025-01-08T12:34:56Z
Retry-After: 60
\`\`\`

## Exit Top-Up Flow (Future)

When implementing exit payments:
1. Calculate fee delta server-side based on actual exit time
2. Create new PaymentIntent with calculated amount
3. Use idempotency key: `exit-${passId}-${exitTimestamp}`
4. Process via same webhook handlers (payment_intent.succeeded)

## Testing

### Webhook Testing
\`\`\`bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
stripe trigger payment_intent.succeeded
\`\`\`

### Idempotency Testing
Send the same request twice with same idempotency key - should get identical response without creating duplicate charge.
