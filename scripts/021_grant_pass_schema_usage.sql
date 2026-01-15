-- Grant USAGE on pass schema to anon role
-- This allows anon to see tables within the schema, RLS policies then control what rows are visible

-- Grant USAGE on the pass schema
GRANT USAGE ON SCHEMA pass TO anon;
GRANT USAGE ON SCHEMA pass TO authenticated;

-- Verify specific table grants for accesspoint_slugs
GRANT SELECT ON pass.accesspoint_slugs TO anon;
GRANT SELECT ON pass.accesspoint_slugs TO authenticated;

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Successfully granted USAGE on pass schema to anon and authenticated roles';
END $$;
