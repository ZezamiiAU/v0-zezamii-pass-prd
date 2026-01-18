-- Seed backup pincodes for Zezamii Parks
-- 26 fortnights starting Jan 17, 2026
-- Pincodes: 2201 through 2226 (different from Griffith to avoid confusion)

DO $$
DECLARE
  v_org_id UUID;
  v_site_id UUID;
  v_device_id UUID;
  v_start_date TIMESTAMPTZ := '2026-01-17 00:00:00+11'; -- Australian Eastern time
  v_fortnight_days INTEGER := 14;
  i INTEGER;
BEGIN
  -- Get org ID for zezamii-parks
  SELECT id INTO v_org_id FROM core.organisations WHERE slug = 'zezamii-parks' LIMIT 1;
  
  IF v_org_id IS NULL THEN
    RAISE NOTICE 'Organization zezamii-parks not found, skipping seed';
    RETURN;
  END IF;
  
  -- Get site ID (first site for this org)
  SELECT id INTO v_site_id FROM core.sites WHERE org_id = v_org_id LIMIT 1;
  
  IF v_site_id IS NULL THEN
    RAISE NOTICE 'No site found for zezamii-parks, skipping seed';
    RETURN;
  END IF;
  
  -- Get device ID (test-device by slug, or first device for site)
  SELECT id INTO v_device_id FROM core.devices WHERE site_id = v_site_id AND slug = 'test-device' LIMIT 1;
  
  IF v_device_id IS NULL THEN
    -- Try to get any device for this site
    SELECT id INTO v_device_id FROM core.devices WHERE site_id = v_site_id LIMIT 1;
  END IF;
  
  IF v_device_id IS NULL THEN
    RAISE NOTICE 'No device found for zezamii-parks site, skipping seed';
    RETURN;
  END IF;
  
  RAISE NOTICE 'Seeding backup pincodes for org_id=%, site_id=%, device_id=%', v_org_id, v_site_id, v_device_id;
  
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
      (2200 + i)::VARCHAR, -- 2201, 2202, ... 2226
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
  
  RAISE NOTICE 'Seeded 26 backup pincodes for Zezamii Parks (pincodes 2201-2226)';
END $$;
