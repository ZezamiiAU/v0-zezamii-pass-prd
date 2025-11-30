-- DEPRECATED: Use scripts/100_clear_all_seed_data.sql instead
-- This script only clears pass types, not the full hierarchy

-- Clear all seed data from pass_types table
-- WARNING: This will delete ALL pass types. Run only on development/testing databases.
-- DO NOT run this on production without backing up first.

-- Clear pass types
DELETE FROM pass.pass_types WHERE id IS NOT NULL;

-- Optional: Reset the sequence (if needed)
-- ALTER SEQUENCE pass.pass_types_id_seq RESTART WITH 1;

-- Verify deletion
SELECT COUNT(*) as remaining_pass_types FROM pass.pass_types;

-- Instructions:
-- After running this script:
-- 1. Use the JSON template (templates/tenant-config-template.json) to configure your real pass types
-- 2. Run: npm run template:sql tenant-config.json
-- 3. Execute the generated SQL file
-- 4. Run: npm run stripe:sync to create Stripe products for your pass types
