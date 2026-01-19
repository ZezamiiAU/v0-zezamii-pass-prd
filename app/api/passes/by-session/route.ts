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
    let returnUrl: string | null = null

    try {
      const coreDb = createSchemaServiceClient("core")

      if (pass.device_id) {
        const { data: device } = await coreDb
          .from("devices")
          .select("name, slug, site_id")
          .eq("id", pass.device_id)
          .maybeSingle()

        if (device?.name) {
          accessPointName = device.name
        }

        if (device?.site_id) {
          const { data: site } = await coreDb
            .from("sites")
            .select("slug, org_id")
            .eq("id", device.site_id)
            .maybeSingle()

          if (site?.org_id) {
            const { data: org } = await coreDb.from("organisations").select("slug").eq("id", site.org_id).maybeSingle()

            if (org?.slug && site?.slug && device?.slug) {
              returnUrl = `/p/${org.slug}/${site.slug}/${device.slug}`
            }
          }
        }
      }
    } catch (lookupError) {
      logger.warn(
        { error: lookupError instanceof Error ? lookupError.message : String(lookupError) },
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
            error: lockCodeFetchError instanceof Error ? lockCodeFetchError.message : String(lockCodeFetchError),
          },
          "[BySession] Exception while fetching lock code",
        )
      }
    }

    // Get backup code from payment metadata if available
    let backupCode: string | null = null
    let pinSource: "rooms" | "backup" | null = null
    
    try {
      if (payment.metadata && typeof payment.metadata === "object") {
        const meta = payment.metadata as Record<string, unknown>
        if (meta.backup_pincode && typeof meta.backup_pincode === "string") {
          backupCode = meta.backup_pincode
        }
        if (meta.pin_source && typeof meta.pin_source === "string") {
          pinSource = meta.pin_source as "rooms" | "backup"
        }
      }
    } catch {
      // Ignore metadata parsing errors
    }

    return NextResponse.json({
      pass_id: pass.id,
      accessPointName,
      timezone,
      code: lockCode,
      backupCode,
      pinSource,
      codeUnavailable: lockCodeError,
      valid_from: pass.valid_from,
      valid_to: pass.valid_to,
      passType: pass.pass_type.name,
      vehiclePlate: pass.vehicle_plate,
      device_id: pass.device_id,
      returnUrl,
      ...(devMode && {
        devMode: true,
        status: pass.status,
        paymentStatus: payment.status,
      }),
    })
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "[BySession] Error in GET /api/passes/by-session",
    )
    if (error instanceof ZodError) {
      return handleValidationError(error)
    }
    return NextResponse.json({ error: "Failed to fetch pass details" }, { status: 500 })
  }
}
