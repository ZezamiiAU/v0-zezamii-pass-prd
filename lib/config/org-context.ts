import { createCoreServiceClient } from "@/lib/supabase/server"
import logger from "@/lib/logger"

/**
 * Organization context for multi-tenant operations
 */
export interface OrgContext {
  orgId: string
  orgName: string
  siteId?: string
  siteName?: string
  deviceId?: string
  deviceName?: string
}

/**
 * Get organization context from device ID
 * Used when accessing via /ap/[accessPointId]
 */
export async function getOrgContextFromDevice(deviceId: string): Promise<OrgContext | null> {
  const supabase = await createCoreServiceClient()

  const { data, error } = await supabase
    .from("devices")
    .select(
      `
      id,
      name,
      organisation_id,
      floor_id,
      floors!inner (
        building_id,
        buildings!inner (
          site_id,
          sites!inner (
            id,
            name,
            organisations!inner (
              id,
              name
            )
          )
        )
      )
    `,
    )
    .eq("id", deviceId)
    .eq("status", "active")
    .single()

  if (error || !data) {
    logger.warn({ deviceId, error: error?.message }, "[OrgContext] Failed to get org context from device")
    return null
  }

  const floor = data.floors as any
  const building = floor?.buildings as any
  const site = building?.sites as any
  const org = site?.organisations as any

  return {
    orgId: org?.id,
    orgName: org?.name,
    siteId: site?.id,
    siteName: site?.name,
    deviceId: data.id,
    deviceName: data.name,
  }
}

/**
 * Get device details by QR instance ID
 * Used when accessing via /p/[slug]?qr=xyz
 */
export async function getDeviceByQrInstanceId(qrInstanceId: string): Promise<OrgContext | null> {
  const supabase = await createCoreServiceClient()

  const { data, error } = await supabase
    .from("devices")
    .select(
      `
      id,
      name,
      slug,
      organisation_id,
      floor_id,
      floors!inner (
        building_id,
        buildings!inner (
          site_id,
          sites!inner (
            id,
            name,
            organisations!inner (
              id,
              name
            )
          )
        )
      )
    `,
    )
    .eq("qr_instance_id", qrInstanceId)
    .eq("status", "active")
    .eq("slug_is_active", true)
    .single()

  if (error || !data) {
    logger.warn({ qrInstanceId, error: error?.message }, "[OrgContext] Failed to get device by QR instance ID")
    return null
  }

  const floor = data.floors as any
  const building = floor?.buildings as any
  const site = building?.sites as any
  const org = site?.organisations as any

  return {
    orgId: org?.id,
    orgName: org?.name,
    siteId: site?.id,
    siteName: site?.name,
    deviceId: data.id,
    deviceName: data.name,
  }
}

/**
 * Get organization context from slug
 * Used when accessing via /p/[slug]
 */
export async function getOrgContextFromSlug(slug: string): Promise<OrgContext | null> {
  const supabase = await createCoreServiceClient()

  try {
    const { data, error } = await supabase.from("devices").select("*").eq("slug", slug).eq("status", "active").single()

    if (error || !data) {
      if (error?.message?.includes("does not exist") || error?.code === "42703") {
        logger.error("[OrgContext] Slug columns do not exist - run migration 010_merge_slugs_into_devices.sql")
        return null
      }
      logger.warn({ slug, error: error?.message }, "[OrgContext] Failed to get org context from slug")
      return null
    }

    return {
      orgId: data.organisation_id,
      orgName: data.organisation_name,
      siteId: data.site_id,
      siteName: data.site_name,
      deviceId: data.id,
      deviceName: data.name,
    }
  } catch (err) {
    logger.error(
      { slug, error: err instanceof Error ? err.message : err },
      "[OrgContext] Exception in getOrgContextFromSlug",
    )
    return null
  }
}

/**
 * Get default organization ID from environment
 * Falls back to first active organization if not set
 */
export async function getDefaultOrgId(): Promise<string | null> {
  // Check environment variable first
  const envOrgId = process.env.NEXT_PUBLIC_DEFAULT_ORG_ID
  if (envOrgId) {
    return envOrgId
  }

  // Fallback: get first active organization
  const supabase = await createCoreServiceClient()
  const { data, error } = await supabase
    .from("organisations")
    .select("id")
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .single()

  if (error || !data) {
    logger.warn({ error: error?.message }, "[OrgContext] Failed to get default org")
    return null
  }

  return data.id
}
