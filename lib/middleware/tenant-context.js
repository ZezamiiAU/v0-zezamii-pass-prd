/**
 * Tenant Context Middleware
 *
 * Centralizes organization context resolution for API routes.
 * Provides defense-in-depth by ensuring all queries are properly scoped.
 */

import { createCoreServiceClient } from "@/lib/supabase/server"
import logger from "@/lib/logger"

/**
 * @typedef {Object} TenantContext
 * @property {string} orgId - Organization UUID
 * @property {string} orgSlug - Organization slug
 * @property {string} [siteId] - Site UUID (optional)
 * @property {string} [siteSlug] - Site slug (optional)
 * @property {string} [deviceId] - Device UUID (optional)
 * @property {string} [deviceSlug] - Device slug (optional)
 */

/**
 * @typedef {Object} TenantContextResult
 * @property {boolean} ok
 * @property {TenantContext} [data]
 * @property {string} [error]
 * @property {number} [status]
 */

/**
 * Resolve tenant context from URL path segments
 *
 * @param {Object} params - Route params
 * @param {string} [params.orgSlug] - Organization slug from URL
 * @param {string} [params.siteSlug] - Site slug from URL
 * @param {string} [params.deviceSlug] - Device slug from URL
 * @returns {Promise<TenantContextResult>}
 */
export async function resolveTenantContext(params) {
  const { orgSlug, siteSlug, deviceSlug } = params

  if (!orgSlug) {
    return {
      ok: false,
      error: "Organization slug is required",
      status: 400,
    }
  }

  try {
    const supabase = await createCoreServiceClient()

    // Step 1: Resolve organization
    const { data: org, error: orgError } = await supabase
      .from("organisations")
      .select("id, slug, name, is_active")
      .eq("slug", orgSlug)
      .single()

    if (orgError || !org) {
      logger.warn({ orgSlug, error: orgError?.message }, "[TenantContext] Organization not found")
      return {
        ok: false,
        error: "Organization not found",
        status: 404,
      }
    }

    if (!org.is_active) {
      logger.warn({ orgSlug }, "[TenantContext] Organization is inactive")
      return {
        ok: false,
        error: "Organization is inactive",
        status: 403,
      }
    }

    /** @type {TenantContext} */
    const context = {
      orgId: org.id,
      orgSlug: org.slug,
    }

    // Step 2: Resolve site (if provided)
    if (siteSlug) {
      const { data: site, error: siteError } = await supabase
        .from("sites")
        .select("id, slug, name")
        .eq("slug", siteSlug)
        .eq("org_id", org.id)
        .single()

      if (siteError || !site) {
        logger.warn({ orgSlug, siteSlug, error: siteError?.message }, "[TenantContext] Site not found")
        return {
          ok: false,
          error: "Site not found",
          status: 404,
        }
      }

      context.siteId = site.id
      context.siteSlug = site.slug
    }

    // Step 3: Resolve device (if provided)
    if (deviceSlug) {
      const deviceQuery = supabase
        .from("devices")
        .select("id, slug, name, site_id")
        .eq("slug", deviceSlug)
        .eq("org_id", org.id)
        .eq("status", "active")

      // If we have a site context, ensure device belongs to that site
      if (context.siteId) {
        deviceQuery.eq("site_id", context.siteId)
      }

      const { data: device, error: deviceError } = await deviceQuery.single()

      if (deviceError || !device) {
        logger.warn({ orgSlug, siteSlug, deviceSlug, error: deviceError?.message }, "[TenantContext] Device not found")
        return {
          ok: false,
          error: "Device not found",
          status: 404,
        }
      }

      context.deviceId = device.id
      context.deviceSlug = device.slug

      // Backfill site context if device resolved but site wasn't provided
      if (!context.siteId && device.site_id) {
        const { data: site } = await supabase.from("sites").select("id, slug").eq("id", device.site_id).single()

        if (site) {
          context.siteId = site.id
          context.siteSlug = site.slug
        }
      }
    }

    logger.debug({ context }, "[TenantContext] Resolved tenant context")

    return {
      ok: true,
      data: context,
    }
  } catch (err) {
    logger.error(
      { params, error: err instanceof Error ? err.message : err },
      "[TenantContext] Exception resolving tenant context",
    )
    return {
      ok: false,
      error: "Internal error resolving tenant context",
      status: 500,
    }
  }
}

/**
 * Resolve tenant context from device ID
 * Used for access point resolution
 *
 * @param {string} deviceId - Device UUID
 * @returns {Promise<TenantContextResult>}
 */
export async function resolveTenantFromDevice(deviceId) {
  if (!deviceId) {
    return {
      ok: false,
      error: "Device ID is required",
      status: 400,
    }
  }

  try {
    const supabase = await createCoreServiceClient()

    const { data: device, error } = await supabase
      .from("devices")
      .select(`
        id,
        slug,
        name,
        org_id,
        site_id,
        sites!inner (
          id,
          slug,
          org_id,
          organisations!inner (
            id,
            slug,
            is_active
          )
        )
      `)
      .eq("id", deviceId)
      .eq("status", "active")
      .single()

    if (error || !device) {
      logger.warn({ deviceId, error: error?.message }, "[TenantContext] Device not found")
      return {
        ok: false,
        error: "Device not found",
        status: 404,
      }
    }

    const site = /** @type {any} */ (device.sites)
    const org = site?.organisations

    if (!org?.is_active) {
      return {
        ok: false,
        error: "Organization is inactive",
        status: 403,
      }
    }

    return {
      ok: true,
      data: {
        orgId: org.id,
        orgSlug: org.slug,
        siteId: site.id,
        siteSlug: site.slug,
        deviceId: device.id,
        deviceSlug: device.slug,
      },
    }
  } catch (err) {
    logger.error(
      { deviceId, error: err instanceof Error ? err.message : err },
      "[TenantContext] Exception resolving tenant from device",
    )
    return {
      ok: false,
      error: "Internal error resolving tenant context",
      status: 500,
    }
  }
}

/**
 * Higher-order function to wrap route handlers with tenant context
 *
 * @template T
 * @param {(req: Request, context: any, tenant: TenantContext) => Promise<T>} handler
 * @returns {(req: Request, context: any) => Promise<T | Response>}
 */
export function withTenantContext(handler) {
  return async (req, context) => {
    const params = await context.params
    const result = await resolveTenantContext(params)

    if (!result.ok) {
      return new Response(JSON.stringify({ error: result.error }), {
        status: result.status || 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    return handler(req, context, result.data)
  }
}

/**
 * Assert that a query result belongs to the expected tenant
 * Provides defense-in-depth for service role queries
 *
 * @param {Object} record - Database record
 * @param {string} expectedOrgId - Expected org_id
 * @param {string} [recordName] - Name for logging
 * @returns {boolean}
 */
export function assertTenantOwnership(record, expectedOrgId, recordName = "record") {
  if (!record) {
    return false
  }

  const recordOrgId = record.org_id || record.organisation_id

  if (recordOrgId !== expectedOrgId) {
    logger.error(
      {
        expected: expectedOrgId,
        actual: recordOrgId,
        recordName,
      },
      "[TenantContext] SECURITY: Cross-tenant access attempt detected",
    )
    return false
  }

  return true
}
