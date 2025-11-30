-- Minimal Tenant Configuration Template
-- Copy this template and customize for each new tenant/organization

-- ============================================================================
-- STEP 1: Create Organization
-- ============================================================================
-- Replace these values with your tenant's information:
--   - {ORG_UUID}: Generate a new UUID for this organization
--   - {ORG_NAME}: Your organization name (e.g., "Zezamii Pty Ltd")
--   - {ORG_SLUG}: URL-safe slug (e.g., "zezamii")
--   - {BILLING_EMAIL}: Billing contact email

INSERT INTO core.organisations (
  id,
  name,
  slug,
  tier_id,
  billing_email,
  timezone,
  locale,
  created_at
)
VALUES (
  '{ORG_UUID}'::uuid,  -- e.g., '20000000-0000-0000-0000-000000000001'
  '{ORG_NAME}',         -- e.g., 'Zezamii Pty Ltd'
  '{ORG_SLUG}',         -- e.g., 'zezamii'
  '00000000-0000-0000-0000-000000000010'::uuid,  -- Standard tier
  '{BILLING_EMAIL}',    -- e.g., 'billing@zezamii.com'
  'Australia/Sydney',   -- Adjust timezone as needed
  'en-AU',              -- Adjust locale as needed
  NOW()
);

-- ============================================================================
-- STEP 2: Create Site
-- ============================================================================
-- Replace these values:
--   - {SITE_UUID}: Generate a new UUID for this site
--   - {SITE_NAME}: Site name (e.g., "Main Office")
--   - {ADDRESS}, {CITY}, {STATE}, {POSTCODE}: Physical address

INSERT INTO core.sites (
  id,
  organisation_id,
  name,
  address,
  city,
  state,
  country,
  postal_code,
  created_at
)
VALUES (
  '{SITE_UUID}'::uuid,  -- e.g., '20000000-0000-0000-0000-000000000002'
  '{ORG_UUID}'::uuid,
  '{SITE_NAME}',        -- e.g., 'Main Office'
  '{ADDRESS}',          -- e.g., '123 George Street'
  '{CITY}',             -- e.g., 'Sydney'
  '{STATE}',            -- e.g., 'NSW'
  'Australia',
  '{POSTCODE}',         -- e.g., '2000'
  NOW()
);

-- ============================================================================
-- STEP 3: Create Building and Floor (Required for devices)
-- ============================================================================

INSERT INTO core.buildings (
  id,
  organisation_id,
  site_id,
  name,
  type,
  created_at
)
VALUES (
  '{BUILDING_UUID}'::uuid,  -- e.g., '20000000-0000-0000-0000-000000000006'
  '{ORG_UUID}'::uuid,
  '{SITE_UUID}'::uuid,
  'Main Building',
  'entrance',
  NOW()
);

INSERT INTO core.floors (
  id,
  organisation_id,
  building_id,
  name,
  level_rank,
  width_meters,
  height_meters,
  width_pixels,
  height_pixels,
  orientation,
  created_at
)
VALUES (
  '{FLOOR_UUID}'::uuid,  -- e.g., '20000000-0000-0000-0000-000000000007'
  '{ORG_UUID}'::uuid,
  '{BUILDING_UUID}'::uuid,
  'Ground Floor',
  0,
  50.0,
  30.0,
  1000,
  600,
  0.0,
  NOW()
);

-- ============================================================================
-- STEP 4: Create Access Point Device
-- ============================================================================
-- Replace these values:
--   - {DEVICE_UUID}: Generate a new UUID for this access point
--   - {DEVICE_NAME}: User-friendly name (e.g., "Main Entrance")
--   - {DEVICE_CODE}: Internal code (e.g., "AP-MAIN-001")

INSERT INTO core.devices (
  id,
  organisation_id,
  floor_id,
  name,
  code,
  category,
  status,
  created_at
)
VALUES (
  '{DEVICE_UUID}'::uuid,  -- e.g., '20000000-0000-0000-0000-000000000003'
  '{ORG_UUID}'::uuid,
  '{FLOOR_UUID}'::uuid,
  '{DEVICE_NAME}',        -- e.g., 'Main Entrance Access Point'
  '{DEVICE_CODE}',        -- e.g., 'AP-MAIN-001'
  'lock',
  'active',
  NOW()
);

-- ============================================================================
-- STEP 5: Create Pass Types
-- ============================================================================
-- Customize pricing and duration for your use case

-- Day Pass
INSERT INTO pass.pass_types (
  id,
  organisation_id,
  name,
  description,
  code,
  price_cents,
  currency,
  duration_minutes,
  is_active,
  created_at
)
VALUES (
  '{DAY_PASS_UUID}'::uuid,  -- e.g., '20000000-0000-0000-0000-000000000004'
  '{ORG_UUID}'::uuid,
  'Day Pass',
  'Valid for 12 hours of access',
  'DAY',
  2500,  -- $25.00 AUD
  'aud',
  720,   -- 12 hours
  true,
  NOW()
);

