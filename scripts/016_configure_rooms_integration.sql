-- Configure Rooms Event Hub Integration for Duvan's Lock System
-- Run this script AFTER getting the correct org_id from Duvan tomorrow

-- Step 1: Get your organisation_id
-- SELECT id, name FROM api.organisations WHERE name ILIKE '%your-org-name%';

-- Step 2: Insert or update the integration configuration
-- Replace 'YOUR_ORG_ID_HERE' with actual UUID from Step 1

INSERT INTO core.integrations (
  id,
  organisation_id,
  integration_type,
  name,
  status,
  config,
  credentials,
  created_at,
  updated_at
)
VALUES (
  gen_random_uuid(),
  'YOUR_ORG_ID_HERE'::uuid, -- TODO: Replace with actual org_id tomorrow
  'rooms_event_hub',
  'Rooms Lock System (Production)',
  'active',
  jsonb_build_object(
    'base_url', 'https://sender.rooms.zezamii.com',
    'webhook_path', '/webhooks/zezamiiPass/reservation/z71owzgoNUxJtxOC',
    'pin_digit_length', 4,
    'environment', 'production'
  ),
  jsonb_build_object(
    'property_id', 'TODO_GET_FROM_DUVAN', -- TODO: Get propertyId from Duvan tomorrow
    'lock_id', 'TODO_GET_FROM_DUVAN'      -- TODO: Get lockId from Duvan tomorrow
  ),
  NOW(),
  NOW()
)
ON CONFLICT (organisation_id, integration_type) 
DO UPDATE SET
  status = 'active',
  config = jsonb_build_object(
    'base_url', 'https://sender.rooms.zezamii.com',
    'webhook_path', '/webhooks/zezamiiPass/reservation/z71owzgoNUxJtxOC',
    'pin_digit_length', 4,
    'environment', 'production'
  ),
  credentials = jsonb_build_object(
    'property_id', 'TODO_GET_FROM_DUVAN',
    'lock_id', 'TODO_GET_FROM_DUVAN'
  ),
  updated_at = NOW();

-- Step 3: Verify the configuration
SELECT 
  id,
  organisation_id,
  integration_type,
  name,
  status,
  config,
  credentials,
  created_at,
  updated_at
FROM core.integrations
WHERE integration_type = 'rooms_event_hub';

-- Step 4: Set PIN code length to 4 digits in site settings (if not already set)
-- Replace 'YOUR_SITE_ID_HERE' with actual site_id

-- First, check if site_settings exists
SELECT * FROM core.site_settings WHERE site_id = 'YOUR_SITE_ID_HERE'::uuid;

-- If no row exists, insert one
INSERT INTO core.site_settings (
  id,
  site_id,
  pincode_digit_length,
  created_at,
  updated_at
)
VALUES (
  gen_random_uuid(),
  'YOUR_SITE_ID_HERE'::uuid, -- TODO: Replace with actual site_id
  4, -- Duvan's system uses 4-digit PINs
  NOW(),
  NOW()
)
ON CONFLICT (site_id) 
DO UPDATE SET
  pincode_digit_length = 4,
  updated_at = NOW();
