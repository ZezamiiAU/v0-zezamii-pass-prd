# Zezamii Pass

A Progressive Web App (PWA) for purchasing and managing digital access passes with Google Wallet integration.

## Features

- **Digital Pass Purchase**: Buy day passes, camping passes, and more via Stripe
- **Google Wallet Integration**: Add passes directly to Google Wallet
- **PWA Support**: Install on mobile devices for offline access
- **Multi-tenant**: Supports multiple organizations and sites
- **QR Code Access**: Scan QR codes at access points to purchase passes

## Tech Stack

- **Framework**: Next.js 15.5.7 (App Router)
- **Database**: Supabase (PostgreSQL)
- **Payments**: Stripe
- **Styling**: Tailwind CSS + shadcn/ui
- **Wallet**: Google Wallet API

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
├── config/                # Configuration
├── notifications/         # Email templates
└── webhooks/              # Webhook handling

scripts/
├── 001-017_*.sql         # Database migrations
└── node/                  # Node.js scripts
\`\`\`

## Deployment

Deployed on Vercel: [zezamii-pass.vercel.app](https://zezamii-pass.vercel.app)

## License

Proprietary - Zezamii Pty Ltd
