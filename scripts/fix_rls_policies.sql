-- Enable RLS on pass schema tables
ALTER TABLE pass.pass_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE pass.passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pass.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE pass.lock_codes ENABLE ROW LEVEL SECURITY;

-- Allow anonymous users to read active pass types
CREATE POLICY "Allow anon to read active pass types"
ON pass.pass_types
FOR SELECT
TO anon
USING (is_active = true);

-- Allow anonymous users to insert passes (for purchase)
CREATE POLICY "Allow anon to insert passes"
ON pass.passes
FOR INSERT
TO anon
WITH CHECK (true);

-- Allow anonymous users to insert payments (for purchase)
CREATE POLICY "Allow anon to insert payments"
ON pass.payments
FOR INSERT
TO anon
WITH CHECK (true);

-- Allow service_role full access to all pass tables
CREATE POLICY "Allow service_role full access to pass_types"
ON pass.pass_types
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow service_role full access to passes"
ON pass.passes
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow service_role full access to payments"
ON pass.payments
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow service_role full access to lock_codes"
ON pass.lock_codes
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Prevent anonymous users from reading lock codes directly
-- (they can only get them through the API after successful payment)
CREATE POLICY "Prevent anon from reading lock codes"
ON pass.lock_codes
FOR SELECT
TO anon
USING (false);
