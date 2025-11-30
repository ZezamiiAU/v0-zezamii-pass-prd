import { createServerClient } from "@supabase/ssr"
import { ENV } from "@/lib/env"

/**
 * Creates a Supabase client configured for the core schema.
 * Use this for querying core tables like devices, sites, organisations.
 */
export function createCoreClient() {
  const { NEXT_PUBLIC_SUPABASE_URL } = ENV.client()
  const { SUPABASE_SERVICE_ROLE_KEY } = ENV.server()

  if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase core credentials")
  }

  return createServerClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    db: {
      schema: "core",
    },
    cookies: {
      getAll() {
        return []
      },
      setAll() {
        // No-op
      },
    },
  })
}
