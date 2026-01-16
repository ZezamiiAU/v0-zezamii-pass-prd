-- Seed backup pincodes for Griffith Boat Club
-- 26 fortnights starting Jan 17, 2026
-- Pincodes: 1201 through 1226

-- First, get the Griffith Boat Club org, site, and device IDs
-- This assumes the org slug is 'griffith-boat' and device slug is 'gate-entry'

DO $$
DECLARE
  v_org_id UUID;
  v_site_id UUID;
  v_device_id UUID;
  v_start_date TIMESTAMPTZ := '2026-01-17 00:00:00+11'; -- Australian Eastern time
  v_fortnight_days INTEGER := 14;
  i INTEGER;
BEGIN
  -- Fixed table reference from core.organizations to core.organisations
  -- Get org ID
  SELECT id INTO v_org_id FROM core.organisations WHERE slug = 'griffith-boat' LIMIT 1;
  
  IF v_org_id IS NULL THEN
    RAISE NOTICE 'Organization griffith-boat not found, skipping seed';
    RETURN;
  END IF;
  
  -- Get site ID (first site for this org, since sites don't have slugs)
  SELECT id INTO v_site_id FROM core.sites WHERE org_id = v_org_id LIMIT 1;
  
  IF v_site_id IS NULL THEN
    RAISE NOTICE 'No site found for griffith-boat, skipping seed';
    RETURN;
  END IF;
  
  -- Get device ID (gate-entry by slug)
  SELECT id INTO v_device_id FROM core.devices WHERE site_id = v_site_id AND slug = 'gate-entry' LIMIT 1;
  
  IF v_device_id IS NULL THEN
    RAISE NOTICE 'Device gate-entry not found, skipping seed';
    RETURN;
  END IF;
  
  -- Insert 26 fortnights of backup pincodes
  FOR i IN 1..26 LOOP
    INSERT INTO pass.backup_pincodes (
      org_id,
      site_id,
      device_id,
      fortnight_number,
      pincode,
      period_start,
      period_end
    ) VALUES (
      v_org_id,
      v_site_id,
      v_device_id,
      i,
      (1200 + i)::VARCHAR, -- 1201, 1202, ... 1226
      v_start_date + ((i - 1) * v_fortnight_days * INTERVAL '1 day'),
      v_start_date + (i * v_fortnight_days * INTERVAL '1 day') - INTERVAL '1 second'
    )
    ON CONFLICT (device_id, fortnight_number) 
    DO UPDATE SET
      pincode = EXCLUDED.pincode,
      period_start = EXCLUDED.period_start,
      period_end = EXCLUDED.period_end,
      updated_at = NOW();
  END LOOP;
  
  RAISE NOTICE 'Seeded 26 backup pincodes for Griffith Boat Club gate-entry device';
END $$;
