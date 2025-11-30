-- Diagnostic: Check what pass types and organisations exist in database
-- Run this to see current state before cleanup

-- === ORGANISATIONS ===
SELECT 
  '=== ORGANISATIONS ===' as section;

SELECT 
  id,
  name,
  slug,
  is_active
FROM core.organisations
ORDER BY created_at;

-- === PASS TYPES ===
SELECT 
  '=== PASS TYPES ===' as section;

SELECT 
  pt.id,
  pt.name,
  pt.price_cents / 100.0 as price,
  pt.currency,
  pt.duration_hours,
  pt.is_active,
  o.name as org_name,
  o.slug as org_slug
FROM pass.pass_types pt
LEFT JOIN core.organisations o ON o.id = pt.org_id
ORDER BY pt.created_at;

-- === DEVICES ===
SELECT 
  '=== DEVICES ===' as section;

SELECT 
  d.id,
  d.name,
  d.slug,
  d.slug_is_active,
  o.name as org_name,
  o.slug as org_slug
FROM core.devices d
LEFT JOIN core.organisations o ON o.id = d.org_id
WHERE d.slug IS NOT NULL
ORDER BY d.created_at;

-- === PASSES PURCHASED ===
SELECT 
  '=== PASSES PURCHASED ===' as section;

SELECT 
  COUNT(*) as total_passes,
  pt.name as pass_type_name,
  o.name as org_name
FROM pass.passes p
JOIN pass.pass_types pt ON pt.id = p.pass_type_id
LEFT JOIN core.organisations o ON o.id = pt.org_id
GROUP BY pt.name, o.name
ORDER BY total_passes DESC;
