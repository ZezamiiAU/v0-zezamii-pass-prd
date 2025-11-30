# Tenant Setup Guide

This guide explains how to set up a new tenant (organization) in the Zezamii Pass system.

## Overview

The system is multi-tenant, meaning multiple organizations can use the same application with isolated data. Each tenant has:

- **Organization** - Top-level entity with billing, branding, timezone
- **Sites** - Physical locations within the organization
- **Devices** - Access points (locks, gates) at sites
- **Pass Types** - Products customers can purchase
- **Integrations** - Optional external services (Rooms, PMS, etc.)

## Minimal Data Required

To enable a tenant, you need at minimum:

1. One organization
2. One site
3. One building + floor (infrastructure for devices)
4. One device (access point)
5. At least one pass type (product to sell)

## Step-by-Step Setup

### 1. Prepare Your Configuration

Copy `/scripts/008_minimal_tenant_template.sql` and fill in these values:

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `{ORG_UUID}` | Unique organization ID | `20000000-0000-0000-0000-000000000001` |
| `{ORG_NAME}` | Organization display name | `Zezamii Pty Ltd` |
| `{ORG_SLUG}` | URL-safe identifier | `zezamii` |
| `{BILLING_EMAIL}` | Billing contact | `billing@zezamii.com` |
| `{SITE_UUID}` | Unique site ID | `20000000-0000-0000-0000-000000000002` |
| `{SITE_NAME}` | Site display name | `Main Office` |
| `{ADDRESS}` | Street address | `123 George Street` |
| `{CITY}` | City | `Sydney` |
| `{STATE}` | State/Province | `NSW` |
| `{POSTCODE}` | Postal code | `2000` |
| `{BUILDING_UUID}` | Unique building ID | `20000000-0000-0000-0000-000000000006` |
| `{FLOOR_UUID}` | Unique floor ID | `20000000-0000-0000-0000-000000000007` |
| `{DEVICE_UUID}` | Unique device ID | `20000000-0000-0000-0000-000000000003` |
| `{DEVICE_NAME}` | Device display name | `Main Entrance` |
| `{DEVICE_CODE}` | Internal device code | `AP-MAIN-001` |
| `{DAY_PASS_UUID}` | Pass type ID | `20000000-0000-0000-0000-000000000004` |
| `{EXTENDED_PASS_UUID}` | Pass type ID | `20000000-0000-0000-0000-000000000005` |

### 2. Run the SQL Script

Execute your customized SQL script in the Supabase SQL Editor or via CLI:

