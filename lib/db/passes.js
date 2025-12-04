import { createServiceClient } from "@/lib/supabase/server"
import logger from "@/lib/logger"
import { ok, fromSupabaseError } from "./result"

/**
 * @typedef {Object} Pass
 * @property {string} id
 * @property {string} org_id
 * @property {string|null} site_id
 * @property {string} device_id
 * @property {string} pass_type_id
 * @property {string} status
 * @property {string|null} vehicle_plate
 * @property {string|null} purchaser_email
 * @property {string|null} valid_from
 * @property {string|null} valid_to
 * @property {string} created_at
 * @property {string|null} [pin_code]
 * @property {string|null} [pin_status]
 * @property {string|null} [lock_request_id]
 * @property {string|null} [lock_request_error]
 * @property {string|null} [lock_requested_at]
 */

/**
 * @typedef {Object} PassType
 * @property {string} name
 * @property {string} code
 * @property {number} duration_minutes
 */

/**
 * @typedef {Pass & { pass_type: PassType }} PassWithType
 */

/**
 * Creates a new pass
 * @param {Object} data
 * @param {string} data.passTypeId
 * @param {string} [data.vehiclePlate]
 * @param {string} [data.purchaserEmail]
 * @param {Date} [data.validFrom]
 * @param {Date} [data.validTo]
 * @param {string} data.orgId
 * @param {string} data.deviceId
 * @param {string} [data.siteId]
 * @returns {Promise<import('./result').Result<Pass>>}
 */
export async function createPass(data) {
  const supabase = createServiceClient()

  const { data: pass, error } = await supabase
    .schema("pass")
    .from("passes")
    .insert({
      pass_type_id: data.passTypeId,
      vehicle_plate: data.vehiclePlate || null,
      purchaser_email: data.purchaserEmail || null,
      valid_from: data.validFrom?.toISOString() || null,
      valid_to: data.validTo?.toISOString() || null,
      status: "pending",
      org_id: data.orgId,
      device_id: data.deviceId,
      site_id: data.siteId || null,
    })
    .select()
    .single()

  if (error) {
    logger.error({ passTypeId: data.passTypeId, error: error.message }, "[Passes] Error creating pass")
    return fromSupabaseError(error)
  }

  return ok(pass)
}

/**
 * Updates pass status with optional validity dates
 * @param {string} passId
 * @param {string} status
 * @param {Date} [validFrom]
 * @param {Date} [validTo]
 * @returns {Promise<import('./result').Result<boolean>>}
 */
export async function updatePassStatus(passId, status, validFrom, validTo) {
  const supabase = createServiceClient()

  const updateData = { status }
  if (validFrom) updateData.valid_from = validFrom.toISOString()
  if (validTo) updateData.valid_to = validTo.toISOString()

  const { error } = await supabase.schema("pass").from("passes").update(updateData).eq("id", passId)

  if (error) {
    logger.error({ passId, status, error: error.message }, "[Passes] Error updating pass status")
    return fromSupabaseError(error)
  }

  return ok(true)
}

/**
 * Gets a pass by ID with its pass type
 * @param {string} passId
 * @returns {Promise<import('./result').Result<PassWithType>>}
 */
export async function getPassById(passId) {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .schema("pass")
    .from("passes")
    .select(`*
      , pass_type:pass_types(name, code, duration_minutes)
    `)
    .eq("id", passId)
    .single()

  if (error) {
    logger.error({ passId, error: error.message }, "[Passes] Error fetching pass")
    return fromSupabaseError(error)
  }

  return ok(data)
}

/**
 * Updates pass PIN code
 * @param {string} passId
 * @param {string} pinCode
 * @returns {Promise<import('./result').Result<boolean>>}
 */
export async function updatePassPinCode(passId, pinCode) {
  const supabase = createServiceClient()

  const { error } = await supabase
    .schema("pass")
    .from("passes")
    .update({
      pin_code: pinCode,
      pin_status: "generated",
    })
    .eq("id", passId)

  if (error) {
    logger.error({ passId, error: error.message }, "[Pass] Error updating PIN code")
    return fromSupabaseError(error)
  }

  logger.info({ passId }, "[Pass] PIN code generated successfully")
  return ok(true)
}

/**
 * Updates pass PIN status
 * @param {string} passId
 * @param {"pending" | "generated" | "failed"} status
 * @returns {Promise<import('./result').Result<boolean>>}
 */
export async function updatePassPinStatus(passId, status) {
  const supabase = createServiceClient()

  const { error } = await supabase.schema("pass").from("passes").update({ pin_status: status }).eq("id", passId)

  if (error) {
    logger.error({ passId, error: error.message }, "[Pass] Error updating pass PIN status")
    return fromSupabaseError(error)
  }

  return ok(true)
}

/**
 * Updates pass with lock request information
 * @param {string} passId
 * @param {string} lockRequestId
 * @returns {Promise<import('./result').Result<boolean>>}
 */
export async function updatePassWithLockRequest(passId, lockRequestId) {
  const supabase = createServiceClient()

  const { error } = await supabase
    .schema("pass")
    .from("passes")
    .update({
      lock_request_id: lockRequestId,
      lock_requested_at: new Date().toISOString(),
      pin_status: "pending",
    })
    .eq("id", passId)

  if (error) {
    logger.error({ passId, error: error.message }, "[Pass] Error updating lock request")
    return fromSupabaseError(error)
  }

  return ok(true)
}

/**
 * Updates pass with lock error information
 * @param {string} passId
 * @param {string} errorMessage
 * @returns {Promise<import('./result').Result<boolean>>}
 */
export async function updatePassWithLockError(passId, errorMessage) {
  const supabase = createServiceClient()

  const { error } = await supabase
    .schema("pass")
    .from("passes")
    .update({
      pin_status: "failed",
      lock_request_error: errorMessage,
    })
    .eq("id", passId)

  if (error) {
    logger.error({ passId, error: error.message }, "[Pass] Error updating lock error")
    return fromSupabaseError(error)
  }

  return ok(true)
}

// Gradually migrate callers to use the new Result-returning functions above

/**
 * @deprecated Use createPass which returns Result<Pass>
 */
export async function createPassLegacy(data) {
  const result = await createPass(data)
  return result.success ? result.data : null
}

/**
 * @deprecated Use updatePassStatus which returns Result<boolean>
 */
export async function updatePassStatusLegacy(passId, status, validFrom, validTo) {
  const result = await updatePassStatus(passId, status, validFrom, validTo)
  return result.success
}

/**
 * @deprecated Use getPassById which returns Result<PassWithType>
 */
export async function getPassByIdLegacy(passId) {
  const result = await getPassById(passId)
  return result.success ? result.data : null
}
