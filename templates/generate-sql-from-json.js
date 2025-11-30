/**
 * JSON Template to SQL Generator
 *
 * Converts the JSON tenant configuration into SQL INSERT statements.
 *
 * Usage:
 *   1. Fill out tenant-config-template.json
 *   2. Run: node templates/generate-sql-from-json.js
 *   3. Execute the generated SQL: psql $DATABASE_URL -f output/tenant_setup.sql
 */

const fs = require("fs")
const path = require("path")

// SQL value formatter
function formatValue(value) {
  if (value === null || value === undefined) return "NULL"
  if (typeof value === "boolean") return value.toString()
  if (typeof value === "number") return value.toString()
  if (typeof value === "object") return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`
  // String - escape single quotes
  return `'${value.replace(/'/g, "''")}'`
}

// Generate INSERT statement
function generateInsert(tableName, schemaName, rows) {
  if (!rows || rows.length === 0) return ""

  const allKeys = new Set()
  rows.forEach((row) => Object.keys(row).forEach((key) => allKeys.add(key)))
  const columns = Array.from(allKeys)

  const valueRows = rows.map((row) => {
    const values = columns.map((col) => formatValue(row[col]))
    return `  (${values.join(", ")})`
  })

  return `-- Insert into ${schemaName}.${tableName}
INSERT INTO ${schemaName}.${tableName} (
  ${columns.join(",\n  ")}
) VALUES
${valueRows.join(",\n")}
ON CONFLICT (id) DO NOTHING;

`
}

// Main generator
function generateSQL() {
  console.log("🔄 Generating SQL from JSON template...\n")

  const configPath = path.join(__dirname, "tenant-config-template.json")

  if (!fs.existsSync(configPath)) {
    console.error("❌ Error: tenant-config-template.json not found")
    console.error("   Please create it from the template first")
    process.exit(1)
  }

  const config = JSON.parse(fs.readFileSync(configPath, "utf-8"))

  let output = `-- Tenant Setup SQL
-- Generated from JSON template on ${new Date().toISOString()}
-- Source: tenant-config-template.json
-- 
-- Instructions:
--   1. Review all values carefully
--   2. Update Stripe price IDs in pass_types if needed
--   3. Replace placeholder UUIDs and API keys
--   4. Run against your Supabase database
--
-- WARNING: This uses ON CONFLICT DO NOTHING, so existing records won't be updated.
--          If you need to update existing records, use UPDATE statements instead.

BEGIN;

`

  // Generate inserts in dependency order
  const tables = [
    { data: [config.organization], table: "organisations", schema: "core" },
    { data: config.sites, table: "sites", schema: "core" },
    { data: config.buildings, table: "buildings", schema: "core" },
    { data: config.floors, table: "floors", schema: "core" },
    { data: config.devices, table: "devices", schema: "core" },
    { data: config.passTypes, table: "pass_types", schema: "pass" },
    { data: config.integrations, table: "integrations", schema: "core" },
  ]

  tables.forEach(({ data, table, schema }) => {
    if (data && data.length > 0) {
      console.log(`✓ Processing ${table}... (${data.length} record(s))`)
      output += generateInsert(table, schema, data)
    }
  })

  output += `COMMIT;

-- Verification Queries
-- Run these to verify your data was inserted correctly

SELECT 
  o.name as organization,
  COUNT(DISTINCT s.id) as sites,
  COUNT(DISTINCT d.id) as devices,
  COUNT(DISTINCT pt.id) as pass_types
FROM core.organisations o
LEFT JOIN core.sites s ON s.organization_id = o.id
LEFT JOIN core.devices d ON d.organization_id = o.id
LEFT JOIN pass.pass_types pt ON pt.organization_id = o.id
WHERE o.id = '${config.organization.id}'::uuid
GROUP BY o.id, o.name;

-- View your access point details
SELECT 
  organization_name,
  site_name,
  device_name,
  slug
FROM pass.v_accesspoint_details
WHERE organization_id = '${config.organization.id}'::uuid;

-- Check pass types
SELECT name, price_cents, duration_hours, stripe_price_id
FROM pass.pass_types
WHERE organization_id = '${config.organization.id}'::uuid
ORDER BY display_order;
`

  // Create output directory
  const outputDir = path.join(__dirname, "..", "output")
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  // Write output
  const outputFile = path.join(outputDir, "tenant_setup.sql")
  fs.writeFileSync(outputFile, output)

  console.log(`\n✅ SQL generated successfully!`)
  console.log(`📄 Output: ${outputFile}`)
  console.log(`\n📋 Next steps:`)
  console.log(`   1. Review the generated SQL file`)
  console.log(`   2. Update any placeholder values (API keys, Stripe IDs)`)
  console.log(`   3. Run: psql $DATABASE_URL -f ${outputFile}`)
  console.log(`   4. Verify with the included SELECT queries\n`)
}

// Run generator
try {
  generateSQL()
} catch (error) {
  console.error("❌ Error generating SQL:", error.message)
  console.error(error.stack)
  process.exit(1)
}
