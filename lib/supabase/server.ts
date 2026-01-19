import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { ENV } from "@/lib/env"

export async function createClient() {
  const cookieStore = await cookies()

  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = ENV.client()

  if (!NEXT_PUBLIC_SUPABASE_URL || !NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error("Missing Supabase client credentials")
  }

  return createServerClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    db: { schema: "public" },
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // The "setAll" method was called from a Server Component.
        }
      },
    },
  })
}

export function createServiceClient() {
  const { NEXT_PUBLIC_SUPABASE_URL } = ENV.client()
  const { SUPABASE_SERVICE_ROLE_KEY } = ENV.server()

  if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase service credentials")
  }

  return createServerClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    db: { schema: "public" },
    cookies: {
      getAll() {
        return []
      },
      setAll() {
        // No-op for service role client
      },
    },
  })
}

export function createCoreServiceClient() {
  const { NEXT_PUBLIC_SUPABASE_URL } = ENV.client()
  const { SUPABASE_SERVICE_ROLE_KEY } = ENV.server()

  if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase service credentials")
  }

  return createServerClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    db: { schema: "core" },
    cookies: {
      getAll() {
        return []
      },
      setAll() {
        // No-op for service role client
      },
    },
  })
}

export function createSchemaServiceClient(schema: string = "core") {
  const { NEXT_PUBLIC_SUPABASE_URL } = ENV.client()
  const { SUPABASE_SERVICE_ROLE_KEY } = ENV.server()

  if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase service credentials")
  }

  return createServerClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    db: { schema },
    cookies: {
      getAll() {
        return []
      },
      setAll() {
        // No-op for service role client
      },
    },
  })
}
