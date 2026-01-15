import { type NextRequest, NextResponse } from "next/server"
import { getPassByCheckoutSession, getPassByPaymentIntent } from "@/lib/db/payments"
import { getLockCodeByPassId } from "@/lib/db/lock-codes"
import { createSchemaServiceClient } from "@/lib/supabase/server"
import { validateSearchParams, handleValidationError } from "@/lib/utils/validate-request"
import { sessionQuerySchema } from "@/lib/schemas/api.schema"
import { ZodError } from "zod"
import { ENV } from "@/lib/env"
import { rateLimit, getRateLimitHeaders } from "@/lib/rate-limit"
import logger from "@/lib/logger"

export async function GET(request: NextRequest) {
  if (!rateLimit(request, 30, 60000)) {
    const headers = getRateLimitHeaders(request, 30)
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429, headers })
  }

  try {
    const devMode = ENV.server().PASS_DEV_MODE === "true"

    const { session_id: sessionId, payment_intent: intentId } = validateSearchParams(request, sessionQuerySchema)

    if (!sessionId && !intentId) {
      return NextResponse.json({ error: "Session ID or Payment Intent ID required" }, { status: 400 })
    }

    let result
    if (sessionId) {
      result = await getPassByCheckoutSession(sessionId)
    } else if (intentId) {
      result = await getPassByPaymentIntent(intentId)
    }

    if (!result) {
      if (devMode) {
        return NextResponse.json(
          {
            status: "pending",
            message: "Pass is still being created",
            devMode: true,
          },
          { status: 202 },
        )
      }
      return NextResponse.json({ error: "Pass not found" }, { status: 404 })
    }

    const payment = result
    const pass = payment.pass

    if (!pass) {
      if (devMode) {
        return NextResponse.json(
          {
            status: "pending",
            message: "Pass data is still being created",
            paymentStatus: payment.status,
            devMode: true,
          },
          { status: 202 },
        )
      }
      return NextResponse.json({ error: "Pass data not found" }, { status: 404 })
    }

    if (!devMode) {
      if (pass.status !== "active") {
        return NextResponse.json(
          {
            error: "Pass not yet active",
            status: pass.status,
            paymentStatus: payment.status,
          },
          { status: 400 },
        )
      }

      if (payment.status !== "succeeded") {
        return NextResponse.json(
          {
            error: "Lock not connected. Contact support@zezamii.com",
            status: pass.status,
            paymentStatus: payment.status,
          },
          { status: 400 },
        )
      }
    }

    let accessPointName = "Access Point"
    const timezone = "UTC"

    try {
      const coreDb = createSchemaServiceClient("core")

      if (pass.device_id) {
        const { data: device } = await coreDb.from("devices").select("name").eq("id", pass.device_id).maybeSingle()

        if (device?.name) {
          accessPointName = device.name
        }
      }
    } catch (lookupError) {
      logger.warn(
        { error: lookupError instanceof Error ? lookupError.message : lookupError },
        "[BySession] Error fetching access point details",
      )
    }

    let lockCode = null
    let lockCodeError = false
    if (pass.status === "active") {
      try {
        const code = await getLockCodeByPassId(pass.id)
        lockCode = code?.code || null

        if (lockCode === null) {
          lockCodeError = true
          logger.warn({ passId: pass.id }, "[BySession] Lock code is null for active pass")
        }
      } catch (lockCodeFetchError) {
        lockCodeError = true
        logger.error(
          {
            passId: pass.id,
            error: lockCodeFetchError instanceof Error ? lockCodeFetchError.message : lockCodeFetchError,
          },
          "[BySession] Exception while fetching lock code",
        )
      }
    }

    return NextResponse.json({
      pass_id: pass.id,
      accessPointName,
      timezone,
      code: lockCode,
      codeUnavailable: lockCodeError,
      valid_from: pass.valid_from,
      valid_to: pass.valid_to,
      passType: pass.pass_type.name,
      vehiclePlate: pass.vehicle_plate,
      device_id: pass.device_id,
      // Debug fields (safe in dev)
      ...(devMode && {
        devMode: true,
        status: pass.status,
        paymentStatus: payment.status,
      }),
    })
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : error },
      "[BySession] Error in GET /api/passes/by-session",
    )
    if (error instanceof ZodError) {
      return handleValidationError(error)
    }
    return NextResponse.json({ error: "Failed to fetch pass details" }, { status: 500 })
  }
}
