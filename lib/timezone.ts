import logger from "@/lib/logger"

export function formatInTimezone(date: Date | string, timezone: string, _format = "yyyy-MM-dd HH:mm:ss"): string {
  try {
    const d = typeof date === "string" ? new Date(date) : date
    const options: Intl.DateTimeFormatOptions = { timeZone: timezone }
    return d.toLocaleString("en-AU", options)
  } catch (error) {
    logger.warn({ timezone, error: error instanceof Error ? error.message : error }, "[Timezone] Formatting error")
    return new Date(date as string).toISOString()
  }
}

export function formatLocalizedDateTime(date: Date | string, _timezone?: string): string {
  try {
    const d = typeof date === "string" ? new Date(date) : date
    const options: Intl.DateTimeFormatOptions = {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }
    return d.toLocaleString("en-AU", options)
  } catch (error) {
    logger.warn({ error: error instanceof Error ? error.message : error }, "[Timezone] Formatting error")
    return new Date(date as string).toLocaleString()
  }
}

export function addMinutes(date: Date, minutes: number, _timezone: string): Date {
  return new Date(date.getTime() + minutes * 60 * 1000)
}
