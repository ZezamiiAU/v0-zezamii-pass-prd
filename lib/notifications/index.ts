import { EmailProvider } from "./email-provider"
import type { PassNotificationData } from "./types"
import { generatePassNotificationText, generatePassNotificationHTML } from "./templates"
import logger from "@/lib/logger"

export async function sendPassNotifications(
  email: string | null,
  phone: string | null,
  data: PassNotificationData,
  timezone: string,
): Promise<void> {
  console.log("[v0] sendPassNotifications called with:", { email, phone, pin: data.pin })
  console.log("[v0] RESEND_API_KEY exists:", !!process.env.RESEND_API_KEY)
  console.log("[v0] EMAIL_FROM:", process.env.EMAIL_FROM)
  
  const promises: Promise<any>[] = []

  // Send email notification
  if (email) {
    console.log("[v0] Email is provided, creating EmailProvider")
    const emailProvider = new EmailProvider()
    const textBody = generatePassNotificationText(data, timezone)
    const htmlBody = generatePassNotificationHTML(data, timezone)

    promises.push(
      emailProvider
        .send({
          to: email,
          subject: `Your Access Pass - PIN: ${data.pin}`,
          body: textBody,
          html: htmlBody,
        })
        .then((result) => {
          if (result.success) {
            logger.info({ email }, "Pass notification email sent")
          } else {
            logger.error({ email, error: result.error }, "Pass notification email failed")
          }
        }),
    )
  }

  // Note: SMS is handled client-side via device's native SMS app
  // The success page will show a "Share via SMS" button that uses sms: URI

  await Promise.allSettled(promises)
}

export * from "./types"
export * from "./templates"
