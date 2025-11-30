-- Test query for the access point lookup
-- URL: https://zezamii-pass.vercel.app/p/zezamii-parks/main-entrance

SELECT * FROM pass.v_accesspoint_details
WHERE org_slug = 'zezamii-parks'
  AND slug = 'main-entrance'
  AND is_active = true
  AND slug_is_active = true;

-- Also test without the active filters to see if the record exists at all
SELECT * FROM pass.v_accesspoint_details
WHERE org_slug = 'zezamii-parks'
  AND slug = 'main-entrance';

-- Check what org_slugs exist
SELECT DISTINCT org_slug FROM pass.v_accesspoint_details;

-- Check what slugs exist for zezamii-parks
SELECT slug, is_active, slug_is_active, accesspoint_name 
FROM pass.v_accesspoint_details
WHERE org_slug = 'zezamii-parks';
