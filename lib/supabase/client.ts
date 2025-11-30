"use client"

import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import { ENV } from "@/lib/env"

let client: SupabaseClient<any, "public"> | null = null

const isDevelopment =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")

// Dev-mode global caching to survive hot reloads
if (typeof window !== "undefined" && isDevelopment) {
  const globalWithSupabase = global as typeof globalThis & {
    __supabase_client?: SupabaseClient<any, "public">
  }
  if (globalWithSupabase.__supabase_client) {
    client = globalWithSupabase.__supabase_client
  }
}

export function createClient() {
  if (client) return client

  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = ENV.client()

  if (!NEXT_PUBLIC_SUPABASE_URL || !NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error("Missing Supabase client credentials (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)")
  }

  client = createBrowserClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    db: { schema: "public" as const },
  })

  // Cache in dev mode
  if (typeof window !== "undefined" && isDevelopment) {
    const globalWithSupabase = global as typeof globalThis & {
      __supabase_client?: SupabaseClient<any, "public">
    }
    globalWithSupabase.__supabase_client = client
  }

  return client
}
