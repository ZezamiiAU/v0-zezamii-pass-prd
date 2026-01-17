# Security Documentation

This document describes the security measures, patterns, and considerations for the Zezamii Pass application.

## Table of Contents

- [API Security](#api-security)
- [Authentication & Authorization](#authentication--authorization)
- [Input Validation](#input-validation)
- [Rate Limiting](#rate-limiting)
- [Webhook Security](#webhook-security)
- [CORS & CSRF Protection](#cors--csrf-protection)
- [Environment Variables](#environment-variables)
- [Known Limitations](#known-limitations)
- [Security Checklist](#security-checklist)
- [Reporting Security Issues](#reporting-security-issues)

---

## API Security

### Endpoint Classification

| Endpoint | Auth Required | Rate Limited | Description |
|----------|---------------|--------------|-------------|
| POST /api/payment-intents | No (public) | Yes | Create payment intent |
| POST /api/webhooks/stripe | Signature | No | Stripe webhook handler |
| GET /api/passes/by-session | No | Yes | Fetch pass by session |
| GET /api/pass-types | No | Yes | List pass types |
| POST /api/webhooks/subscriptions | Admin | No | Create webhook subscription |
| GET /api/wallet/* | No | Yes | Wallet pass generation |

### Request Validation

All API endpoints use Zod schemas for strict input validation. Schemas are centralized in lib/schemas/api.schema.ts.

Key validation patterns:
- **UUIDs**: Validated with regex pattern for all ID fields
- **Phone numbers**: Sanitized (strips spaces/hyphens) then validated (7-15 digits)
- **License plates**: Alphanumeric with hyphens/spaces only (1-15 chars)
- **Stripe IDs**: Prefix validation (cs_ for sessions, pi_ for intents)

---

## Authentication & Authorization

### Public Endpoints

Most pass-purchase endpoints are intentionally public (unauthenticated) to allow anonymous users to buy passes via QR code scanning.

### Admin Endpoints

Protected endpoints use token-based authentication via lib/auth/admin.ts:

\`\`\`bash
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" /api/protected-endpoint
\`\`\`

### Supabase Session Auth

For admin dashboard features, Supabase auth checks user metadata for admin role in user_metadata.role or app_metadata.role.

---

## Input Validation

### Centralized Schemas

All validation schemas are centralized in lib/schemas/api.schema.ts:

- **Params**: Route segment validation (accessPointIdParamSchema, etc.)
- **Body**: JSON payload validation (checkoutSchema, syncPaymentBodySchema)
- **Query**: URL parameters (sessionQuerySchema, walletSaveQuerySchema)

### Validation Helpers

Located in lib/utils/validate-request.ts:
- validateBody() - Throws on failure
- safeValidateBody() - Returns Result type for complex error handling
- validationErrorResponse() - Converts validation errors to HTTP responses

### SQL Injection Prevention

All database queries use Supabase client with parameterized queries. Never concatenate user input into queries.

---

## Rate Limiting

### Current Implementation

The application uses an in-memory rate limiter (lib/rate-limit.ts):

- **Sustained limit**: 10 requests per minute per IP+path
- **Burst limit**: 3 requests per second (built-in)

### Serverless Limitation

**IMPORTANT**: In-memory rate limiting does NOT work reliably on Vercel serverless:
- Each function instance has isolated memory
- Rate limits are not shared across instances
- Attackers can bypass limits by hitting different instances

### Recommended Production Setup

For production, implement Redis-based rate limiting with @upstash/ratelimit and @upstash/redis.

### Rate-Limited Endpoints

| Endpoint | Limit | Window |
|----------|-------|--------|
| /api/payment-intents | 10 | 60s |
| /api/passes/by-session | 10 | 60s |
| /api/pass-types | 20 | 60s |

---

## Webhook Security

### Stripe Webhooks

Stripe webhooks are verified using signature validation in app/api/webhooks/stripe/route.ts.

Security measures:
- **Signature verification**: HMAC SHA-256 with shared secret
- **Idempotency**: Events tracked in processed_webhooks table to prevent replay
- **No auth bypass**: Webhook route exempted from CSRF checks (verified by signature)

### Custom Webhooks (Subscription System)

Internal webhook delivery uses HMAC signatures (lib/webhooks/signature.ts):
- Format: t=timestamp,v1=signature
- Prevents replay attacks (5-minute tolerance)
- Uses timing-safe comparison

---

## CORS & CSRF Protection

### Middleware Protection

The middleware (middleware.ts) implements CSRF protection for all API routes:

1. Require content-type: application/json OR x-requested-with header for non-GET requests
2. Validate Origin header against allowed origins
3. Allow Vercel preview deployments (*.vercel.app)

### Allowed Origins

Configured via environment variables:
- PUBLIC_BASE_URL
- APP_ORIGIN
- NEXT_PUBLIC_VERCEL_URL

### Stripe Webhook Exception

Stripe webhooks bypass CSRF checks because they use signature-based verification.

---

## Environment Variables

### Security Best Practices

1. **Never commit secrets**: .env.local is gitignored
2. **Use Vercel Environment Variables**: Set in dashboard, not in code
3. **Validate at runtime**: lib/env.ts validates with Zod schemas

### Required Secrets

| Variable | Sensitivity | Description |
|----------|-------------|-------------|
| STRIPE_SECRET_KEY | Critical | Can charge customers |
| STRIPE_WEBHOOK_SECRET | Critical | Prevents fake webhooks |
| SUPABASE_SERVICE_ROLE_KEY | Critical | Full database access |
| ADMIN_TOKEN | High | Admin API access |
| GOOGLE_WALLET_SA_JSON | High | Google API access |

---

## Known Limitations

### 1. In-Memory Rate Limiting
- **Issue**: Does not work on Vercel serverless
- **Mitigation**: Implement Redis-based solution for production
- **Status**: Documented in lib/rate-limit.ts

### 2. No User Authentication for Purchases
- **Design Decision**: Anonymous users can buy passes via QR codes
- **Mitigation**: Stripe handles payment security; passes tied to email/phone

### 3. Admin Token Auth
- **Issue**: Simple bearer token, no expiration or rotation
- **Mitigation**: Use strong random tokens; consider JWT for production

---

## Security Checklist

### Before Deployment

- [ ] Set STRIPE_WEBHOOK_SECRET in Vercel
- [ ] Set strong ADMIN_TOKEN (use openssl rand -hex 32)
- [ ] Verify all Supabase RLS policies are enabled
- [ ] Test webhook signature verification
- [ ] Review rate limiting strategy

### Ongoing

- [ ] Monitor Stripe webhook failures
- [ ] Review processed_webhooks for anomalies
- [ ] Rotate ADMIN_TOKEN periodically
- [ ] Keep dependencies updated (pnpm audit)

---

## Reporting Security Issues

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT** create a public GitHub issue
2. Email security concerns to the development team
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We aim to respond within 48 hours and will credit researchers in our changelog (with permission).
