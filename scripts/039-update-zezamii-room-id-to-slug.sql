-- Migration: Update zezamii_room_id to use combined slug path (org/site/device)
-- This sets the roomId for Rooms API integration to a consistent, predictable value
-- Date: January 2026

-- Update all devices to use the combined slug path as their zezamii_room_id
UPDATE core.devices d
SET zezamii_room_id = CONCAT(o.slug, '/', s.slug, '/', d.slug)
FROM core.sites s
JOIN core.organisations o ON o.id = s.org_id
WHERE d.site_id = s.id
  AND d.slug IS NOT NULL
  AND s.slug IS NOT NULL
  AND o.slug IS NOT NULL;

-- Verify the update
SELECT 
  d.id,
  d.name,
  d.slug as device_slug,
  s.slug as site_slug,
  o.slug as org_slug,
  d.zezamii_room_id,
  CONCAT(o.slug, '/', s.slug, '/', d.slug) as expected_room_id
FROM core.devices d
JOIN core.sites s ON s.id = d.site_id
JOIN core.organisations o ON o.id = s.org_id
WHERE d.slug IS NOT NULL
ORDER BY o.slug, s.slug, d.slug;
