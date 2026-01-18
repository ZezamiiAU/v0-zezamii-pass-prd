# Zezamii Pass

A Progressive Web App (PWA) for purchasing and managing digital access passes. Users scan a QR code at an access point, purchase a pass via Stripe, and receive a PIN code to unlock the door/gate.

## Features

- **Digital Pass Purchase**: Buy day passes, camping passes, and more via Stripe
- **Google Wallet Integration**: Add passes directly to Google Wallet
- **PWA Support**: Install on mobile devices for offline access
- **Multi-tenant**: Supports multiple organizations and sites
- **QR Code Access**: Scan QR codes at access points to purchase passes
- **PIN Code Generation**: Automatic PIN generation via Rooms API integration

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Database**: Supabase (PostgreSQL with multi-schema)
- **Payments**: Stripe (Payment Intents API)
- **Email**: Resend
- **Styling**: Tailwind CSS 4 + Radix UI (shadcn/ui)
- **Wallet**: Google Wallet API
- **Deployment**: Vercel

## Architecture

For detailed architecture documentation including complete logic flows, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

\`\`\`
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   QR Code   │────▶│   Next.js   │────▶│   Stripe    │
│   Scanner   │     │     PWA     │     │  Payments   │
└─────────────┘     └──────┬──────┘     └──────┬──────┘
                           │                   │
                    ┌──────▼──────┐     ┌──────▼──────┐
                    │  Supabase   │     │   Webhook   │
                    │  (3 schemas)│◀────│   Handler   │
                    └──────┬──────┘     └─────────────┘
                           │
                    ┌──────▼──────┐
                    │ Rooms API   │──┐
                    │ (Primary)   │  │ Fallback
                    └─────────────┘  │
                           ▲         ▼
                    ┌──────┴─────────────┐
                    │ Backup Pincodes    │
                    │ (Fortnightly)      │
                    └────────────────────┘
\`\`\`

### PIN Generation Flow

1. **Primary**: Rooms Event Hub API creates PIN on physical lock (20s timeout)
2. **Fallback**: Pre-generated backup pincodes (rotated fortnightly)
3. Success page shows Rooms PIN immediately if available, otherwise waits for countdown then shows backup

### Database Schemas

- **core**: Organizations, sites, devices, floors, buildings
- **pass**: Passes, payments, lock_codes, pass_types, processed_webhooks, backup_pincodes
- **events**: Outbox for async event processing

## User Flow

1. User scans QR code at access point (e.g., `/p/org-slug/site-slug/device-slug`)
2. App loads available pass types for that location
3. User selects pass, enters contact info, accepts terms
4. Payment form appears (Stripe Elements)
5. On successful payment:
   - Pass record created in database
   - PIN code generated via Rooms API (or backup system)
   - PIN displayed on success page
   - Confirmation sent via email/SMS

## Setup

### Prerequisites

- Node.js 18+
- pnpm 10+
- Supabase project
- Stripe account

### Installation

\`\`\`bash
# Clone the repository
git clone <repo-url>
cd v0-zezamii-pass-prd

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env.local
# Edit .env.local with your values

# Run development server
pnpm dev
\`\`\`

### Database Migrations

Run database migrations in order from `scripts/` directory:

\`\`\`bash
# Connect to your Supabase project
psql $DATABASE_URL

# Run migrations in order
\i scripts/001_seed_pass_types.sql
\i scripts/002_add_processed_webhooks.sql
# ... continue with remaining migrations

# CRITICAL: Grant schema access for public pass purchases
\i scripts/022_fix_pass_schema_access_complete.sql

# Add webhook status columns (required for idempotency)
\i scripts/039-add-webhook-status-columns.sql
\`\`\`

**Important migrations**:
- `022_fix_pass_schema_access_complete.sql` - Required for `/ap/[accessPointId]` legacy routes
- `032-create-backup-pincodes-table.sql` - Creates backup pincode system
- `039-add-webhook-status-columns.sql` - Adds status-based webhook idempotency

### Supabase Configuration

In your Supabase project settings, ensure the API is configured to expose the `pass` schema:

1. Go to Settings → API
2. Under "Exposed schemas", ensure `pass` is included alongside `public`
3. Save changes

## Environment Variables

See `lib/env.ts` for the full schema with validation. Key variables:

### Required

| Variable | Description |
|----------|-------------|
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret (production) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |

### Optional - Wallet

| Variable | Description |
|----------|-------------|
| `WALLET_ISSUER_ID` | Google Wallet Issuer ID |
| `WALLET_CLASS_ID` | Google Wallet Class ID |
| `GOOGLE_WALLET_SA_JSON` | Google Wallet service account JSON |

### Optional - Timing Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `ROOMS_API_TIMEOUT_MS` | `20000` | Rooms Event Hub API timeout (ms) |
| `LOCK_CODE_MAX_RETRIES` | `3` | Max retries for lock code fetch |
| `LOCK_CODE_RETRY_DELAY_MS` | `500` | Base delay between retries (ms) |
| `NEXT_PUBLIC_PIN_COUNTDOWN_SECONDS` | `20` | Success page countdown before backup |
| `NEXT_PUBLIC_PASS_FETCH_MAX_RETRIES` | `3` | Max retries for pass fetch |
| `NEXT_PUBLIC_PASS_FETCH_BASE_DELAY_MS` | `2000` | Base delay for retry backoff |
| `NEXT_PUBLIC_PASS_FETCH_BACKOFF_MULTIPLIER` | `1.5` | Exponential backoff multiplier |

### Optional - General

| Variable | Description |
|----------|-------------|
| `APP_ORIGIN` | Production URL |
| `SUPPORT_EMAIL` | Support email address |
| `PASS_DEV_MODE` | Enable dev mode (`true`/`false`) |

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/payment-intents` | POST | Create Stripe PaymentIntent + pass |
| `/api/webhooks/stripe` | POST | Handle Stripe webhook events |
| `/api/passes/by-session` | GET | Fetch pass details by session/intent |
| `/api/pass-types` | GET | List available pass types |
| `/api/accesspoints/resolve/[orgSlug]/[deviceSlug]` | GET | Resolve device by slugs |
| `/api/wallet/google` | POST | Generate Google Wallet pass |

