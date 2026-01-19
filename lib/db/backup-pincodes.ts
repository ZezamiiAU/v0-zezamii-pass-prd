import { createSchemaServiceClient } from "@/lib/supabase/server"

export interface BackupPincode {
  id: string
  org_id: string
  site_id: string
  device_id: string
  fortnight_number: number
  pincode: string
  period_start: string
  period_end: string
}

/**
 * Get the current backup pincode for a specific org/site/device based on the current date
 * Returns the pincode and fortnight number for use in fallback scenarios
 */
export async function getBackupPincode(
  orgId: string,
  siteId: string,
  deviceId: string,
): Promise<{ pincode: string; fortnight_number: number } | null> {
  const supabase = createSchemaServiceClient("pass")
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from("backup_pincodes")
    .select("pincode, fortnight_number, period_start, period_end")
    .eq("org_id", orgId)
    .eq("site_id", siteId)
    .eq("device_id", deviceId)
    .lte("period_start", now)
    .gte("period_end", now)
    .maybeSingle()

  if (error || !data) {
    console.error("[BackupPincodes] Failed to get backup pincode:", error ? JSON.stringify(error) : "No data found")

    return null
  }

  return {
    pincode: data.pincode,
    fortnight_number: data.fortnight_number,
  }
}

/**
 * Get the current backup pincode for a device based on the current date
 * Falls within the fortnight period (Jan 17, 2026 start, 14 days each)
 */
export async function getCurrentBackupPincode(deviceId: string): Promise<string | null> {
  const supabase = createSchemaServiceClient("pass")
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from("backup_pincodes")
    .select("pincode")
    .eq("device_id", deviceId)
    .lte("period_start", now)
    .gte("period_end", now)
    .maybeSingle()

  if (error || !data) {
    console.error("[BackupPincodes] Failed to get backup pincode:", error ? JSON.stringify(error) : "No data found")
    return null
  }

  return data.pincode
}

/**
 * Calculate which fortnight number a given date falls into
 * Fortnight 1 starts Jan 17, 2026
 */
export function calculateFortnightNumber(date: Date = new Date()): number | null {
  const startDate = new Date("2026-01-17T00:00:00+11:00")
  const msPerFortnight = 14 * 24 * 60 * 60 * 1000

  if (date < startDate) {
    return null // Before the backup pincode system starts
  }

  const msSinceStart = date.getTime() - startDate.getTime()
  const fortnightNumber = Math.floor(msSinceStart / msPerFortnight) + 1

  if (fortnightNumber > 26) {
    return null // Beyond the 26 fortnights we have codes for
  }

  return fortnightNumber
}

/**
 * Get backup pincode by fortnight number for a device
 */
export async function getBackupPincodeByFortnight(deviceId: string, fortnightNumber: number): Promise<string | null> {
  if (fortnightNumber < 1 || fortnightNumber > 26) {
    return null
  }

  const supabase = createSchemaServiceClient("pass")

  const { data, error } = await supabase
    .from("backup_pincodes")
    .select("pincode")
    .eq("device_id", deviceId)
    .eq("fortnight_number", fortnightNumber)
    .maybeSingle()

  if (error || !data) {
    console.error("[BackupPincodes] Failed to get backup pincode for fortnight:", fortnightNumber, error ? JSON.stringify(error) : "No data found")
    return null
  }

  return data.pincode
}