\`\`\`bash
psql $DATABASE_URL -f my-tenant-config.sql
\`\`\`

### 3. Configure Environment Variables

Add to your `.env.local` or Vercel environment:

\`\`\`bash
# Default access point for homepage
NEXT_PUBLIC_ENTRY_ACCESS_POINT_ID={DEVICE_UUID}

# Default organization (optional, for /p/* URLs)
NEXT_PUBLIC_DEFAULT_ORG_ID={ORG_UUID}

# Production app origin
APP_ORIGIN=https://yourdomain.com
\`\`\`

### 4. Create Slug Mapping (Optional)

If you want branded URLs like `/p/zezamii/main-office/entrance`:

\`\`\`sql
INSERT INTO pass.accesspoint_slugs (
  id, organisation_id, site_id, device_id,
  org_slug, site_slug, accesspoint_slug, slug, is_active
)
VALUES (
  gen_random_uuid(),
  '{ORG_UUID}'::uuid,
  '{SITE_UUID}'::uuid,
  '{DEVICE_UUID}'::uuid,
  'zezamii',
  'main-office',
  'entrance',
  'zezamii/main-office/entrance',
  true
);
\`\`\`

### 5. Configure Rooms Integration (Optional)

If using Rooms Event Hub for lock code generation:

\`\`\`sql
INSERT INTO core.integrations (
  id, organisation_id, integration_type, name, config, credentials, status
)
VALUES (
  gen_random_uuid(),
  '{ORG_UUID}'::uuid,
  'rooms_event_hub',
  'Rooms Lock System',
  jsonb_build_object(
    'base_url', 'https://sender.rooms.zezamii.com/v1/webhooks',
    'webhook_path', 'zezamiiPass/reservation',
    'property_id', 'YOUR_PROPERTY_ID'
  ),
  jsonb_build_object('reservation_id_prefix', 'ZEZ'),
  'active'
);
\`\`\`

### 6. Test Access

Your tenant should now be accessible at:

- **UUID URL**: `/ap/{DEVICE_UUID}`
- **Slug URL**: `/p/{ORG_SLUG}/{SITE_SLUG}/{ACCESSPOINT_SLUG}`

Test the complete flow:
1. Navigate to access point page
2. Select a pass type
3. Enter vehicle details and email
4. Complete payment with Stripe test card
5. Verify lock code generation

## Multi-Tenant Architecture

### Data Isolation

All queries filter by `organisation_id` to ensure tenant isolation:

\`\`\`typescript
// Pass types are scoped to organization
const passTypes = await getPassTypes(orgId)

// Devices are scoped via org hierarchy
const device = await getDevice(deviceId)  // Joins to verify org ownership
\`\`\`

### Context Resolution

The system resolves organization context from:

1. **Device ID** (`/ap/[accessPointId]`) → Joins through floors → buildings → sites → orgs
2. **Slug** (`/p/[slug]`) → Queries `v_accesspoint_details` view
3. **Environment** → Falls back to `NEXT_PUBLIC_DEFAULT_ORG_ID`

### Pass Type Lookup

Pass types are now dynamically scoped:

\`\`\`typescript
// Before (hardcoded)
const passTypes = await getPassTypes("00000000-0000-0000-0000-000000000001")

// After (table-driven)
const passTypes = await getPassTypes(orgId)  // orgId from context
\`\`\`

## Environment Configuration

### Development

\`\`\`bash
# Local development with seed data
NEXT_PUBLIC_ENTRY_ACCESS_POINT_ID=00000000-0000-0000-0000-000000000003
NEXT_PUBLIC_DEFAULT_ORG_ID=00000000-0000-0000-0000-000000000001
\`\`\`

### Production

\`\`\`bash
# Production tenant configuration
NEXT_PUBLIC_ENTRY_ACCESS_POINT_ID=20000000-0000-0000-0000-000000000003
NEXT_PUBLIC_DEFAULT_ORG_ID=20000000-0000-0000-0000-000000000001
APP_ORIGIN=https://pass.zezamii.com
\`\`\`

### Preview/Staging

\`\`\`bash
# Separate tenant for staging environment
NEXT_PUBLIC_ENTRY_ACCESS_POINT_ID=30000000-0000-0000-0000-000000000003
NEXT_PUBLIC_DEFAULT_ORG_ID=30000000-0000-0000-0000-000000000001
APP_ORIGIN=https://staging-pass.zezamii.com
\`\`\`

## Adding More Resources

### Additional Sites

\`\`\`sql
INSERT INTO core.sites (id, organisation_id, name, address, city, state, country)
VALUES (gen_random_uuid(), '{ORG_UUID}'::uuid, 'Site 2', '456 Main St', 'Melbourne', 'VIC', 'Australia');
\`\`\`

### Additional Access Points

\`\`\`sql
-- Remember: devices require a floor, which requires a building
INSERT INTO core.devices (id, organisation_id, floor_id, name, code, category, status)
VALUES (gen_random_uuid(), '{ORG_UUID}'::uuid, '{FLOOR_UUID}'::uuid, 'West Entrance', 'AP-WEST-001', 'lock', 'active');
\`\`\`

### Additional Pass Types

\`\`\`sql
INSERT INTO pass.pass_types (id, organisation_id, name, code, price_cents, duration_minutes, is_active)
VALUES (gen_random_uuid(), '{ORG_UUID}'::uuid, 'VIP Pass', 'VIP', 10000, 2880, true);
\`\`\`

## Troubleshooting

### "No pass types found"

- Verify `pass_types.organisation_id` matches your device's organization
- Check `pass_types.is_active = true`
- Ensure prices are in cents (e.g., 2500 = $25.00)

### "Device not found"

- Verify device exists and `status = 'active'`
- Check device has valid `floor_id` → `building_id` → `site_id` → `organisation_id` chain

### "Integration not working"

- Check `core.integrations.status = 'active'`
- Verify `organisation_id` matches
- Review logs in `core.integration_logs` table

### Slug URL not working

- Verify slug exists in `pass.accesspoint_slugs` with `is_active = true`
- Check slug format: `org/site/accesspoint` (no leading/trailing slashes)
- View resolved details: `SELECT * FROM pass.v_accesspoint_details WHERE slug = 'your-slug'`

## Best Practices

1. **Use consistent UUID prefixes** per environment (e.g., `10000000` for prod, `20000000` for staging)
2. **Set proper timezones** - Critical for pass validity windows
3. **Configure billing email** - Required for Stripe integration
4. **Enable RLS policies** - Ensure tenant isolation at database level
5. **Test slug URLs** - Verify branded URLs work before customer launch
6. **Monitor integration logs** - Track API failures in `core.integration_logs`

## Next Steps

- Set up Stripe webhook for production
- Configure Rooms Event Hub integration
- Add custom branding to `organisations.brand_settings`
- Set up monitoring and alerting
- Review RLS policies for security
