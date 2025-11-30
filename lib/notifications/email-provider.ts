import type { NotificationProvider, NotificationMessage } from "./types"
import logger from "@/lib/logger"

export class EmailProvider implements NotificationProvider {
  async send(message: NotificationMessage): Promise<{ success: boolean; error?: string }> {
    try {
      logger.info({ to: message.to, subject: message.subject }, "Email notification sent (stub)")

      // TODO: Integrate with actual email service
      // Example with Resend:
      // const resend = new Resend(process.env.RESEND_API_KEY)
      // await resend.emails.send({
      //   from: 'noreply@zezamii.com.au',
      //   to: message.to,
      //   subject: message.subject,
      //   html: message.html || message.body,
      // })

      return { success: true }
    } catch (error) {
      logger.error({ error, to: message.to }, "Email notification failed")
      return { success: false, error: error instanceof Error ? error.message : "Email send failed" }
    }
  }
}
