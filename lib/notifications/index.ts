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
  const promises: Promise<any>[] = []

  // Send email notification
  if (email) {
    const emailProvider = new EmailProvider()
    const textBody = generatePassNotificationText(data, timezone)
    const htmlBody = generatePassNotificationHTML(data, timezone)

    promises.push(
      emailProvider
        .send({
          to: email,
          subject: `Your Zezamii Pass - PIN: ${data.pin}`,
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
