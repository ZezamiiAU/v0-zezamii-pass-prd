-- Migration: Add QR instance ID to devices and create QR scan tracking table
-- Run this migration to enable QR code tracking functionality

-- Step 1: Add qr_instance_id column to devices table
ALTER TABLE core.devices
ADD COLUMN IF NOT EXISTS qr_instance_id text UNIQUE;

COMMENT ON COLUMN core.devices.qr_instance_id IS 'Unique identifier for physical QR code instance (for tracking multiple QR codes per device)';

-- Step 2: Create qr_scans tracking table
CREATE TABLE IF NOT EXISTS core.qr_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid REFERENCES core.devices(id) ON DELETE CASCADE,
  qr_instance_id text,
  slug text,
  org_id uuid REFERENCES core.organisations(id) ON DELETE CASCADE,
  user_agent text,
  ip_address text,
  source text DEFAULT 'qr',
  scanned_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE core.qr_scans IS 'Tracks QR code scans for analytics and usage monitoring';

-- Step 3: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_qr_scans_device_id ON core.qr_scans(device_id);
CREATE INDEX IF NOT EXISTS idx_qr_scans_qr_instance_id ON core.qr_scans(qr_instance_id);
CREATE INDEX IF NOT EXISTS idx_qr_scans_org_id ON core.qr_scans(org_id);
CREATE INDEX IF NOT EXISTS idx_qr_scans_scanned_at ON core.qr_scans(scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_devices_qr_instance_id ON core.devices(qr_instance_id) WHERE qr_instance_id IS NOT NULL;

-- Step 4: Enable RLS on qr_scans table
ALTER TABLE core.qr_scans ENABLE ROW LEVEL SECURITY;

-- Step 5: Create RLS policies for qr_scans
-- Allow service role full access (for server-side tracking)
CREATE POLICY "qr_scans service role all"
ON core.qr_scans
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Step 6: Update v_accesspoint_details view to include qr_instance_id
CREATE OR REPLACE VIEW pass.v_accesspoint_details AS
SELECT 
  d.slug,
  d.qr_instance_id,
  d.id AS device_id,
  COALESCE(d.custom_name, d.name) AS device_name,
  s.id AS site_id,
  s.name AS site_name,
  o.id AS org_id,
  o.name AS org_name,
  COALESCE(d.custom_logo_url, o.logo_url) AS org_logo_url,
  COALESCE(d.custom_description, s.description) AS description,
  (d.slug_is_active AND o.is_active) AS is_active
FROM core.devices d
INNER JOIN core.floors f ON d.floor_id = f.id
INNER JOIN core.buildings b ON f.building_id = b.id
INNER JOIN core.sites s ON b.site_id = s.id
INNER JOIN core.organisations o ON s.organisation_id = o.id
WHERE d.slug IS NOT NULL;

COMMENT ON VIEW pass.v_accesspoint_details IS 'Provides access point details for pass purchase portal with QR instance tracking';

-- Verification queries
-- Check devices with QR instance IDs
SELECT id, name, slug, qr_instance_id 
FROM core.devices 
WHERE qr_instance_id IS NOT NULL 
LIMIT 5;

-- Check recent QR scans
SELECT * 
FROM core.qr_scans 
ORDER BY scanned_at DESC 
LIMIT 10;
