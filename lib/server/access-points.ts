import { createSchemaServiceClient } from "@/lib/supabase/server"
import logger from "@/lib/logger"

/**
 * Interface for access point slug resolution
 */
export interface AccessPointSlugs {
  org_slug: string
  site_slug: string
  accesspoint_slug: string
  is_active: boolean
}

/**
 * Error codes from Supabase/Postgres that indicate privilege issues
 * These differ from RLS denials and indicate missing GRANT statements
 */
const PRIVILEGE_ERROR_CODES = ["42501", "42P01"] as const

/**
 * Fetches slug components for a device UUID for URL redirection.
 *
 * This function queries pass.accesspoint_slugs using service_role.
 * Even though service_role bypasses RLS, it still requires:
 * 1. USAGE grant on schema pass
 * 2. SELECT grant on pass.accesspoint_slugs
 *
 * Error 42501 means USAGE on schema is missing.
 * Error 42P01 means table doesn't exist or no SELECT privilege.
 *
 * @param accessPointId - Device UUID from /ap/[accessPointId] route
 * @returns Slug components or null if not found/inactive
 * @throws Error with specific code for privilege issues
 */
export async function getAccessPointSlugs(accessPointId: string): Promise<AccessPointSlugs | null> {
  try {
    const supabase = createSchemaServiceClient("pass")

    const { data, error } = await supabase
      .from("accesspoint_slugs")
      .select("org_slug, site_slug, accesspoint_slug, is_active")
      .eq("device_id", accessPointId)
      .eq("is_active", true)
      .single()

    if (error) {
      if (PRIVILEGE_ERROR_CODES.includes(error.code as any)) {
        logger.error(
          {
            accessPointId,
            errorCode: error.code,
            errorMessage: error.message,
            errorDetails: error.details,
          },
          "[AccessPoints] Database privilege error - missing GRANT on schema or table",
        )
        // Re-throw with structured error for better debugging
        throw new Error(
          `Database access misconfigured: ${error.code} - ${error.message}. ` +
            `Hint: Run migration scripts/022_fix_pass_schema_access_complete.sql`,
        )
      }

      // Not found or other DB error
      logger.warn(
        { accessPointId, error: error.message, code: error.code },
        "[AccessPoints] Device not found or has no active slug",
      )
      return null
    }

    if (!data) {
      return null
    }

    return data as AccessPointSlugs
  } catch (error) {
    // Re-throw structured errors
    if (error instanceof Error && error.message.includes("Database access misconfigured")) {
      throw error
    }

    // Log unexpected errors
    logger.error(
      { accessPointId, error: error instanceof Error ? error.message : error },
      "[AccessPoints] Unexpected error fetching slug",
    )
    return null
  }
}
