# Branding Configuration Guide

This document explains how to configure branding for multi-tenant deployments of the Access Pass system.

## Overview

The Access Pass system supports full branding customization through:
1. **Database-driven branding** - Organization and site names from database
2. **Environment variable defaults** - Fallback branding for homepage and defaults
3. **Dynamic manifest** - PWA manifest generated per organization

## Environment Variables

### Required for Branding

\`\`\`bash
# Default organization and site (used on homepage)
NEXT_PUBLIC_DEFAULT_ORG_NAME="Big Parks"
NEXT_PUBLIC_DEFAULT_SITE_NAME="Scenic Site"

# App metadata
NEXT_PUBLIC_APP_TITLE="Big Parks Access Pass"
NEXT_PUBLIC_APP_DESCRIPTION="Quick and easy pass purchase for your visit"

# Support contact
NEXT_PUBLIC_SUPPORT_EMAIL="support@bigparks.com"
SUPPORT_EMAIL="support@bigparks.com"  # Server-side fallback
\`\`\`

## Database Configuration

### Organizations Table

Ensure each organization has:
- `name` - Organization name (e.g., "Big Parks")
- `logo_url` - URL to organization logo
- `support_email` - Support email for customer inquiries

### Sites Table

Ensure each site has:
- `name` - Site name (e.g., "Scenic Site", "Mountain View Campground")

## How Branding Works

### Homepage (`/`)
- Uses `NEXT_PUBLIC_DEFAULT_ORG_NAME` and `NEXT_PUBLIC_DEFAULT_SITE_NAME`
- Displays top 3 pass types from default org
- Shows default app icon

### Slug Pages (`/p/[slug]`)
- Fetches org name, logo, and site name from database
- Displays org-specific branding
- Uses org logo if available

### Success Page
- Shows org-specific support email
- Instructions reference org/site names
- Google Wallet passes include org branding

### PWA Installation
- Prompt uses `NEXT_PUBLIC_APP_TITLE`
- Manifest generated dynamically via `/api/manifest`

## Multi-Environment Setup

### Development
\`\`\`bash
NEXT_PUBLIC_DEFAULT_ORG_NAME="Test Parks"
NEXT_PUBLIC_SUPPORT_EMAIL="dev@example.com"
\`\`\`

### Staging
\`\`\`bash
NEXT_PUBLIC_DEFAULT_ORG_NAME="Staging Parks"
NEXT_PUBLIC_SUPPORT_EMAIL="staging@example.com"
\`\`\`

### Production
\`\`\`bash
NEXT_PUBLIC_DEFAULT_ORG_NAME="Big Parks"
NEXT_PUBLIC_SUPPORT_EMAIL="support@bigparks.com"
\`\`\`

## Customization Checklist

- [ ] Set organization name in environment
- [ ] Set site name in environment
- [ ] Configure support email
- [ ] Upload organization logo to database
- [ ] Test homepage displays correct branding
- [ ] Test slug pages show org-specific branding
- [ ] Verify PWA install prompt uses correct name
- [ ] Check success page support email
- [ ] Test Google Wallet pass branding

## Troubleshooting

**Homepage shows "Access Pass" instead of org name**
- Check `NEXT_PUBLIC_DEFAULT_ORG_NAME` is set
- Restart dev server after changing .env.local

**Support email wrong on success page**
- Verify `NEXT_PUBLIC_SUPPORT_EMAIL` is set
- Check database `organizations.support_email` field

**PWA manifest not updating**
- Manifest is dynamically generated at `/api/manifest`
- Clear browser cache and reinstall PWA
- Check environment variables are correct

**Slug page shows default branding**
- Verify organization and site records exist in database
- Check slug mapping in `accesspoint_slugs` table
- Ensure `logo_url` is set in organizations table