## Development

\`\`\`bash
# Start dev server
pnpm dev

# Type checking
pnpm typecheck

# Linting
pnpm lint

# Format code
pnpm format

# Build for production
pnpm build
\`\`\`

## Stripe Webhook Setup

1. Create webhook endpoint in Stripe Dashboard
2. Point to: `https://your-domain.vercel.app/api/webhooks/stripe`
3. Subscribe to events:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
4. Copy signing secret to `STRIPE_WEBHOOK_SECRET`

## Production Considerations

### Rate Limiting

The current rate limiter uses in-memory storage which doesn't work reliably on Vercel serverless (each function instance has its own memory). For production, consider implementing Redis-based rate limiting with `@upstash/ratelimit`.

### Environment Validation

The app validates environment variables at runtime using Zod schemas. Missing required variables will produce clear error messages. Check `lib/env.ts` for the full schema.

## Project Structure

\`\`\`
app/
├── api/                    # API routes
│   ├── wallet/            # Google Wallet endpoints
│   ├── passes/            # Pass management
│   ├── webhooks/          # Stripe & subscription webhooks
│   └── payment-intents/   # Stripe payment handling
├── p/[org]/[site]/[device]/ # Dynamic pass purchase pages
├── success/               # Post-purchase success page
└── offline/               # PWA offline fallback

components/
├── ui/                    # shadcn/ui components
├── pass-purchase-form.tsx # Main purchase form
├── payment-form.tsx       # Stripe payment form
└── pwa-install-prompt.tsx # PWA install prompt

lib/
├── db/                    # Database queries
├── server/                # Server-side utilities
├── config/                # Configuration
├── integrations/          # External API integrations (Rooms)
├── notifications/         # Email/SMS providers
├── supabase/              # Supabase clients
└── webhooks/              # Webhook handling

scripts/
├── 001-021_*.sql         # Database migrations
├── 022_fix_pass_schema_access_complete.sql  # Schema permissions
└── node/                  # Node.js scripts
\`\`\`

## Deployment

Deployed on Vercel: [zezamii-pass.vercel.app](https://zezamii-pass.vercel.app)

## Troubleshooting

### Error: "permission denied for schema pass"

This error occurs when PostgreSQL roles lack USAGE grants on the `pass` schema.

**Solution**: Run migration script `scripts/022_fix_pass_schema_access_complete.sql`

### /ap/[UUID] routes return 404

Legacy UUID-based routes redirect to slug-based URLs. Ensure:
1. The device has an active entry in `pass.accesspoint_slugs`
2. Schema permissions are granted (see above)

### Webhook not processing payments

1. Check `STRIPE_WEBHOOK_SECRET` is set correctly
2. Verify webhook is subscribed to the correct events in Stripe Dashboard
3. Check `pass.processed_webhooks` table for duplicate event handling

## License

Proprietary - Zezamii Pty Ltd
