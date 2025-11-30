# URGENT: Database Migration Required

## Issue
The application is trying to query columns that don't exist yet in the database:
- `devices.slug`
- `devices.slug_is_active`
- `devices.custom_name`
- `devices.custom_description`
- `devices.custom_logo_url`

## Solution
Run the migration script immediately:

\`\`\`bash
# Connect to your database
psql $DATABASE_URL -f scripts/010_merge_slugs_into_devices.sql
\`\`\`

## What This Migration Does
1. Adds slug and branding columns to `core.devices` table
2. Migrates existing data from `pass.accesspoint_slugs` to `core.devices`
3. Updates the `pass.v_accesspoint_details` view to use the new columns
4. Makes the architecture simpler (one table instead of two)

## Verification
After running the migration, verify with:

\`\`\`sql
-- Check devices now have slug columns
SELECT id, name, slug, slug_is_active, custom_name 
FROM core.devices 
LIMIT 5;

-- Check the view works
SELECT * FROM pass.v_accesspoint_details LIMIT 5;
\`\`\`

## Impact
- **Current Routes Affected**: `/ap/[accessPointId]`, `/p/[slug]`
- **Error**: `column devices.slug does not exist`
- **Fix**: Run migration immediately

Once complete, the app will work correctly with slug-based routing.
