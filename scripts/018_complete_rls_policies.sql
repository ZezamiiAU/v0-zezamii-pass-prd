-- Complete RLS for remaining pass schema tables
-- Run this after existing RLS scripts

-- Enable RLS on pass_token_usage if not already enabled
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'pass' 
        AND tablename = 'pass_token_usage'
        AND rowsecurity = true
    ) THEN
        ALTER TABLE pass.pass_token_usage ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Enable RLS on processed_webhooks if not already enabled  
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'pass' 
        AND tablename = 'processed_webhooks'
        AND rowsecurity = true
    ) THEN
        ALTER TABLE pass.processed_webhooks ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Policies for pass_token_usage
-- Only service_role can access (for internal tracking)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'pass' 
        AND tablename = 'pass_token_usage'
        AND policyname = 'pass_token_usage_service_role_only'
    ) THEN
        CREATE POLICY "pass_token_usage_service_role_only"
        ON pass.pass_token_usage
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true);
    END IF;
END $$;

-- Policies for processed_webhooks
-- Only service_role can access (for idempotency tracking)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'pass' 
        AND tablename = 'processed_webhooks'
        AND policyname = 'processed_webhooks_service_role_only'
    ) THEN
        CREATE POLICY "processed_webhooks_service_role_only"
        ON pass.processed_webhooks
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true);
    END IF;
END $$;

-- Ensure accesspoint_slugs has proper policies
-- Public can read active slugs for resolution
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'pass' 
        AND tablename = 'accesspoint_slugs'
        AND policyname = 'accesspoint_slugs_public_read'
    ) THEN
        CREATE POLICY "accesspoint_slugs_public_read"
        ON pass.accesspoint_slugs
        FOR SELECT
        TO anon, authenticated
        USING (is_active = true);
    END IF;
END $$;

-- Org admins can manage their own slugs
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'pass' 
        AND tablename = 'accesspoint_slugs'
        AND policyname = 'accesspoint_slugs_org_admin_write'
    ) THEN
        CREATE POLICY "accesspoint_slugs_org_admin_write"
        ON pass.accesspoint_slugs
        FOR ALL
        TO authenticated
        USING (
            org_id IN (
                SELECT org_id FROM core.memberships 
                WHERE user_id = auth.uid() 
                AND status = 'active'
            )
        )
        WITH CHECK (
            org_id IN (
                SELECT org_id FROM core.memberships 
                WHERE user_id = auth.uid() 
                AND status = 'active'
            )
        );
    END IF;
END $$;
