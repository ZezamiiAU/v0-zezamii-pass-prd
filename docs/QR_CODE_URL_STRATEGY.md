# QR Code URL Strategy

## Overview

Your system uses **slug-based URLs** for QR codes to ensure they remain valid and human-readable, even if internal device IDs change.

## QR Code URL Format

### ✅ **Preferred Format (Use This)**
\`\`\`
https://yourapp.com/p/[slug]
\`\`\`

**Examples:**
- `https://yourapp.com/p/north-entrance`
- `https://yourapp.com/p/vip-parking`
- `https://yourapp.com/p/scenic-vista-entry`

### ❌ **Legacy Format (Avoid for New QR Codes)**
\`\`\`
https://yourapp.com/ap/[device-uuid]
\`\`\`

**Example:**
- `https://yourapp.com/ap/00000000-0000-0000-0000-000000000003`

**Why avoid?** UUIDs are not human-readable and harder to maintain.

---

## How It Works

### **URL Resolution Flow**

\`\`\`
Customer scans QR code
    ↓
/p/[slug] (e.g., /p/north-entrance)
    ↓
API call to /api/accesspoints/resolve/[slug]
    ↓
Database query to v_accesspoint_details view
    ↓
Returns: device_id, org_id, site_id, device_name, org_name, etc.
    ↓
PassPurchaseForm renders with correct context
\`\`\`

### **Database Structure**

The slug is stored directly in the `core.devices` table:

\`\`\`sql
-- core.devices table
CREATE TABLE core.devices (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,  -- The friendly URL slug
  slug_is_active BOOLEAN DEFAULT true,
  custom_name TEXT,  -- Custom branding name
  custom_description TEXT,
  custom_logo_url TEXT,
  -- ... other fields
);
\`\`\`

---

## Setting Up QR Codes

### **Step 1: Configure Device Slugs**

Update your devices with slug mappings:

\`\`\`sql
-- Example: Set slug for a device
UPDATE core.devices 
SET 
  slug = 'north-entrance',
  slug_is_active = true,
  custom_name = 'North Entrance',
  custom_description = 'Main visitor entrance with parking access'
WHERE id = '00000000-0000-0000-0000-000000000003';
\`\`\`

Or use the JSON template system:

\`\`\`json
{
  "devices": [
    {
      "id": "00000000-0000-0000-0000-000000000003",
      "name": "Entry Gate - North",
      "slug": "north-entrance",
      "slug_is_active": true,
      "custom_name": "North Entrance",
      "custom_logo_url": "https://yoursite.com/logo.png"
    }
  ]
}
\`\`\`

### **Step 2: Generate QR Codes**

When creating QR codes, use the **slug-based URL format**:

\`\`\`javascript
// ✅ Correct
const qrCodeUrl = `https://yourapp.com/p/${device.slug}`;

// ❌ Incorrect
const qrCodeUrl = `https://yourapp.com/ap/${device.id}`;
\`\`\`

### **Step 3: Print & Deploy**

1. Generate QR codes with the slug URL
2. Print on signage, stickers, or access points
3. Test by scanning to ensure correct pass purchase page loads

---

## Benefits of Slug-Based URLs

### **Human-Readable**
- `/p/north-entrance` is easier to remember than `/ap/uuid-here`
- Easier to debug and troubleshoot

### **Stable & Permanent**
- Slugs don't change even if you need to swap out hardware
- Old QR codes remain valid indefinitely

### **Multi-Tenant Friendly**
- Each tenant can have their own branded URLs
- `/p/acme-corp-main-gate` vs `/p/bigco-entrance`

### **SEO & Marketing**
- Slugs can be branded and memorable
- Easier to share in marketing materials

---

## Backward Compatibility

The system supports **both** URL formats during transition:

### **Legacy UUID URLs**
When customers scan an old QR code with `/ap/[uuid]`:

1. System checks if device has a `slug` configured
2. If yes → **Redirects** to `/p/[slug]`
3. If no → Falls back to `/ap-legacy/[uuid]`

This ensures:
- Old QR codes still work
- Gradual migration to slug-based system
- No disruption to existing customers

---

## Implementation Checklist

- [ ] Run migration `010_merge_slugs_into_devices.sql`
- [ ] Configure slugs for all devices (via JSON template or SQL)
- [ ] Verify slugs work: Test `/p/[slug]` URLs
- [ ] Update QR code generation to use `/p/[slug]`
- [ ] Print new QR codes with slug URLs
- [ ] Deploy at access points
- [ ] Monitor analytics to track slug vs UUID usage
- [ ] Phase out old QR codes over time

---

## Troubleshooting

### **Issue: "Access point not found" error**

**Cause:** Slug doesn't exist or `slug_is_active = false`

**Fix:**
\`\`\`sql
-- Check if slug exists
SELECT * FROM core.devices WHERE slug = 'your-slug';

-- Enable slug
UPDATE core.devices 
SET slug_is_active = true 
WHERE slug = 'your-slug';
\`\`\`

### **Issue: QR code redirects to legacy route**

**Cause:** Migration not run or slug columns don't exist

**Fix:**
\`\`\`bash
# Run the migration
psql $DATABASE_URL -f scripts/010_merge_slugs_into_devices.sql
\`\`\`

### **Issue: Multiple devices with same slug**

**Cause:** Slug is not unique

**Fix:** Slugs must be globally unique. Use site prefixes:
- ✅ `site-a-north-entrance`
- ✅ `site-b-north-entrance`
- ❌ `north-entrance` (duplicate)

---

## Related Documentation

- [Tenant Setup Guide](./TENANT_SETUP_GUIDE.md) - Configure organizations and devices
- [Data Collection Template](../templates/DATA_COLLECTION_TEMPLATE.md) - Gather slug info from customers
- [Migration 010](../scripts/010_merge_slugs_into_devices.sql) - Add slug columns to devices table
