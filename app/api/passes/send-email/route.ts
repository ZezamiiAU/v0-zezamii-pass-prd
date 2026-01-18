import { type NextRequest, NextResponse } from "next/server"
import { sendPassNotifications } from "@/lib/notifications"
import logger from "@/lib/logger"
import { z } from "zod"

const sendEmailSchema = z.object({
  email: z.string().email(),
  phone: z.string().optional().nullable(),
  pin: z.string(),
  accessPointName: z.string(),
  validFrom: z.string(),
  validTo: z.string(),
  vehiclePlate: z.string().optional().nullable(),
  timezone: z.string().optional().default("Australia/Sydney"),
  passId: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const data = sendEmailSchema.parse(body)

    await sendPassNotifications(
      data.email,
      data.phone || null,
      {
        accessPointName: data.accessPointName,
        pin: data.pin,
        validFrom: data.validFrom,
        validTo: data.validTo,
        vehiclePlate: data.vehiclePlate || undefined,
      },
      data.timezone
    )

    logger.info({ email: data.email, passId: data.passId }, "Pass email sent via send-email endpoint")

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : String(error) }, "Failed to send pass email")
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 })
  }
}
