-- Migration: Merge accesspoint_slugs into core.devices (SAFE VERSION)
-- Purpose: Simplify architecture by adding slug fields directly to devices
-- Impact: Eliminates need for separate accesspoint_slugs table
-- NOTE: This version explicitly handles view dependencies

-- ============================================================================
-- STEP 1: Drop the view first to avoid any issues
-- ============================================================================

DROP VIEW IF EXISTS pass.v_accesspoint_details CASCADE;

-- ============================================================================
-- STEP 2: Add new columns to core.devices
-- ============================================================================

ALTER TABLE core.devices
ADD COLUMN IF NOT EXISTS slug TEXT,
ADD COLUMN IF NOT EXISTS slug_is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS custom_name TEXT,
ADD COLUMN IF NOT EXISTS custom_description TEXT,
ADD COLUMN IF NOT EXISTS custom_logo_url TEXT;

-- Add unique constraint on slug (only if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'devices_slug_key'
  ) THEN
    ALTER TABLE core.devices ADD CONSTRAINT devices_slug_key UNIQUE (slug);
  END IF;
END $$;

COMMENT ON COLUMN core.devices.slug IS 'User-friendly URL slug for this device (e.g., "scenic-valley-entrance")';
COMMENT ON COLUMN core.devices.slug_is_active IS 'Whether the slug is active for public access';
COMMENT ON COLUMN core.devices.custom_name IS 'Custom display name override for branding';
COMMENT ON COLUMN core.devices.custom_description IS 'Custom description for this access point';
COMMENT ON COLUMN core.devices.custom_logo_url IS 'Custom logo URL for branded pages';

-- ============================================================================
-- STEP 3: Migrate existing data from accesspoint_slugs to devices
-- ============================================================================

-- Only copy fields that exist in accesspoint_slugs table
UPDATE core.devices d
SET 
  slug = aps.slug,
  slug_is_active = aps.is_active
FROM pass.accesspoint_slugs aps
WHERE d.id = aps.device_id
  AND aps.is_active = true;

-- Note: custom_name, custom_description, custom_logo_url will be NULL initially
-- These should be populated from customer data collection template

-- ============================================================================
-- STEP 4: Recreate v_accesspoint_details view to use devices.slug
-- ============================================================================

CREATE VIEW pass.v_accesspoint_details AS
SELECT 
  d.id,
  d.slug,
  d.id AS device_id,
  COALESCE(d.custom_name, d.name) AS accesspoint_name,
  d.code AS accesspoint_code,
  d.slug_is_active AS is_active,
  d.custom_description,
  d.custom_logo_url,
  s.id AS site_id,
  s.name AS site_name,
  s.city AS site_city,
  s.state AS site_state,
  o.id AS org_id,
  o.name AS org_name,
  o.slug AS org_slug,
  o.timezone AS org_timezone
FROM core.devices d
INNER JOIN core.floors f ON d.floor_id = f.id
INNER JOIN core.buildings b ON f.building_id = b.id
INNER JOIN core.sites s ON b.site_id = s.id
INNER JOIN core.organisations o ON s.org_id = o.id
WHERE d.slug IS NOT NULL 
  AND d.slug_is_active = true;

COMMENT ON VIEW pass.v_accesspoint_details IS 'Public view of access points with slugs and branding information';

-- ============================================================================
-- STEP 5: Drop old accesspoint_slugs table (optional - wait until verified)
-- ============================================================================

-- Uncomment when ready to fully migrate and all apps use devices.slug:
-- DROP TABLE IF EXISTS pass.accesspoint_slugs CASCADE;

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Check devices with slugs
SELECT id, name, slug, slug_is_active, custom_name 
FROM core.devices 
WHERE slug IS NOT NULL;

-- Check new view
SELECT * FROM pass.v_accesspoint_details LIMIT 5;

-- Count comparison
SELECT 
  (SELECT COUNT(*) FROM core.devices WHERE slug IS NOT NULL) AS devices_with_slugs,
  (SELECT COUNT(*) FROM pass.accesspoint_slugs WHERE is_active = true) AS old_slug_records;
