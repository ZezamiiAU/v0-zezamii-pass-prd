#!/usr/bin/env node
import { existsSync } from "node:fs"
import { join } from "node:path"

/**
 * Prebuild Guardrail: Ensures required build scripts exist
 * Prevents silent failures from missing scripts
 */

const requiredScripts = [
  "scripts/check-next-route-params.ts"
]

const missing: string[] = []

for (const scriptPath of requiredScripts) {
  const fullPath = join(process.cwd(), scriptPath)
  if (!existsSync(fullPath)) {
    missing.push(scriptPath)
  }
}

if (missing.length > 0) {
  console.error("\n❌ Required build scripts are missing:\n")
  missing.forEach((script) => console.error(`   - ${script}`))
  console.error("\n💡 These scripts are required for the build to succeed.\n")
  process.exit(1)
}

console.log("✅ All required build scripts are present")
