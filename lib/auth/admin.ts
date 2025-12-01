import { createClient } from "@/lib/supabase/server"
import { ENV } from "@/lib/env"

export interface AdminSession {
  user: {
    id: string
    email?: string
  }
}

/**
 * Get authenticated admin session from Supabase or ADMIN_TOKEN.
 * Returns null if not authenticated or not admin.
 */
export async function getServerAdminSession(): Promise<AdminSession | null> {
  // Check for ADMIN_TOKEN environment variable (simple token-based auth)
  const adminToken = ENV.server().ADMIN_TOKEN

  // For now, we use token-based auth. In future, this can check Supabase user roles.
  // To use this, clients must send: Authorization: Bearer <ADMIN_TOKEN>

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return null
    }

    // Check if user has admin role in metadata
    // This assumes your Supabase users have a role field in user_metadata or app_metadata
    const isAdmin = user.user_metadata?.role === "admin" || user.app_metadata?.role === "admin"

    if (isAdmin) {
      return {
        user: {
          id: user.id,
          email: user.email,
        },
      }
    }

    return null
  } catch (error) {
    console.error("[v0] Error checking admin session:", error)
    return null
  }
}

/**
 * Check if request has valid ADMIN_TOKEN header.
 * This is a simpler alternative to session-based auth for dev/test endpoints.
 */
export function checkAdminToken(request: Request): boolean {
  const authHeader = request.headers.get("authorization")
  const adminToken = ENV.server().ADMIN_TOKEN

  if (!adminToken) {
    return false
  }

  const token = authHeader?.replace("Bearer ", "")
  return token === adminToken
}
