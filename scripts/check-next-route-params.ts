#!/usr/bin/env node
import { readdirSync, statSync, existsSync } from "node:fs"
import { join, relative } from "node:path"

/**
 * Next.js Dynamic Route Guard:
 * - Finds dynamic folders like [id], [...slug], [[...slug]]
 * - If inside app/api/** => MUST have route.ts/route.tsx
 * - Else => must have page.* or route.*
 *
 * Fails build only if a dynamic folder has zero handlers.
 */

const APP_DIR = join(process.cwd(), "app")

const isDynamicFolder = (name: string) => /^\[.*\]$/.test(name)

const apiHandlerFiles = ["route.ts", "route.tsx"]
const pageOrRouteFiles = ["page.tsx", "page.ts", "route.ts", "route.tsx"]

type Issue = { folder: string; expected: string[] }

function walk(dir: string, issues: Issue[]) {
  const entries = readdirSync(dir)

  for (const entry of entries) {
    const full = join(dir, entry)
    const st = statSync(full)
    if (!st.isDirectory()) continue

    if (isDynamicFolder(entry)) {
      const rel = relative(process.cwd(), full)
      const isApi = rel.startsWith("app/api/")

      const expected = isApi ? apiHandlerFiles : pageOrRouteFiles
      const hasHandler = expected.some((f) => existsSync(join(full, f)))

      if (!hasHandler) {
        issues.push({ folder: rel, expected })
      }
    }

    walk(full, issues)
  }
}

function main() {
  if (!existsSync(APP_DIR)) {
    console.log("ℹ️  No /app directory found, skipping route checks.")
    return
  }

  const issues: Issue[] = []
  walk(APP_DIR, issues)

  if (issues.length) {
    console.error("\n❌ Dynamic route folders missing handlers:\n")
    for (const i of issues) {
      console.error(`- ${i.folder}`)
      console.error(`  Expected one of: ${i.expected.join(", ")}`)
    }
    console.error("\n💡 Add the missing handler file(s) above.\n")
    process.exit(1)
  }

  console.log("✅ Dynamic route handler check passed")
}

main()
