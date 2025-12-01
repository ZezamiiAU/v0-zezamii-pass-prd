import { createServiceClient } from "@/lib/supabase/server"
import logger from "@/lib/logger"

export interface EmailFailureRecord {
  recipient: string
  subject: string
  template_name?: string
  error_message: string
  attempts: number
  payload_summary?: Record<string, any>
}

export async function logEmailFailure(failure: EmailFailureRecord): Promise<void> {
  const supabase = createServiceClient()

  const { error } = await supabase
    .schema("analytics")
    .from("email_failures")
    .insert({
      recipient: failure.recipient,
      subject: failure.subject,
      template_name: failure.template_name,
      error_message: failure.error_message,
      attempts: failure.attempts,
      payload_summary: failure.payload_summary || null,
    })

  if (error) {
    logger.error({ error, recipient: failure.recipient }, "Failed to log email failure to database")
  }
}
