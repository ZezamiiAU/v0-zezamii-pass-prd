import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/server"

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
    console.error("Error creating pass:", error)
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
    console.error("Error updating pass status:", error)
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
    console.error("Error fetching pass:", error)
    return null
  }

  return data
}
