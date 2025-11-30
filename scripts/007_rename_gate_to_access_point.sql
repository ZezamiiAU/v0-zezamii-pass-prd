-- Migration: Rename gate_id to access_point_id
-- This migration renames the gate_id column to access_point_id in the pass_token_usage table
-- to align with the application-wide terminology change from "gate" to "access point"

-- Step 1: Rename the column
ALTER TABLE pass.pass_token_usage 
RENAME COLUMN gate_id TO access_point_id;

-- Step 2: Update the comment
COMMENT ON COLUMN pass.pass_token_usage.access_point_id IS 'UUID of the access point (device) where token was used';

-- Verification query
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'pass' 
  AND table_name = 'pass_token_usage' 
  AND column_name = 'access_point_id';

-- Display confirmation
SELECT 'Migration complete: gate_id renamed to access_point_id in pass.pass_token_usage' as status;
