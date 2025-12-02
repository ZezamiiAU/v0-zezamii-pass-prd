# QR Code Tracking System

## Overview

The QR code tracking system enables analytics and usage monitoring for physical QR codes placed at access points. Each device can have a unique `qr_instance_id` that allows tracking of QR code performance.

## Architecture

### URL Structure (Site-Scoped)

**Current Format:**
\`\`\`
https://yourdomain.com/p/{org-slug}/{site-slug}/{device-slug}?qr={qr_instance_id}&source=qr
\`\`\`

**Example:**
\`\`\`
https://zezamii-pass.vercel.app/p/zezamii-parks/boom-gate-hq/main-entrance?qr=550e8400-e29b-41d4-a716-446655440000&source=qr
\`\`\`

**Important:** Device slugs are now unique **per site**, not per organization. The site-slug is required to uniquely identify devices since multiple sites can have devices with the same slug.

**Legacy Format (Redirects to new format):**
\`\`\`
https://yourdomain.com/p/{device-slug}
\`\`\`

### Resolution Logic

1. **New route** `/p/[orgSlug]/[siteSlug]/[deviceSlug]`: Looks up device by org + site + device slug
2. **Legacy route** `/p/[slug]`: Redirects to new format after lookup
3. **QR parameter**: Used for tracking which physical QR code was scanned

### Database Schema

**`core.devices` table:**
- `slug` (text, unique per site): Device URL identifier
- `site_id` (uuid): Site the device belongs to (required)
- `qr_instance_id` (uuid): Unique identifier for physical QR code instance
- `lock_id` (integer): Lock system identifier

**`core.sites` table:**
- `slug` (text, unique per org): Site URL identifier
- `org_id` (uuid): Organization the site belongs to

**`analytics.qr_scans` tracking table:**
- `device_id` (uuid): Which device was accessed
- `qr_instance_id` (uuid): Which physical QR code was scanned
- `org_id` (uuid): Organization context
- `user_agent` (text): Browser/device information
- `ip_address` (text): Client IP for geolocation
- `source` (text): Tracking source (e.g., "qr", "web", "email")
- `scanned_at` (timestamptz): Timestamp of scan

## Setup

### 1. Ensure Database View Exists

The `core.qr_ready_devices` view provides QR-ready devices with computed URLs:

\`\`\`sql
-- Set base URL for your environment
ALTER DATABASE postgres SET app.base_url = 'zezamii-pass.vercel.app';

-- View is already created by portal dev
SELECT * FROM core.qr_ready_devices WHERE is_qr_ready = true;
\`\`\`

### 2. Verify Organisation Slugs

All organisations must have slugs for the new URL structure:

\`\`\`sql
-- Check for missing org slugs
SELECT id, name, slug 
FROM core.organisations 
WHERE slug IS NULL OR slug = '';
\`\`\`

### 3. Generate QR Codes (Admin Portal)

The admin portal queries `core.qr_ready_devices` view which provides:
- Health checks (`is_qr_ready`, `health_status`)
- Computed `qr_url` field ready to encode

## Usage Examples

### Scenario 1: Standard QR Code

\`\`\`sql
-- Organisation: Zezamii Parks
org_slug = 'zezamii-parks'

-- Site: Boom Gate HQ
site_slug = 'boom-gate-hq'

-- Device: Main Entrance  
device_slug = 'main-entrance'
qr_instance_id = '550e8400-e29b-41d4-a716-446655440000'
\`\`\`

QR Code URL:
\`\`\`
https://zezamii-pass.vercel.app/p/zezamii-parks/boom-gate-hq/main-entrance?qr=550e8400-e29b-41d4-a716-446655440000&source=qr
\`\`\`

### Scenario 2: Multiple Sites, Same Device Slug

\`\`\`sql
-- Site: Downtown Office
https://zezamii-pass.vercel.app/p/zezamii-parks/downtown-office/main-entrance

-- Site: North Branch  
https://zezamii-pass.vercel.app/p/zezamii-parks/north-branch/main-entrance
\`\`\`

Each site can reuse device slugs because they're site-scoped.

## Analytics Queries

### Total Scans by Organisation
\`\`\`sql
SELECT 
  o.name as org_name,
  COUNT(*) as total_scans,
  COUNT(DISTINCT qs.device_id) as unique_devices
FROM analytics.qr_scans qs
JOIN core.organisations o ON o.id = qs.org_id
WHERE qs.scanned_at >= NOW() - INTERVAL '30 days'
GROUP BY o.name
ORDER BY total_scans DESC;
\`\`\`

### Scans by Device
\`\`\`sql
SELECT 
  o.slug as org_slug,
  d.slug as device_slug,
  d.custom_name as device_name,
  COUNT(*) as total_scans
FROM analytics.qr_scans qs
JOIN core.devices d ON d.id = qs.device_id
JOIN core.organisations o ON o.id = d.org_id
WHERE qs.scanned_at >= NOW() - INTERVAL '30 days'
GROUP BY o.slug, d.slug, d.custom_name
ORDER BY total_scans DESC;
\`\`\`

### QR Instance Performance
\`\`\`sql
SELECT 
  qs.qr_instance_id,
  d.custom_name as device_name,
  COUNT(*) as scans,
  COUNT(DISTINCT DATE(qs.scanned_at)) as active_days,
  MIN(qs.scanned_at) as first_scan,
  MAX(qs.scanned_at) as last_scan
FROM analytics.qr_scans qs
JOIN core.devices d ON d.id = qs.device_id
WHERE qs.qr_instance_id IS NOT NULL
  AND qs.scanned_at >= NOW() - INTERVAL '30 days'
GROUP BY qs.qr_instance_id, d.custom_name
ORDER BY scans DESC;
\`\`\`

## Best Practices

### Organisation Slugs
- Use lowercase, URL-safe identifiers
- Examples: `zezamii-parks`, `acme-corp`, `mountain-resort`
- Must be unique across all organisations

### Site Slugs
- Unique within each organisation (org-scoped)
- Examples: `boom-gate-hq`, `downtown-office`, `north-branch`
- Must be unique per organization

### Device Slugs  
- Unique within each site (site-scoped)
- Descriptive and memorable
- Examples: `main-entrance`, `north-gate`, `visitor-center`

### QR Instance IDs
- Use UUIDs generated by database
- Each physical QR code gets unique instance ID
- Allows tracking multiple QR codes for same device

### Tracking Parameters
- `qr={uuid}` - Required for QR code tracking
- `source=qr` - Helps distinguish QR scans from web traffic
- `source=email`, `source=social` - Track other campaigns

## Troubleshooting

### QR Code Returns 404
1. Check organisation has `slug` set and `is_active = true`
2. Check site has `slug` set and belongs to correct org
3. Verify device has `slug` set and belongs to correct site
4. Confirm org slug, site slug, and device slug all match QR code URL
5. Check `core.qr_ready_devices` view for device status

### Tracking Not Working
1. Verify `analytics.qr_scans` table exists
2. Check service role has INSERT permission on analytics.qr_scans
3. Review browser console for track-scan API errors
4. Confirm `qr` parameter is present in URL

### Legacy URLs Not Redirecting
1. Ensure device has `slug` in devices table
2. Check organisation has `slug` in organisations table  
3. Verify device's org relationship is correct

## Migration from Old System

If you have existing `/p/[slug]` QR codes in the field:

1. **No action needed** - Legacy route automatically redirects
2. **Gradual replacement** - Print new org-scoped QR codes over time
3. **Analytics** - Both formats tracked in same `analytics.qr_scans` table

The system maintains backward compatibility while enabling better multi-tenancy.
