# Email Provider Implementation

## Overview

Production-ready email sending via Resend with retry logic and dead-letter logging.

## Components

### 1. EmailProvider (`lib/notifications/email-provider.ts`)

Production email provider using Resend SDK with:
- Exponential backoff retry (3 attempts: 250ms, 750ms, 1500ms)
- Transient error detection (429, 5xx, network errors)
- No retry for permanent 4xx errors
- Dead-letter logging on final failure
- Pino logger integration (no console.log)

### 2. Email Failures Repo (`lib/db/email-failures.ts`)

Database repository for logging failed emails to `analytics.email_failures` table:
- Recipient (redacted in logs)
- Subject
- Template name (optional)
- Error message
- Attempt count
- Payload summary (metadata only, no full HTML)

### 3. Database Schema (`scripts/013_create_email_failures_table.sql`)

Creates `analytics.email_failures` table with:
- UUID primary key
- Indexed by created_at and recipient
- Stores failure metadata for troubleshooting

## Environment Variables

Required:
- `RESEND_API_KEY` - Resend API key for sending emails
- `EMAIL_FROM` - From address (e.g., "noreply@zezamii.com")

Optional:
- `EMAIL_REPLY_TO` - Reply-to address for customer responses

## Error Handling

### Transient Errors (Retry)
- HTTP 429 (Rate limit)
- HTTP 5xx (Server errors)
- Network errors

### Permanent Errors (No Retry)
- HTTP 4xx (except 429)
- Invalid email addresses
- Domain validation failures

## Usage

\`\`\`typescript
import { EmailProvider } from "@/lib/notifications/email-provider"

const provider = new EmailProvider()

const result = await provider.send({
  to: "customer@example.com",
  subject: "Your Access Pass",
  body: "Plain text body",
  html: "<p>HTML body</p>",
})

if (!result.success) {
  // Error already logged to database and pino
  console.error("Email failed:", result.error)
}
\`\`\`

## Logging

All logs use pino logger with safe identifiers:
- Email addresses are redacted via `REDACT_PATHS` in `lib/logger.ts`
- Logs include: recipient, subject, attempt, error details
- Dead-letter failures logged to `analytics.email_failures` table

## Call Sites

Current usage:
- `lib/notifications/index.ts` - `sendPassNotifications()` function

The existing error handling in `sendPassNotifications` already uses `Promise.allSettled()`, so email failures won't crash the application.

## Testing

To test the email provider:

1. Set environment variables:
\`\`\`bash
RESEND_API_KEY=re_xxx
EMAIL_FROM=noreply@zezamii.com
EMAIL_REPLY_TO=support@zezamii.com  # optional
\`\`\`

2. Trigger a pass notification (email sent on successful payment)

3. Check logs for delivery status

4. Query `analytics.email_failures` for any failed deliveries:
\`\`\`sql
SELECT * FROM analytics.email_failures 
ORDER BY created_at DESC 
LIMIT 10;
\`\`\`

## Migration

To deploy:

1. Run the SQL migration: `scripts/013_create_email_failures_table.sql`
2. Add environment variables to Vercel project
3. Deploy the updated code

No code changes required at call sites - the interface remains compatible.
