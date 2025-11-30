-- Seeds for local development
-- This script creates test data for the Zezamii Day Pass system

-- Insert organisation tier first (required by tier_id NOT NULL constraint)
INSERT INTO core.organisation_tiers (
  id,
  name,
  features,
  limits,
  price_cents,
  created_at
)
VALUES (
  '00000000-0000-0000-0000-000000000010'::uuid,
  'Standard',
  '{"pass_management": true, "stripe_integration": true}'::jsonb,
  '{"max_sites": 10, "max_devices": 100}'::jsonb,
  0,
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Insert organisation with tier_id and billing_email
INSERT INTO core.organisations (
  id,
  name,
  slug,
  tier_id,
  billing_email,
  timezone,
  locale,
  created_at,
  updated_at
)
VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Big Parks',
  'big-parks',
  '00000000-0000-0000-0000-000000000010'::uuid,
  'billing@bigparks.com.au',
  'Australia/Sydney',
  'en-AU',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Insert a test site: "Scenic Site"
INSERT INTO core.sites (
  id,
  organisation_id,
  name,
  address,
  city,
  state,
  country,
  postal_code,
  created_at,
  updated_at
)
VALUES (
  '00000000-0000-0000-0000-000000000002'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Scenic Site',
  '123 Campbell Parade',
  'Sydney',
  'NSW',
  'Australia',
  '2026',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Insert a building (required for floor)
INSERT INTO core.buildings (
  id,
  organisation_id,
  site_id,
  name,
  type,
  created_at,
  updated_at
)
VALUES (
  '00000000-0000-0000-0000-000000000006'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000002'::uuid,
  'Main Entry Building',
  'entrance',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Insert a floor (required by floor_id NOT NULL constraint on devices)
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
  created_at,
  updated_at
)
VALUES (
  '00000000-0000-0000-0000-000000000007'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000006'::uuid,
  'Ground Floor',
  0,
  50.0,
  30.0,
  1000,
  600,
  0.0,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Changed category from 'access_control' to 'lock' to satisfy check constraint
-- Insert a test device (gate) with floor_id reference
INSERT INTO core.devices (
  id,
  organisation_id,
  floor_id,
  name,
  code,
  category,
  status,
  created_at,
  updated_at
)
VALUES (
  '00000000-0000-0000-0000-000000000003'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000007'::uuid,
  'Entry Gate',
  'GATE-ENTRY-001',
  'lock',
  'active',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Insert a test device (access point) with floor_id reference
INSERT INTO core.devices (
  id,
  organisation_id,
  floor_id,
  name,
  code,
  category,
  status,
  created_at,
  updated_at
)
VALUES (
  '00000000-0000-0000-0000-000000000008'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000007'::uuid,
  'Entry Access Point',
  'AP-ENTRY-001',
  'lock',
  'active',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Insert pass type: DAY (2500 cents = $25 AUD, 720 minutes = 12 hours)
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
  created_at,
  updated_at
)
VALUES (
  '00000000-0000-0000-0000-000000000004'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Day Pass',
  'Valid for 12 hours of access',
  'DAY',
  2500,
  'aud',
  720,
  true,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Insert pass type: CAMPING (5000 cents = $50 AUD, 1440 minutes = 24 hours)
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
  created_at,
  updated_at
)
VALUES (
  '00000000-0000-0000-0000-000000000005'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Camping',
  'Valid for 24 hours of access',
  'CAMPING',
  5000,
  'aud',
  1440,
  true,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Display the seed data for reference
SELECT 'Seeded organisation tier:' as info, id, name FROM core.organisation_tiers WHERE id = '00000000-0000-0000-0000-000000000010'::uuid;
SELECT 'Seeded organisation:' as info, id, name FROM core.organisations WHERE id = '00000000-0000-0000-0000-000000000001'::uuid;
SELECT 'Seeded site:' as info, id, name FROM core.sites WHERE id = '00000000-0000-0000-0000-000000000002'::uuid;
SELECT 'Seeded building:' as info, id, name FROM core.buildings WHERE id = '00000000-0000-0000-0000-000000000006'::uuid;
SELECT 'Seeded floor:' as info, id, name FROM core.floors WHERE id = '00000000-0000-0000-0000-000000000007'::uuid;
SELECT 'Seeded device (gate):' as info, id, name, code FROM core.devices WHERE id = '00000000-0000-0000-0000-000000000003'::uuid;
SELECT 'Seeded device (access point):' as info, id, name, code FROM core.devices WHERE id = '00000000-0000-0000-0000-000000000008'::uuid;
SELECT 'Seeded pass types:' as info, id, name, code, price_cents, duration_minutes FROM pass.pass_types WHERE organisation_id = '00000000-0000-0000-0000-000000000001'::uuid;

-- Important: Use this gate ID in your local testing
-- Gate URL: http://localhost:3000/g/00000000-0000-0000-0000-000000000003

-- Important: Use this access point ID in your local testing
-- Access Point URL: http://localhost:3000/ap/00000000-0000-0000-0000-000000000008
