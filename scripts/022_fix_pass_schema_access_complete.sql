-- Fix schema-level permissions for pass schema
-- This addresses error 42501: "permission denied for schema pass"
--
-- PostgreSQL privilege hierarchy:
-- 1. USAGE on schema (allows seeing into the schema)
-- 2. SELECT/INSERT/UPDATE/DELETE on table (controlled by GRANT)
-- 3. RLS policies (filters which rows are visible)
--
-- Even service_role needs USAGE on non-public schemas.
-- Error 42501 happens at step 1, before RLS can even evaluate.

-- Grant schema-level USAGE to all roles
GRANT USAGE ON SCHEMA pass TO anon, authenticated, service_role;

-- Grant SELECT on accesspoint_slugs for redirect lookups
-- RLS policy "accesspoint_slugs_public_read" already filters rows
GRANT SELECT ON pass.accesspoint_slugs TO anon, authenticated;

-- Grant SELECT on pass_types for public purchase flow
-- RLS policy "Allow anon to read active pass types" already filters rows
GRANT SELECT ON pass.pass_types TO anon, authenticated;

-- Service role needs explicit grants even though it bypasses RLS
GRANT ALL ON ALL TABLES IN SCHEMA pass TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA pass TO service_role;

-- Removed verification block that queried information_schema.role_schema_grants
-- which doesn't exist in Supabase. Grants will succeed silently if already applied.
