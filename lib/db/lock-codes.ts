import { createServiceClient } from "@/lib/supabase/server"

export interface LockCode {
  id: string
  pass_id: string
  code: string
  provider: string
  provider_ref: string | null
  starts_at: string
  ends_at: string
  created_at: string
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
    console.error("Error creating lock code:", error)
    return null
  }

  return lockCode
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
      console.log(`[v0] Attempting to fetch lock code for pass ${passId} (attempt ${attempt}/${MAX_RETRIES})`)
      const supabase = createServiceClient()

      const { data, error } = await supabase
        .schema("pass")
        .from("lock_codes")
        .select("*")
        .eq("pass_id", passId)
        .single()

      if (error) {
        if (error.code === "PGRST116") {
          console.log(`[v0] No lock code found for pass ${passId}`)
          return null
        }

        console.error(`[v0] Supabase error fetching lock code (attempt ${attempt}/${MAX_RETRIES}):`, {
          code: error.code,
          message: error.message,
          details: error.details,
        })

        if (attempt < MAX_RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY * attempt))
          continue
        }

        return null
      }

      console.log(`[v0] Successfully fetched lock code for pass ${passId}`)
      return data
    } catch (networkError) {
      console.error(`[v0] Exception fetching lock code (attempt ${attempt}/${MAX_RETRIES}):`, {
        error: networkError,
        message: networkError instanceof Error ? networkError.message : String(networkError),
        stack: networkError instanceof Error ? networkError.stack : undefined,
      })

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
    console.error("Error deleting lock code:", error)
    return false
  }

  return true
}
