-- Add Rooms Event Hub integration for Griffith Boat Club
-- This enables the PWA to call the Rooms API for PIN generation

-- Delete any existing rooms_event_hub integration for this org first
DELETE FROM core.integrations 
WHERE organisation_id = (SELECT id FROM core.organisations WHERE slug = 'griffith-boat')
  AND integration_type = 'rooms_event_hub';

-- Insert the integration record
INSERT INTO core.integrations (
  organisation_id,
  integration_type,
  name,
  status,
  config,
  credentials,
  created_at,
  updated_at
)
SELECT 
  o.id as organisation_id,
  'rooms_event_hub' as integration_type,
  'Rooms Event Hub' as name,
  'active' as status,
  jsonb_build_object(
    'base_url', 'https://sender.rooms.zezamii.com',
    'webhook_path', '/v1/webhooks/zezamiipass/reservation/z71owzgoNUxJtxOC'
  ) as config,
  jsonb_build_object(
    'api_key', 'zzm_live_9f3c6a2e4b8d41f1a7c0e5d9b2f6a4c8'
  ) as credentials,
  NOW() as created_at,
  NOW() as updated_at
FROM core.organisations o
WHERE o.slug = 'griffith-boat';

-- Verify the integration was created
SELECT 
  i.id,
  o.name as organisation_name,
  o.slug as organisation_slug,
  i.integration_type,
  i.status,
  i.config
FROM core.integrations i
JOIN core.organisations o ON o.id = i.organisation_id
WHERE i.integration_type = 'rooms_event_hub';
