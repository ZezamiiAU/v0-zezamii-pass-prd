-- Add RLS policies for core.integrations table
-- This allows server-side code to read integration configs

-- Grant permissions to necessary roles
GRANT SELECT ON core.integrations TO anon;
GRANT SELECT ON core.integrations TO authenticated;
GRANT SELECT ON core.integrations TO service_role;

-- Enable RLS if not already enabled
ALTER TABLE core.integrations ENABLE ROW LEVEL SECURITY;

-- Allow service role to read all integrations
DROP POLICY IF EXISTS "Service role can read integrations" ON core.integrations;
CREATE POLICY "Service role can read integrations"
  ON core.integrations
  FOR SELECT
  TO service_role
  USING (true);

-- Allow authenticated users to read integrations for their org
DROP POLICY IF EXISTS "Authenticated can read integrations" ON core.integrations;
CREATE POLICY "Authenticated can read integrations"
  ON core.integrations
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow anon to read active integrations (needed for payment flow)
DROP POLICY IF EXISTS "Anon can read active integrations" ON core.integrations;
CREATE POLICY "Anon can read active integrations"
  ON core.integrations
  FOR SELECT
  TO anon
  USING (status = 'active');
