import { createServiceClient } from "@/lib/supabase/server"
import logger from "@/lib/logger"

export interface LockCode {
  id: string
  pass_id: string
  code: string | null
  status: "pending" | "active" | "expired" | "cancelled"
  provider: string
  provider_ref: string | null
  starts_at: string
  ends_at: string
  created_at: string
  webhook_received_at: string | null
}

/**
 * Creates a lock code for a pass.
 * Only accessible via service_role to maintain security.
 */
export async function createLockCode(data: {
  passId: string
  code: string
  provider?: string
  providerRef?: string
  startsAt: Date
  endsAt: Date
}): Promise<LockCode | null> {
  const supabase = createServiceClient()

  const { data: lockCode, error } = await supabase
    .schema("pass")
    .from("lock_codes")
    .insert({
      pass_id: data.passId,
      code: data.code,
      provider: data.provider || "manual",
      provider_ref: data.providerRef || null,
      starts_at: data.startsAt.toISOString(),
      ends_at: data.endsAt.toISOString(),
    })
    .select()
    .single()

  if (error) {
    logger.error({ passId: data.passId, error: error.message }, "[LockCodes] Error creating lock code")
    return null
  }

  return lockCode
}

/**
 * Creates a pending lock code record (code = null) for Rooms webhook to populate.
 * Used in the two-phase flow: create pending record first, then Rooms webhook fills in the PIN.
 */
export async function createPendingLockCode(data: {
  passId: string
  provider: string
  providerRef: string
  startsAt: Date
  endsAt: Date
}): Promise<LockCode | null> {
  const supabase = createServiceClient()

  const { data: lockCode, error } = await supabase
    .schema("pass")
    .from("lock_codes")
    .insert({
      pass_id: data.passId,
      code: null, // Will be populated by Rooms webhook
      status: "pending",
      provider: data.provider,
      provider_ref: data.providerRef,
      starts_at: data.startsAt.toISOString(),
      ends_at: data.endsAt.toISOString(),
    })
    .select()
    .single()

  if (error) {
    logger.error({ passId: data.passId, error: error.message }, "[LockCodes] Error creating pending lock code")
    return null
  }

  logger.debug({ passId: data.passId, provider: data.provider }, "[LockCodes] Created pending lock code")
  return lockCode
}

/**
 * Gets a lock code for a pass, optionally filtered by provider.
 * Uses maybeSingle() to handle cases where no record exists.
 */
export async function getLockCodeByPassIdAndProvider(
  passId: string,
  provider: string
): Promise<LockCode | null> {
  try {
    const supabase = createServiceClient()

    const { data, error } = await supabase
      .schema("pass")
      .from("lock_codes")
      .select("*")
      .eq("pass_id", passId)
      .eq("provider", provider)
      .maybeSingle()

    if (error) {
      logger.error({ passId, provider, error: error.message }, "[LockCodes] Error fetching lock code by provider")
      return null
    }

    return data
  } catch (err) {
    logger.error({ passId, provider, error: err instanceof Error ? err.message : String(err) }, "[LockCodes] Exception fetching lock code by provider")
    return null
  }
}

/**
 * Gets a lock code for a pass.
 * Only accessible via service_role - anon users cannot read lock codes.
 */
export async function getLockCodeByPassId(passId: string): Promise<LockCode | null> {
  const MAX_RETRIES = 3
  const RETRY_DELAY = 500 // ms

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      logger.debug({ passId, attempt, maxRetries: MAX_RETRIES }, "[LockCodes] Attempting to fetch lock code")
      const supabase = createServiceClient()

      const { data, error } = await supabase
        .schema("pass")
        .from("lock_codes")
        .select("*")
        .eq("pass_id", passId)
        .single()

      if (error) {
        if (error.code === "PGRST116") {
          logger.debug({ passId }, "[LockCodes] No lock code found for pass")
          return null
        }

        logger.error(
          {
            passId,
            attempt,
            maxRetries: MAX_RETRIES,
            code: error.code,
            message: error.message,
            details: error.details,
          },
          "[LockCodes] Supabase error fetching lock code",
        )

        if (attempt < MAX_RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY * attempt))
          continue
        }

        return null
      }

      logger.debug({ passId }, "[LockCodes] Successfully fetched lock code")
      return data
    } catch (networkError) {
      logger.error(
        {
          passId,
          attempt,
          maxRetries: MAX_RETRIES,
          error: networkError instanceof Error ? networkError.message : String(networkError),
        },
        "[LockCodes] Exception fetching lock code",
      )

      if (attempt < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY * attempt))
        continue
      }

      return null
    }
  }

  return null
}

/**
 * Deletes a lock code by ID.
 * Only accessible via service_role to maintain security.
 */
export async function deleteLockCode(lockCodeId: string): Promise<boolean> {
  const supabase = createServiceClient()

  const { error } = await supabase.schema("pass").from("lock_codes").delete().eq("id", lockCodeId)

  if (error) {
    logger.error({ lockCodeId, error: error.message }, "[LockCodes] Error deleting lock code")
    return false
  }

  return true
}
