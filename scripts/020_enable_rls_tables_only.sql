-- ============================================================
-- Migration: Enable RLS on ACTUAL TABLES only (skip views/foreign tables)
-- Uses pg_class to definitively check if relation is a table
-- ============================================================

DO $$
DECLARE
  tbl RECORD;
  relkind_result char;
BEGIN
  -- Check each relation and only enable RLS on actual tables (relkind = 'r')
  -- relkind values: 'r' = ordinary table, 'v' = view, 'm' = materialized view, 
  --                 'f' = foreign table, 'p' = partitioned table
  FOR tbl IN 
    SELECT * FROM (VALUES
      -- api schema (these may be views/foreign tables - we'll check)
      ('api', 'areas'),
      ('api', 'buildings'),
      ('api', 'devices'),
      ('api', 'floors'),
      ('api', 'organisations'),
      ('api', 'sites'),
      -- core schema without RLS
      ('core', 'audit_log'),
      ('core', 'feature_flags'),
      ('core', 'org_licenses'),
      ('core', 'org_module_licenses'),
      ('core', 'customers'),
      ('core', 'integrations'),
      ('core', 'team_members'),
      -- events schema
      ('events', 'webhook_deliveries'),
      -- analytics schema
      ('analytics', 'qr_scans'),
      -- ops schema
      ('ops', 'device_onboarding'),
      ('ops', 'work_orders'),
      ('ops', 'work_order_items'),
      ('ops', 'qr_tokens')
    ) AS t(schema_name, table_name)
  LOOP
    -- Get the relation kind from pg_class
    SELECT c.relkind INTO relkind_result
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = tbl.schema_name 
      AND c.relname = tbl.table_name;
    
    IF relkind_result IS NULL THEN
      RAISE NOTICE 'Skipping %.% - relation does not exist', tbl.schema_name, tbl.table_name;
    ELSIF relkind_result = 'r' OR relkind_result = 'p' THEN
      -- 'r' = ordinary table, 'p' = partitioned table - both support RLS
      EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', tbl.schema_name, tbl.table_name);
      RAISE NOTICE 'Enabled RLS on table: %.%', tbl.schema_name, tbl.table_name;
    ELSE
      RAISE NOTICE 'Skipping %.% - not a table (relkind=%)', tbl.schema_name, tbl.table_name, relkind_result;
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- Create policies only for tables that now have RLS enabled
-- ============================================================

DO $$
DECLARE
  tbl RECORD;
  has_rls boolean;
  has_org_id boolean;
  has_organisation_id boolean;
BEGIN
  FOR tbl IN 
    SELECT * FROM (VALUES
      ('core', 'audit_log'),
      ('core', 'feature_flags'),
      ('core', 'org_licenses'),
      ('core', 'org_module_licenses'),
      ('core', 'customers'),
      ('core', 'integrations'),
      ('core', 'team_members'),
      ('events', 'webhook_deliveries'),
      ('analytics', 'qr_scans'),
      ('ops', 'device_onboarding'),
      ('ops', 'work_orders'),
      ('ops', 'work_order_items'),
      ('ops', 'qr_tokens')
    ) AS t(schema_name, table_name)
  LOOP
    -- Check if RLS is enabled on this table
    SELECT relrowsecurity INTO has_rls
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = tbl.schema_name AND c.relname = tbl.table_name;
    
    IF NOT COALESCE(has_rls, false) THEN
      RAISE NOTICE 'Skipping policies for %.% - RLS not enabled', tbl.schema_name, tbl.table_name;
      CONTINUE;
    END IF;
    
    -- Check which org column exists
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = tbl.schema_name 
        AND table_name = tbl.table_name 
        AND column_name = 'org_id'
    ) INTO has_org_id;
    
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = tbl.schema_name 
        AND table_name = tbl.table_name 
        AND column_name = 'organisation_id'
    ) INTO has_organisation_id;
    
    -- Service role bypass policy (always)
    EXECUTE format(
      'DROP POLICY IF EXISTS "%s_service_role_bypass" ON %I.%I',
      tbl.table_name, tbl.schema_name, tbl.table_name
    );
    EXECUTE format(
      'CREATE POLICY "%s_service_role_bypass" ON %I.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      tbl.table_name, tbl.schema_name, tbl.table_name
    );
    
    -- Org-based read policy for authenticated users
    IF has_org_id THEN
      EXECUTE format(
        'DROP POLICY IF EXISTS "%s_org_read" ON %I.%I',
        tbl.table_name, tbl.schema_name, tbl.table_name
      );
      EXECUTE format(
        'CREATE POLICY "%s_org_read" ON %I.%I FOR SELECT TO authenticated 
         USING (org_id IN (
           SELECT org_id FROM core.memberships 
           WHERE user_id = auth.uid() AND status = ''active''
         ))',
        tbl.table_name, tbl.schema_name, tbl.table_name
      );
    ELSIF has_organisation_id THEN
      EXECUTE format(
        'DROP POLICY IF EXISTS "%s_org_read" ON %I.%I',
        tbl.table_name, tbl.schema_name, tbl.table_name
      );
      EXECUTE format(
        'CREATE POLICY "%s_org_read" ON %I.%I FOR SELECT TO authenticated 
         USING (organisation_id IN (
           SELECT org_id FROM core.memberships 
           WHERE user_id = auth.uid() AND status = ''active''
         ))',
        tbl.table_name, tbl.schema_name, tbl.table_name
      );
    END IF;
    
    RAISE NOTICE 'Created policies for: %.%', tbl.schema_name, tbl.table_name;
  END LOOP;
