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
                    │ Rooms API   │
                    │ (PIN codes) │
                    └─────────────┘
\`\`\`

### Database Schemas

- **core**: Organizations, sites, devices, floors, buildings
- **pass**: Passes, payments, lock_codes, pass_types, processed_webhooks
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
\`\`\`

**Important**: Script `022_fix_pass_schema_access_complete.sql` is required for `/ap/[accessPointId]` legacy routes and public pass type queries. Without it, you'll get error `42501: permission denied for schema pass`.

### Supabase Configuration

In your Supabase project settings, ensure the API is configured to expose the `pass` schema:

1. Go to Settings → API
2. Under "Exposed schemas", ensure `pass` is included alongside `public`
3. Save changes

## Environment Variables

See `.env.example` for all required variables. Key ones:

| Variable | Required | Description |
|----------|----------|-------------|
| `STRIPE_SECRET_KEY` | Yes | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Production | Webhook signing secret |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Yes | Stripe publishable key |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `WALLET_ISSUER_ID` | Optional | Google Wallet Issuer ID |
| `WALLET_CLASS_ID` | Optional | Google Wallet Class ID |
| `GOOGLE_WALLET_SA_JSON` | Optional | Google Wallet service account JSON |
| `APP_ORIGIN` | Optional | Production URL |

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
