# Zezamii Pass

A Progressive Web App (PWA) for purchasing and managing digital access passes with Google Wallet integration.

## Features

- **Digital Pass Purchase**: Buy day passes, camping passes, and more via Stripe
- **Google Wallet Integration**: Add passes directly to Google Wallet
- **PWA Support**: Install on mobile devices for offline access
- **Multi-tenant**: Supports multiple organizations and sites
- **QR Code Access**: Scan QR codes at access points to purchase passes

## Tech Stack

- **Framework**: Next.js 15.5.9 (App Router)
- **Database**: Supabase (PostgreSQL)
- **Payments**: Stripe
- **Styling**: Tailwind CSS + shadcn/ui
- **Wallet**: Google Wallet API

## Setup

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

Required environment variables (set in Vercel):

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `WALLET_ISSUER_ID` | Google Wallet Issuer ID |
| `WALLET_CLASS_ID` | Google Wallet Class ID |
| `GOOGLE_WALLET_SA_JSON` | Google Wallet service account JSON |
| `APP_ORIGIN` | Production URL (e.g., https://zezamii-pass.vercel.app) |

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
│   └── access-points.ts   # Access point slug resolution
├── config/                # Configuration
├── notifications/         # Email templates
└── webhooks/              # Webhook handling

scripts/
├── 001-021_*.sql         # Database migrations
├── 022_fix_pass_schema_access_complete.sql  # Schema permissions (CRITICAL)
└── node/                  # Node.js scripts
\`\`\`

## Deployment

Deployed on Vercel: [zezamii-pass.vercel.app](https://zezamii-pass.vercel.app)

## License

Proprietary - Zezamii Pty Ltd

## Troubleshooting

### Error: "permission denied for schema pass"

This error occurs when PostgreSQL roles lack USAGE grants on the `pass` schema. Even `service_role` needs explicit schema-level permissions.

**Solution**: Run migration script `scripts/022_fix_pass_schema_access_complete.sql`

### /ap/[UUID] routes return 404

Legacy UUID-based routes redirect to slug-based URLs. Ensure:
1. The device has an active entry in `pass.accesspoint_slugs`
2. Schema permissions are granted (see above)