END $$;

-- ============================================================
-- Special case: analytics.qr_scans needs anon insert for tracking
-- ============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'analytics' AND c.relname = 'qr_scans' AND c.relrowsecurity = true
  ) THEN
    DROP POLICY IF EXISTS "qr_scans_anon_insert" ON analytics.qr_scans;
    CREATE POLICY "qr_scans_anon_insert" ON analytics.qr_scans 
      FOR INSERT TO anon WITH CHECK (true);
    RAISE NOTICE 'Created anon insert policy for analytics.qr_scans';
  END IF;
END $$;

-- ============================================================
-- Special case: events.webhook_deliveries needs join through subscription
-- ============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'events' AND c.relname = 'webhook_deliveries' AND c.relrowsecurity = true
  ) THEN
    DROP POLICY IF EXISTS "webhook_deliveries_org_read" ON events.webhook_deliveries;
    CREATE POLICY "webhook_deliveries_org_read" ON events.webhook_deliveries 
      FOR SELECT TO authenticated 
      USING (subscription_id IN (
        SELECT id FROM events.webhook_subscriptions 
        WHERE org_id IN (
          SELECT org_id FROM core.memberships 
          WHERE user_id = auth.uid() AND status = 'active'
        )
      ));
    RAISE NOTICE 'Created org read policy for events.webhook_deliveries';
  END IF;
END $$;

-- ============================================================
-- Verification: Show what was actually enabled
-- ============================================================
SELECT 
  n.nspname AS schema,
  c.relname AS table_name,
  CASE c.relkind 
    WHEN 'r' THEN 'table'
    WHEN 'v' THEN 'view'
    WHEN 'm' THEN 'materialized view'
    WHEN 'f' THEN 'foreign table'
    WHEN 'p' THEN 'partitioned table'
    ELSE c.relkind::text
  END AS type,
  c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE (n.nspname, c.relname) IN (
  ('api', 'areas'), ('api', 'buildings'), ('api', 'devices'), 
  ('api', 'floors'), ('api', 'organisations'), ('api', 'sites'),
  ('core', 'audit_log'), ('core', 'feature_flags'), ('core', 'org_licenses'),
  ('core', 'org_module_licenses'), ('core', 'customers'), ('core', 'integrations'),
  ('core', 'team_members'), ('events', 'webhook_deliveries'), ('analytics', 'qr_scans'),
  ('ops', 'device_onboarding'), ('ops', 'work_orders'), ('ops', 'work_order_items'),
  ('ops', 'qr_tokens')
)
ORDER BY n.nspname, c.relname;
