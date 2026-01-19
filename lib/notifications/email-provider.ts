import type { NotificationProvider, NotificationMessage } from "./types"
import logger from "@/lib/logger"
import { Resend } from "resend"
import { logEmailFailure } from "@/lib/db/email-failures"

const RETRY_DELAYS = [250, 750, 1500] // milliseconds
const MAX_ATTEMPTS = 3

const TRANSIENT_ERROR_CODES = [429, 500, 502, 503, 504]

interface ResendError extends Error {
  statusCode?: number
}

export class EmailProvider implements NotificationProvider {
  private resend: Resend | null = null
  private fromAddress: string
  private replyTo?: string

  constructor() {
    const apiKey = process.env.RESEND_API_KEY
    const fromAddress = process.env.EMAIL_FROM

    if (!apiKey) {
      logger.warn("RESEND_API_KEY not configured - email sending disabled")
      this.fromAddress = "noreply@example.com"
      return
    }

    if (!fromAddress) {
      logger.warn("EMAIL_FROM not configured - using default")
      this.fromAddress = "noreply@example.com"
    } else {
      this.fromAddress = fromAddress
    }

    this.replyTo = process.env.EMAIL_REPLY_TO
    this.resend = new Resend(apiKey)
  }

  async send(message: NotificationMessage): Promise<{ success: boolean; error?: string }> {
    console.log("[v0] EmailProvider.send called with:", { to: message.to, subject: message.subject })
    console.log("[v0] this.resend exists:", !!this.resend)
    console.log("[v0] this.fromAddress:", this.fromAddress)
    
    if (!this.resend) {
      const error = "Email provider not configured (missing RESEND_API_KEY)"
      console.log("[v0] Email provider not configured!")
      logger.error({ recipient: message.to }, error)
      return { success: false, error }
    }

    let lastError: Error | null = null
    let attempts = 0

    while (attempts < MAX_ATTEMPTS) {
      attempts++

      try {
        console.log("[v0] Attempting to send email via Resend...")
        const result = await this.resend.emails.send({
          from: this.fromAddress,
          to: message.to,
          subject: message.subject || "Notification",
          html: message.html || message.body,
          text: message.body,
          ...(this.replyTo && { reply_to: this.replyTo }),
        })
        console.log("[v0] Resend response:", result)

        logger.info(
          {
            recipient: message.to,
            subject: message.subject,
            attempt: attempts,
          },
          "Email sent successfully",
        )

        return { success: true }
      } catch (error) {
        lastError = error as Error
        const resendError = error as ResendError

        const isTransient = this.isTransientError(resendError)
        const isNetworkError = resendError.message?.toLowerCase().includes("network")

        logger.warn(
          {
            recipient: message.to,
            attempt: attempts,
            errorMessage: resendError.message,
            statusCode: resendError.statusCode,
            isTransient,
            isNetworkError,
          },
          "Email send attempt failed",
        )

        // Don't retry permanent errors (4xx except 429)
        if (!isTransient && !isNetworkError && attempts === 1) {
          logger.error(
            {
              recipient: message.to,
              errorMessage: resendError.message,
              statusCode: resendError.statusCode,
            },
            "Permanent email error - not retrying",
          )
          break
        }

        // Wait before retry (except on last attempt)
        if (attempts < MAX_ATTEMPTS) {
          const delay = RETRY_DELAYS[attempts - 1]
          await this.sleep(delay)
        }
      }
    }

    const errorMessage = lastError?.message || "Unknown error"

    await logEmailFailure({
      recipient: message.to,
      subject: message.subject || "Notification",
      error_message: errorMessage,
      attempts,
      payload_summary: {
        hasHtml: !!message.html,
        bodyLength: message.body.length,
        fromAddress: this.fromAddress,
      },
    })

    logger.error(
      {
        recipient: message.to,
        subject: message.subject,
        attempts,
        errorMessage,
      },
      "Email failed after all retries - logged to dead letter table",
    )

    return { success: false, error: errorMessage }
  }

  private isTransientError(error: ResendError): boolean {
    if (error.statusCode && TRANSIENT_ERROR_CODES.includes(error.statusCode)) {
      return true
    }
    return false
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
