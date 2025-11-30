-- Clear ONLY Big Parks test organization and related data
-- This preserves operational data (ai_events, qr_scans, etc.) and real customer organizations

BEGIN;

-- Delete ALL passes that reference Big Parks devices first
-- 1. Delete lock codes for passes at Big Parks devices
DELETE FROM pass.lock_codes
WHERE pass_id IN (
  SELECT id FROM pass.passes
  WHERE device_id IN (
    SELECT id FROM core.devices 
    WHERE org_id IN (
      SELECT id FROM core.organisations WHERE name = 'Big Parks'
    )
  )
);

-- 2. Delete ALL passes at Big Parks devices (regardless of pass type org)
DELETE FROM pass.passes
WHERE device_id IN (
  SELECT id FROM core.devices 
  WHERE org_id IN (
    SELECT id FROM core.organisations WHERE name = 'Big Parks'
  )
);

-- 3. Delete passes for Big Parks pass types (if any remain)
DELETE FROM pass.lock_codes
WHERE pass_id IN (
  SELECT p.id 
  FROM pass.passes p
  JOIN pass.pass_types pt ON p.pass_type_id = pt.id
  WHERE pt.org_id IN (
    SELECT id FROM core.organisations WHERE name = 'Big Parks'
  )
);

DELETE FROM pass.passes
WHERE pass_type_id IN (
  SELECT id FROM pass.pass_types 
  WHERE org_id IN (
    SELECT id FROM core.organisations WHERE name = 'Big Parks'
  )
);

-- 4. Delete pass types for Big Parks
DELETE FROM pass.pass_types
WHERE org_id IN (
  SELECT id FROM core.organisations WHERE name = 'Big Parks'
);

-- 5. Delete provider_devices for Big Parks devices
DELETE FROM vision.provider_devices
WHERE device_id IN (
  SELECT id FROM core.devices 
  WHERE org_id IN (
    SELECT id FROM core.organisations WHERE name = 'Big Parks'
  )
);

-- 6. Delete devices for Big Parks
DELETE FROM core.devices
WHERE org_id IN (
  SELECT id FROM core.organisations WHERE name = 'Big Parks'
);

-- 7. Delete floors for Big Parks buildings
DELETE FROM core.floors
WHERE building_id IN (
  SELECT id FROM core.buildings 
  WHERE site_id IN (
    SELECT id FROM core.sites 
    WHERE org_id IN (
      SELECT id FROM core.organisations WHERE name = 'Big Parks'
    )
  )
);

-- 8. Delete buildings for Big Parks sites
DELETE FROM core.buildings
WHERE site_id IN (
  SELECT id FROM core.sites 
  WHERE org_id IN (
    SELECT id FROM core.organisations WHERE name = 'Big Parks'
  )
);

-- 9. Delete sites for Big Parks
DELETE FROM core.sites
WHERE org_id IN (
  SELECT id FROM core.organisations WHERE name = 'Big Parks'
);

-- 10. Delete Big Parks organisation
DELETE FROM core.organisations
WHERE name = 'Big Parks';

COMMIT;

-- Verification
SELECT 
  'After cleanup - Big Parks should be gone' as status,
  (SELECT COUNT(*) FROM core.organisations WHERE name = 'Big Parks') as big_parks_orgs,
  (SELECT COUNT(*) FROM core.organisations) as total_orgs,
  (SELECT COUNT(*) FROM pass.pass_types) as total_pass_types,
  (SELECT COUNT(*) FROM pass.passes) as total_passes;

-- Show remaining organizations (should only be real customers)
SELECT id, name, slug, created_at 
FROM core.organisations 
ORDER BY created_at;
