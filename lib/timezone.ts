import * as luxon from "luxon"

const { DateTime } = luxon

export function formatInTimezone(
  date: Date | string,
  timezone: string,
  format = "yyyy-MM-dd HH:mm:ss",
): string {
  try {
    const dt = typeof date === "string" ? DateTime.fromISO(date) : DateTime.fromJSDate(date)
    return dt.setZone(timezone).toFormat(format)
  } catch (error) {
    console.error("[v0] Timezone formatting error:", error)
    return new Date(date as any).toISOString()
  }
}

export function formatLocalizedDateTime(date: Date | string, _timezone?: string): string {
  try {
    // Parse the date as UTC (since it comes from the database as UTC)
    const dt =
      typeof date === "string"
        ? DateTime.fromISO(date, { zone: "utc" })
        : DateTime.fromJSDate(date, { zone: "utc" })

    // Convert to user's local timezone and format
    return dt.toLocal().toLocaleString(DateTime.DATETIME_MED)
  } catch (error) {
    console.error("[v0] Timezone formatting error:", error)
    return new Date(date as any).toLocaleString()
  }
}

export function addMinutes(date: Date, minutes: number, timezone: string): Date {
  const dt = DateTime.fromJSDate(date).setZone(timezone).plus({ minutes })
  return dt.toJSDate()
}
