-- Clear ALL seed/test data from the database
-- WARNING: This will delete ALL test organisations, sites, devices, pass types, AND PASSES
-- Only run on development/testing databases
-- DO NOT run on production without verifying first

-- Set variable for safety check
DO $$ 
BEGIN
  -- Safety check: prevent accidental deletion on production
  IF current_database() = 'production' THEN
    RAISE EXCEPTION 'Cannot run seed cleanup on production database!';
  END IF;
END $$;

-- Display what will be deleted
SELECT '=== SEED DATA TO BE DELETED ===' as info;
SELECT 'Passes:' as category, COUNT(*) as count FROM pass.passes;
SELECT 'Lock Codes:' as category, COUNT(*) as count FROM pass.lock_codes;
SELECT 'Pass Types:' as category, COUNT(*) as count FROM pass.pass_types;
SELECT 'Provider Devices:' as category, COUNT(*) as count FROM vision.provider_devices;
SELECT 'Devices:' as category, COUNT(*) as count FROM core.devices;
SELECT 'Floors:' as category, COUNT(*) as count FROM core.floors;
SELECT 'Buildings:' as category, COUNT(*) as count FROM core.buildings;
SELECT 'Sites:' as category, COUNT(*) as count FROM core.sites;
SELECT 'Organisations:' as category, COUNT(*) as count FROM core.organisations;
SELECT 'Organisation Tiers:' as category, COUNT(*) as count FROM core.organisation_tiers;

-- Delete in proper cascade order (children first, parents last)

-- Delete in correct order respecting ALL foreign key constraints

-- 1. Delete lock codes (references passes)
DELETE FROM pass.lock_codes WHERE id IS NOT NULL;

-- 2. Delete passes (references pass_types and devices)
DELETE FROM pass.passes WHERE id IS NOT NULL;

-- 3. Delete pass types (references organisations)
DELETE FROM pass.pass_types WHERE id IS NOT NULL;

-- 4. Delete provider_devices (references devices) - MUST BE BEFORE DEVICES
DELETE FROM vision.provider_devices WHERE id IS NOT NULL;

-- 5. Delete devices (references floors)
DELETE FROM core.devices WHERE id IS NOT NULL;

-- 6. Delete floors (references buildings)
DELETE FROM core.floors WHERE id IS NOT NULL;

-- 7. Delete buildings (references sites)
DELETE FROM core.buildings WHERE id IS NOT NULL;

-- 8. Delete sites (references organisations)
DELETE FROM core.sites WHERE id IS NOT NULL;

-- 9. Delete organisations (references tiers)
DELETE FROM core.organisations WHERE id IS NOT NULL;

-- 10. Delete organisation tiers (no dependencies)
DELETE FROM core.organisation_tiers WHERE id IS NOT NULL;

-- Verify cleanup
SELECT '=== CLEANUP COMPLETE ===' as info;
SELECT 'Remaining Passes:' as category, COUNT(*) as count FROM pass.passes;
SELECT 'Remaining Lock Codes:' as category, COUNT(*) as count FROM pass.lock_codes;
SELECT 'Remaining Pass Types:' as category, COUNT(*) as count FROM pass.pass_types;
SELECT 'Remaining Provider Devices:' as category, COUNT(*) as count FROM vision.provider_devices;
SELECT 'Remaining Devices:' as category, COUNT(*) as count FROM core.devices;
SELECT 'Remaining Floors:' as category, COUNT(*) as count FROM core.floors;
SELECT 'Remaining Buildings:' as category, COUNT(*) as count FROM core.buildings;
SELECT 'Remaining Sites:' as category, COUNT(*) as count FROM core.sites;
SELECT 'Remaining Organisations:' as category, COUNT(*) as count FROM core.organisations;
SELECT 'Remaining Organisation Tiers:' as category, COUNT(*) as count FROM core.organisation_tiers;

-- Instructions:
SELECT '=== NEXT STEPS ===' as info;
SELECT '1. Use templates/DATA_COLLECTION_TEMPLATE.md to gather customer data' as step;
SELECT '2. Fill in templates/tenant-config-template.json with real customer data' as step;
SELECT '3. Run: npm run template:sql tenant-config.json (if you have this script)' as step;
SELECT '4. Execute the generated SQL to load customer data' as step;
SELECT '5. Run: npm run stripe:sync to create Stripe products' as step;
