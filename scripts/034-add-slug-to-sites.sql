-- Add slug column to core.sites table
ALTER TABLE core.sites ADD COLUMN IF NOT EXISTS slug TEXT;

-- Create unique index for slug within an organization
CREATE UNIQUE INDEX IF NOT EXISTS idx_sites_org_slug ON core.sites(org_id, slug);

-- Update existing sites with a slug derived from their name (lowercase, hyphenated)
UPDATE core.sites
SET slug = LOWER(REGEXP_REPLACE(TRIM(name), '[^a-zA-Z0-9]+', '-', 'g'))
WHERE slug IS NULL;

-- Remove any trailing hyphens from generated slugs
UPDATE core.sites
SET slug = REGEXP_REPLACE(slug, '-+$', '')
WHERE slug LIKE '%-';

-- Remove any leading hyphens from generated slugs
UPDATE core.sites
SET slug = REGEXP_REPLACE(slug, '^-+', '')
WHERE slug LIKE '-%';
