-- Grant permissions on the v_accesspoint_details view
-- This allows the service role (and potentially anon users) to read from the view

-- Grant usage on the pass schema
GRANT USAGE ON SCHEMA pass TO service_role;
GRANT USAGE ON SCHEMA pass TO anon;

-- Grant select permission on the view
GRANT SELECT ON pass.v_accesspoint_details TO service_role;
GRANT SELECT ON pass.v_accesspoint_details TO anon;

-- If there are any RLS policies, ensure they allow access
ALTER VIEW pass.v_accesspoint_details OWNER TO postgres;

-- Verify the grants
SELECT 
    grantee,
    privilege_type
FROM information_schema.role_table_grants 
WHERE table_schema = 'pass' 
  AND table_name = 'v_accesspoint_details';
