import type { NextRequest } from "next/server"
import { getOrgContextFromDevice, getDeviceByQrInstanceId, type OrgContext } from "@/lib/config/org-context"
import logger from "@/lib/logger"

/**
 * Result of tenant context resolution
 */
export interface TenantContextResult {
  success: boolean
  context: OrgContext | null
  error?: string
}

/**
 * Extract tenant context from request
 * Checks multiple sources in order:
 * 1. X-Org-Id header (for authenticated API calls)
 * 2. qr query parameter (QR code scan)
 * 3. device_id in body/params
 * 4. URL path params for /p/[orgSlug]/[siteSlug]/[deviceSlug]
 */
export async function resolveTenantContext(
  request: NextRequest,
  params?: { orgSlug?: string; siteSlug?: string; deviceSlug?: string },
): Promise<TenantContextResult> {
  try {
    // 1. Check X-Org-Id header (trusted server-to-server calls)
    const headerOrgId = request.headers.get("x-org-id")
    if (headerOrgId) {
      // For header-based auth, we trust the caller but still validate
      logger.debug({ orgId: headerOrgId }, "[TenantContext] Using header org ID")
      return {
        success: true,
        context: {
          orgId: headerOrgId,
          orgName: "Header-Provided",
        },
      }
    }

    // 2. Check qr query parameter
    const qrInstanceId = request.nextUrl.searchParams.get("qr")
    if (qrInstanceId) {
      const context = await getDeviceByQrInstanceId(qrInstanceId)
      if (context) {
        logger.debug({ qrInstanceId, orgId: context.orgId }, "[TenantContext] Resolved from QR instance")
        return { success: true, context }
      }
      logger.warn({ qrInstanceId }, "[TenantContext] Invalid QR instance ID")
      return { success: false, context: null, error: "Invalid QR code" }
    }

    // 3. Check device_id in URL or body
    const deviceId = request.nextUrl.searchParams.get("device_id")
    if (deviceId) {
      const context = await getOrgContextFromDevice(deviceId)
      if (context) {
        logger.debug({ deviceId, orgId: context.orgId }, "[TenantContext] Resolved from device ID")
        return { success: true, context }
      }
      logger.warn({ deviceId }, "[TenantContext] Invalid device ID")
      return { success: false, context: null, error: "Invalid device" }
    }

    // 4. No tenant context found - this may be OK for some routes
    logger.debug("[TenantContext] No tenant context in request")
    return { success: true, context: null }
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : error },
      "[TenantContext] Error resolving tenant context",
    )
    return { success: false, context: null, error: "Failed to resolve tenant context" }
  }
}

/**
 * Validate that a request is for a specific org
 * Used to prevent cross-tenant data access
 */
export function validateTenantAccess(context: OrgContext | null, requiredOrgId: string): boolean {
  if (!context) {
    return false
  }
  return context.orgId === requiredOrgId
}

/**
 * Type guard for routes that require tenant context
 */
export function requireTenantContext(
  result: TenantContextResult,
): result is TenantContextResult & { context: OrgContext } {
  return result.success && result.context !== null
}
