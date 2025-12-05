import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/server"
import logger from "@/lib/logger"
import { type Result, ok, err } from "./result"

export interface Pass {
  id: string
  org_id: string
  site_id: string | null
  device_id: string
  pass_type_id: string
  status: string
  vehicle_plate: string | null
  purchaser_email: string | null
  valid_from: string | null
  valid_to: string | null
  created_at: string
  pin_code?: string | null
  pin_status?: string | null
  lock_request_id?: string | null
  lock_request_error?: string | null
  lock_requested_at?: string | null
}

export interface PassWithType extends Pass {
  pass_type: {
    name: string
    code: string
    duration_minutes: number
  }
}

export async function createPass(data: {
  passTypeId: string
  vehiclePlate?: string
  purchaserEmail?: string
  validFrom?: Date
  validTo?: Date
  orgId: string
  deviceId: string
  siteId?: string
}): Promise<Pass | null> {
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
    return null
  }

  return pass
}

export async function updatePassStatus(
  passId: string,
  status: string,
  validFrom?: Date,
  validTo?: Date,
): Promise<boolean> {
  const supabase = createServiceClient()

  const updateData: any = { status }
  if (validFrom) updateData.valid_from = validFrom.toISOString()
  if (validTo) updateData.valid_to = validTo.toISOString()

  const { error } = await supabase.schema("pass").from("passes").update(updateData).eq("id", passId)

  if (error) {
    logger.error({ passId, status, error: error.message }, "[Passes] Error updating pass status")
    return false
  }

  return true
}

export async function getPassById(passId: string): Promise<PassWithType | null> {
  const supabase = await createClient()

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
    return null
  }

  return data
}

export async function updatePassPinCode(passId: string, pinCode: string): Promise<boolean> {
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
    return false
  }

  logger.info({ passId }, "[Pass] PIN code generated successfully")
  return true
}

export async function updatePassPinStatus(
  passId: string,
  status: "pending" | "generated" | "failed",
): Promise<boolean> {
  const supabase = createServiceClient()

  const { error } = await supabase.schema("pass").from("passes").update({ pin_status: status }).eq("id", passId)

  if (error) {
    logger.error({ passId, error: error.message }, "[Pass] Error updating pass PIN status")
    return false
  }

  return true
}

export async function updatePassWithLockRequest(passId: string, lockRequestId: string): Promise<boolean> {
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
    return false
  }

  return true
}

export async function updatePassWithLockError(passId: string, errorMessage: string): Promise<boolean> {
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
    return false
  }

  return true
}

/**
 * Result-based wrapper functions
 * These provide better error handling without breaking existing code
 */

export async function createPassResult(data: Parameters<typeof createPass>[0]): Promise<Result<Pass>> {
  const pass = await createPass(data)
  if (!pass) {
    return err(new Error("Failed to create pass"))
  }
  return ok(pass)
}

export async function getPassByIdResult(passId: string): Promise<Result<PassWithType>> {
  const pass = await getPassById(passId)
  if (!pass) {
    return err(new Error(`Pass not found: ${passId}`))
  }
  return ok(pass)
}

export async function updatePassStatusResult(
  passId: string,
  status: string,
  validFrom?: Date,
  validTo?: Date,
): Promise<Result<boolean>> {
  const success = await updatePassStatus(passId, status, validFrom, validTo)
  if (!success) {
    return err(new Error(`Failed to update pass status: ${passId}`))
  }
  return ok(true)
}
