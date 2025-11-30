-- Test the device query with the ACTUAL database structure
-- This tests the query for: org_slug='zezamii-parks' AND device slug='main-entrance'

-- Fixed all column names and foreign keys to match actual schema

-- Test 1: Check if the device exists with the slug
SELECT id, name, slug, floor_id, slug_is_active
FROM core.devices
WHERE slug = 'main-entrance';

-- Test 2: Check the full join path from device to organisation
SELECT 
  d.id as device_id,
  d.name as device_name,
  d.slug as device_slug,
  d.slug_is_active,
  d.custom_name,
  d.custom_description,
  f.id as floor_id,
  f.name as floor_name,
  b.id as building_id,
  b.name as building_name,
  s.id as site_id,
  s.name as site_name,
  o.id as org_id,
  o.name as org_name,
  o.slug as org_slug,
  o.is_active as org_is_active
FROM core.devices d
LEFT JOIN core.floors f ON d.floor_id = f.id
LEFT JOIN core.buildings b ON f.building_id = b.id
LEFT JOIN core.sites s ON b.site_id = s.id
LEFT JOIN core.organisations o ON s.org_id = o.id
WHERE d.slug = 'main-entrance';

-- Test 3: The actual query we want to use (with both filters)
SELECT 
  d.id as device_id,
  d.name as device_name,
  d.slug as device_slug,
  d.slug_is_active,
  d.custom_name,
  d.custom_description,
  d.custom_logo_url,
  o.slug as org_slug,
  o.name as org_name,
  o.timezone as org_timezone,
  s.id as site_id,
  s.name as site_name,
  s.city as site_city,
  s.state as site_state
FROM core.devices d
JOIN core.floors f ON d.floor_id = f.id
JOIN core.buildings b ON f.building_id = b.id
JOIN core.sites s ON b.site_id = s.id
JOIN core.organisations o ON s.org_id = o.id
WHERE o.slug = 'zezamii-parks'
  AND d.slug = 'main-entrance'
  AND d.slug_is_active = true;

-- Test 4: Check what org_slugs exist
SELECT slug, name, is_active
FROM core.organisations
ORDER BY slug;

-- Test 5: Check what device slugs exist for zezamii-parks
SELECT d.slug, d.name, d.slug_is_active
FROM core.devices d
JOIN core.floors f ON d.floor_id = f.id
JOIN core.buildings b ON f.building_id = b.id
JOIN core.sites s ON b.site_id = s.id
JOIN core.organisations o ON s.org_id = o.id
WHERE o.slug = 'zezamii-parks';