-- Extended Pass
INSERT INTO pass.pass_types (
  id,
  organisation_id,
  name,
  description,
  code,
  price_cents,
  currency,
  duration_minutes,
  is_active,
  created_at
)
VALUES (
  '{EXTENDED_PASS_UUID}'::uuid,  -- e.g., '20000000-0000-0000-0000-000000000005'
  '{ORG_UUID}'::uuid,
  'Extended Pass',
  'Valid for 24 hours of access',
  'EXTENDED',
  5000,  -- $50.00 AUD
  'aud',
  1440,  -- 24 hours
  true,
  NOW()
);

-- ============================================================================
-- STEP 6: Create Slug Mapping (Optional - for branded URLs)
-- ============================================================================
-- This enables URLs like /p/your-site-entrance instead of /ap/{uuid}

INSERT INTO pass.accesspoint_slugs (
  id,
  organisation_id,
  site_id,
  device_id,
  org_slug,
  site_slug,
  accesspoint_slug,
  slug,  -- Full slug path: org/site/accesspoint
  is_active,
  created_at
)
VALUES (
  '{SLUG_UUID}'::uuid,  -- e.g., '20000000-0000-0000-0000-000000000009'
  '{ORG_UUID}'::uuid,
  '{SITE_UUID}'::uuid,
  '{DEVICE_UUID}'::uuid,
  '{ORG_SLUG}',              -- e.g., 'zezamii'
  '{SITE_SLUG}',             -- e.g., 'main-office'
  '{ACCESSPOINT_SLUG}',      -- e.g., 'entrance'
  '{ORG_SLUG}/{SITE_SLUG}/{ACCESSPOINT_SLUG}',  -- e.g., 'zezamii/main-office/entrance'
  true,
  NOW()
);

-- ============================================================================
-- STEP 7: Configure Rooms Event Hub Integration (Optional)
-- ============================================================================
-- Only needed if you want to generate lock codes via Rooms API

INSERT INTO core.integrations (
  id,
  organisation_id,
  integration_type,
  name,
  config,
  credentials,
  status,
  created_at
)
VALUES (
  '{INTEGRATION_UUID}'::uuid,  -- e.g., '20000000-0000-0000-0000-000000000010'
  '{ORG_UUID}'::uuid,
  'rooms_event_hub',
  'Rooms Lock System',
  jsonb_build_object(
    'base_url', 'https://sender.rooms.zezamii.com/v1/webhooks',
    'webhook_path', 'zezamiiPass/reservation',
    'property_id', '{ROOMS_PROPERTY_ID}',  -- Your Rooms property ID
    'timeout_ms', 5000,
    'retry_attempts', 3
  ),
  jsonb_build_object(
    'reservation_id_prefix', '{PREFIX}'  -- e.g., 'ZEZ'
  ),
  'active',
  NOW()
);

-- ============================================================================
-- Verification Queries
-- ============================================================================
-- Run these to confirm your data was created correctly:

SELECT 'Organization:' AS type, id, name, slug FROM core.organisations WHERE id = '{ORG_UUID}'::uuid;
SELECT 'Site:' AS type, id, name FROM core.sites WHERE id = '{SITE_UUID}'::uuid;
SELECT 'Device:' AS type, id, name, code FROM core.devices WHERE id = '{DEVICE_UUID}'::uuid;
SELECT 'Pass Types:' AS type, id, name, code, price_cents, duration_minutes FROM pass.pass_types WHERE organisation_id = '{ORG_UUID}'::uuid;
SELECT 'Slug:' AS type, slug FROM pass.accesspoint_slugs WHERE device_id = '{DEVICE_UUID}'::uuid;
SELECT 'Integration:' AS type, name, status FROM core.integrations WHERE organisation_id = '{ORG_UUID}'::uuid;

-- ============================================================================
-- Environment Variables to Set
-- ============================================================================
-- After running this script, update your environment variables:

/*
NEXT_PUBLIC_ENTRY_ACCESS_POINT_ID={DEVICE_UUID}  
NEXT_PUBLIC_DEFAULT_ORG_ID={ORG_UUID}            (optional, for /p/* URLs)

For production:
APP_ORIGIN=https://yourdomain.com
*/

-- ============================================================================
-- Access URLs
-- ============================================================================
-- Your access point will be available at:
--   UUID URL:  /ap/{DEVICE_UUID}
--   Slug URL:  /p/{ORG_SLUG}/{SITE_SLUG}/{ACCESSPOINT_SLUG}
