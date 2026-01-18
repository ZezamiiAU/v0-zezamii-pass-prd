-- Randomize backup pincodes for fortnights 2-26
-- Fortnight 1 keeps base pincode, fortnights 2-26 get base + random(0-100)

DO $$
DECLARE
  v_org_id UUID;
  v_site_id UUID;
  v_device_id UUID;
  v_start_date TIMESTAMPTZ := '2026-01-17 00:00:00+11';
  v_fortnight_days INTEGER := 14;
  v_base_pincode INTEGER;
  i INTEGER;
BEGIN
  -- Griffith Boat Club
  SELECT id INTO v_org_id FROM core.organisations WHERE slug = 'griffith-boat' LIMIT 1;
  IF v_org_id IS NOT NULL THEN
    SELECT id INTO v_site_id FROM core.sites WHERE org_id = v_org_id LIMIT 1;
    SELECT id INTO v_device_id FROM core.devices WHERE site_id = v_site_id AND slug = 'gate-entry' LIMIT 1;
    
    IF v_device_id IS NOT NULL THEN
      DELETE FROM pass.backup_pincodes WHERE device_id = v_device_id;
      
      v_base_pincode := 1201;
      FOR i IN 1..26 LOOP
        INSERT INTO pass.backup_pincodes (org_id, site_id, device_id, fortnight_number, pincode, period_start, period_end)
        VALUES (
          v_org_id, v_site_id, v_device_id, i,
          CASE WHEN i = 1 THEN v_base_pincode::VARCHAR ELSE (v_base_pincode + floor(random() * 101)::int)::VARCHAR END,
          v_start_date + ((i - 1) * v_fortnight_days * INTERVAL '1 day'),
          v_start_date + (i * v_fortnight_days * INTERVAL '1 day') - INTERVAL '1 second'
        );
      END LOOP;
      RAISE NOTICE 'Seeded 26 randomized pincodes for Griffith Boat Club';
    END IF;
  END IF;

  -- Zezamii Parks
  SELECT id INTO v_org_id FROM core.organisations WHERE slug = 'zezamii-parks' LIMIT 1;
  IF v_org_id IS NOT NULL THEN
    SELECT id INTO v_site_id FROM core.sites WHERE org_id = v_org_id LIMIT 1;
    SELECT id INTO v_device_id FROM core.devices WHERE site_id = v_site_id AND slug = 'test-device' LIMIT 1;
    
    IF v_device_id IS NOT NULL THEN
      DELETE FROM pass.backup_pincodes WHERE device_id = v_device_id;
      
      v_base_pincode := 2201;
      FOR i IN 1..26 LOOP
        INSERT INTO pass.backup_pincodes (org_id, site_id, device_id, fortnight_number, pincode, period_start, period_end)
        VALUES (
          v_org_id, v_site_id, v_device_id, i,
          CASE WHEN i = 1 THEN v_base_pincode::VARCHAR ELSE (v_base_pincode + floor(random() * 101)::int)::VARCHAR END,
          v_start_date + ((i - 1) * v_fortnight_days * INTERVAL '1 day'),
          v_start_date + (i * v_fortnight_days * INTERVAL '1 day') - INTERVAL '1 second'
        );
      END LOOP;
      RAISE NOTICE 'Seeded 26 randomized pincodes for Zezamii Parks';
    END IF;
  END IF;
END $$;
