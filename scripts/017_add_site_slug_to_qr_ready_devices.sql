-- Drop the existing view
DROP VIEW IF EXISTS core.qr_ready_devices;

-- Recreate the view with site_slug column added
CREATE VIEW core.qr_ready_devices AS
SELECT
    d.id AS device_id,
    d.org_id,
    d.site_id,
    d.slug AS device_slug,
    d.slug_is_active,
    d.name AS device_name,
    d.custom_name AS device_custom_name,
    d.custom_description AS device_custom_description,
    d.custom_logo_url AS device_custom_logo_url,
    d.category,
    d.status AS health_status,
    d.qr_instance_id,
    d.created_at,
    d.updated_at,
    
    -- Site information with slug
    s.name AS site_name,
    s.slug AS site_slug,
    
    -- Floor information
    f.id AS floor_id,
    f.name AS floor_name,
    f.level_rank AS floor_level,
    
    -- Building information
    b.id AS building_id,
    b.name AS building_name,
    
    -- Organization information
    -- Removed duplicate o.id AS org_id since d.org_id is already selected above
    o.name AS org_name,
    o.slug AS org_slug,
    o.is_active AS org_is_active,
    o.brand_settings AS org_brand_settings,
    o.billing_email AS org_support_email,
    
    -- Computed fields for QR readiness
    (d.slug IS NOT NULL AND d.slug != '') AS has_slug,
    (d.name IS NOT NULL AND d.name != '') AS has_name,
    (d.qr_instance_id IS NOT NULL) AS has_qr_instance,
    (o.slug IS NOT NULL AND o.slug != '') AS org_has_slug,
    (s.slug IS NOT NULL AND s.slug != '') AS site_has_slug,
    
    -- Overall QR readiness check
    (
        d.slug IS NOT NULL AND d.slug != '' AND
        d.slug_is_active = true AND
        d.name IS NOT NULL AND d.name != '' AND
        d.qr_instance_id IS NOT NULL AND
        o.slug IS NOT NULL AND o.slug != '' AND
        s.slug IS NOT NULL AND s.slug != '' AND
        o.is_active = true AND
        d.status = 'active'
    ) AS is_qr_ready,
    
    -- QR URL (three-level format)
    CASE
        WHEN o.slug IS NOT NULL AND s.slug IS NOT NULL AND d.slug IS NOT NULL
        THEN CONCAT('/p/', o.slug, '/', s.slug, '/', d.slug)
        ELSE NULL
    END AS qr_url,
    
    -- Active status
    (d.status = 'active') AS is_active

FROM core.devices d
LEFT JOIN core.sites s ON d.site_id = s.id
LEFT JOIN core.floors f ON d.floor_id = f.id
LEFT JOIN core.buildings b ON f.building_id = b.id
LEFT JOIN core.organisations o ON d.org_id = o.id;

-- Grant appropriate permissions
GRANT SELECT ON core.qr_ready_devices TO anon, authenticated, service_role;
