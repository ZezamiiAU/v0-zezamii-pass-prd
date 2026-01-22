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
import Stripe from "stripe"
import { sendPassNotifications } from "@/lib/notifications"
import { getCurrentBackupPincode } from "@/lib/db/backup-pincodes"
import { createRoomsReservation, buildRoomsPayload } from "@/lib/integrations/rooms-event-hub"

const { STRIPE_SECRET_KEY } = ENV.server()
const stripe = new Stripe(STRIPE_SECRET_KEY)

export async function GET(request: NextRequest) {
  console.log("[v0] by-session: GET called with URL:", request.url)
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

    // Extract backup code from Stripe payment intent metadata (NOT our database)
    let backupCodeFromMeta: string | null = null
    try {
      // First try our database metadata
      if (payment.metadata && typeof payment.metadata === "object") {
        const meta = payment.metadata as Record<string, unknown>
        if (meta.backup_pincode && typeof meta.backup_pincode === "string") {
          backupCodeFromMeta = meta.backup_pincode
        }
      }
      
      // If not in our database, fetch from Stripe (where it's actually stored)
      if (!backupCodeFromMeta && payment.stripe_payment_intent) {
        const stripePaymentIntent = await stripe.paymentIntents.retrieve(payment.stripe_payment_intent)
        if (stripePaymentIntent.metadata?.backup_pincode) {
          backupCodeFromMeta = stripePaymentIntent.metadata.backup_pincode
          logger.debug({ backupCodeFromMeta }, "[BySession] Got backup code from Stripe metadata")
        }
      }
    } catch (metaError) {
      logger.warn({ error: metaError instanceof Error ? metaError.message : String(metaError) }, "[BySession] Error fetching backup code from metadata")
    }

    // Helper to get partial pass metadata for error responses
    const getPartialPassMeta = async () => {
      let accessPointName = "Access Point"
      let returnUrl: string | null = null
      let timezone = "Australia/Sydney" // Default timezone
      
      if (pass?.device_id) {
        try {
          const coreDb = createSchemaServiceClient("core")
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
              .select("slug, org_id, timezone")
              .eq("id", device.site_id)
              .maybeSingle()

            // Use site timezone if available
            if (site?.timezone) {
              timezone = site.timezone
            }

            if (site?.org_id) {
              const { data: org } = await coreDb.from("organisations").select("slug, timezone").eq("id", site.org_id).maybeSingle()

              // Fall back to org timezone if site doesn't have one
              if (!site?.timezone && org?.timezone) {
                timezone = org.timezone
              }

              if (org?.slug && site?.slug && device?.slug) {
                returnUrl = `/p/${org.slug}/${site.slug}/${device.slug}`
              }
            }
          }
        } catch (e) {
          logger.warn({ error: e instanceof Error ? e.message : String(e) }, "[BySession] Error fetching partial metadata")
        }
      }
      
      return {
        accessPointName,
        timezone,
        returnUrl,
        valid_from: pass?.valid_from || null,
        valid_to: pass?.valid_to || null,
        passType: pass?.pass_type?.name || null,
        vehiclePlate: pass?.vehicle_plate || null,
        device_id: pass?.device_id || null,
      }
    }

    if (!pass) {
      if (devMode) {
        return NextResponse.json(
          {
            status: "pending",
            message: "Pass data is still being created",
            paymentStatus: payment.status,
            backupCode: backupCodeFromMeta,
            devMode: true,
          },
          { status: 202 },
        )
      }
      return NextResponse.json({ error: "Pass data not found", backupCode: backupCodeFromMeta }, { status: 404 })
    }

    if (!devMode) {
      // Auto-sync: If payment succeeded but pass is not active, activate it now
      if (pass.status !== "active" && payment.status === "succeeded") {
        console.log("[v0] by-session: Auto-syncing pass - payment succeeded but pass not active")
        console.log("[v0] by-session: pass.id =", pass.id, "pass.status =", pass.status, "payment.status =", payment.status)
        
        try {
          const passDb = createSchemaServiceClient("pass")
          const coreDb = createSchemaServiceClient("core")
          
          // Get metadata from Stripe
          let meta: Record<string, string> = {}
          if (payment.stripe_payment_intent) {
            const stripeIntent = await stripe.paymentIntents.retrieve(payment.stripe_payment_intent)
            meta = stripeIntent.metadata || {}
            console.log("[v0] by-session: Stripe metadata =", JSON.stringify(meta))
          } else {
            console.log("[v0] by-session: No stripe_payment_intent on payment record")
          }
          
          // Calculate validity dates
          const numberOfDays = Number.parseInt(meta.number_of_days || "1", 10)
          const now = new Date()
          const startsAt = now.toISOString()
          const endsAt = new Date(now.getTime() + numberOfDays * 24 * 60 * 60 * 1000).toISOString()
          
          // Check if lock code already exists
          const existingLockCode = await getLockCodeByPassId(pass.id)
          console.log("[v0] by-session: existingLockCode =", existingLockCode ? "EXISTS" : "NULL")
          
          let pinCode: string | null = null
          let pinProvider: "rooms" | "backup" = "backup"
          
          if (!existingLockCode) {
            // Try Rooms API first - need device info for the payload
            const deviceId = pass.device_id || meta.access_point_id || meta.gate_id
            console.log("[v0] by-session: deviceId =", deviceId, "meta.org_id =", meta.org_id)
            if (deviceId && meta.org_id) {
              console.log("[v0] by-session: Attempting Rooms API call...")
              try {
// Get device and site info for Rooms payload
  const { data: device } = await coreDb
    .from("devices")
    .select("site_id, slug")
    .eq("id", deviceId)
    .single()

                if (device?.site_id) {
                  const { data: site } = await coreDb
                    .from("sites")
                    .select("slug, org_id")
                    .eq("id", device.site_id)
                    .single()

                  if (site) {
                    const { data: org } = await coreDb
                      .from("organisations")
                      .select("slug")
                      .eq("id", site.org_id)
                      .single()

                    if (org) {
                      const slugPath = `${org.slug}/${site.slug}/${device.slug}`
                      console.log("[v0] by-session: Building Rooms payload with slugPath =", slugPath)
                      const roomsPayload = buildRoomsPayload({
                        siteId: device.site_id,
                        passId: pass.id,
                        validFrom: startsAt,
                        validTo: endsAt,
                        fullName: meta.customer_name,
                        email: meta.customer_email,
                        phone: meta.customer_phone,
                        slugPath,
                        status: "Confirmed",
                      })
                      console.log("[v0] by-session: Calling createRoomsReservation with payload:", JSON.stringify(roomsPayload))
                      const roomsResult = await createRoomsReservation(meta.org_id, roomsPayload)
                      console.log("[v0] by-session: Rooms API result =", JSON.stringify(roomsResult))
                      // Note: Rooms API does NOT return pincode - PIN arrives async via Portal webhook
                      if (roomsResult.success) {
                        console.log("[v0] by-session: Rooms reservation confirmed, PIN will arrive via Portal webhook")
                      } else {
                        console.log("[v0] by-session: Rooms call failed:", roomsResult.error)
                      }
                    } else {
                      console.log("[v0] by-session: org not found")
                    }
                  } else {
                    console.log("[v0] by-session: site not found")
                  }
                } else {
                  console.log("[v0] by-session: device not found or no site_id")
                }
              } catch (roomsError) {
                console.log("[v0] by-session: Rooms API failed, using backup pincode", roomsError)
              }
            } else {
              console.log("[v0] by-session: Skipping Rooms - deviceId =", deviceId, "meta.org_id =", meta.org_id)
            }
            
            // Fallback to backup pincode
            if (!pinCode) {
              // First try backup code from Stripe metadata
              if (backupCodeFromMeta) {
                pinCode = backupCodeFromMeta
                pinProvider = "backup"
              } else if (pass.device_id) {
                // Try to get current backup pincode for this device
                const deviceBackupCode = await getCurrentBackupPincode(pass.device_id)
                if (deviceBackupCode) {
                  pinCode = deviceBackupCode
                  pinProvider = "backup"
                }
              }
            }
            
            // Store lock code
            if (pinCode) {
              await passDb.from("lock_codes").upsert({
                pass_id: pass.id,
                code: pinCode,
                status: "active",
                provider: pinProvider,
                provider_ref: pass.id, // Use pass_id as provider reference
                starts_at: startsAt,
                ends_at: endsAt,
              }, { onConflict: "pass_id" })
            }
          } else {
            pinCode = existingLockCode.code
            pinProvider = (existingLockCode.provider as "rooms" | "backup") || "backup"
          }
          
          // Activate the pass
          await passDb.from("passes").update({ 
            status: "active",
            valid_from: startsAt,
            valid_to: endsAt,
          }).eq("id", pass.id)
          
          // Update payment status
          await passDb.from("payments").update({ status: "succeeded" }).eq("id", payment.id)
          
          // Send email notification
          if (meta.customer_email && pinCode) {
            let accessPointName = "Access Point"
            if (pass.device_id) {
              const { data: device } = await coreDb.from("qr_ready_devices").select("name").eq("id", pass.device_id).single()
              if (device?.name) accessPointName = device.name
            }
            
            console.log("[v0] by-session: Sending email to", meta.customer_email)
            try {
              await sendPassNotifications(
                meta.customer_email,
                meta.customer_phone || null,
                {
                  accessPointName,
                  pin: pinCode,
                  validFrom: startsAt,
                  validTo: endsAt,
                  vehiclePlate: meta.customer_plate,
                },
                "Australia/Sydney",
              )
              console.log("[v0] by-session: Email sent successfully")
            } catch (emailErr) {
              console.log("[v0] by-session: Email failed:", emailErr)
            }
          }
          
          // Return successful response with the data
          return NextResponse.json({
            pass_id: pass.id,
            accessPointName: "Access Point",
            timezone: "Australia/Sydney",
            code: pinCode,
            backupCode: backupCodeFromMeta,
            pinSource: pinProvider,
            codeUnavailable: !pinCode,
            valid_from: startsAt,
            valid_to: endsAt,
            passType: pass.pass_type?.name || "Day Pass",
            vehiclePlate: pass.vehicle_plate,
            device_id: pass.device_id,
            returnUrl: null,
          })
        } catch (syncError) {
          console.log("[v0] by-session: Auto-sync failed:", syncError)
          // Fall through to return the 400 error
        }
      }

      if (pass.status !== "active") {
        const partialMeta = await getPartialPassMeta()
        return NextResponse.json(
          {
            error: "Pass not yet active",
            status: pass.status,
            paymentStatus: payment.status,
            backupCode: backupCodeFromMeta,
            ...partialMeta,
          },
          { status: 400 },
        )
      }

      if (payment.status !== "succeeded") {
        const partialMeta = await getPartialPassMeta()
        return NextResponse.json(
          {
            error: "Lock not connected. Contact support@zezamii.com",
            status: pass.status,
            paymentStatus: payment.status,
            backupCode: backupCodeFromMeta,
            ...partialMeta,
          },
          { status: 400 },
        )
      }
    }

    let accessPointName = "Access Point"
    let timezone = "Australia/Sydney" // Default timezone
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
            .select("slug, org_id, timezone")
            .eq("id", device.site_id)
            .maybeSingle()

          // Use site timezone if available
          if (site?.timezone) {
            timezone = site.timezone
          }

          if (site?.org_id) {
            const { data: org } = await coreDb.from("organisations").select("slug, timezone").eq("id", site.org_id).maybeSingle()

            // Fall back to org timezone if site doesn't have one
            if (!site?.timezone && org?.timezone) {
              timezone = org.timezone
            }

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
    let pinSource: "rooms" | "backup" | null = null
    
    if (pass.status === "active") {
      try {
        const lockCodeRecord = await getLockCodeByPassId(pass.id)
        lockCode = lockCodeRecord?.code || null
        
        // Determine pin source from lock_codes provider field
        if (lockCodeRecord?.provider === "rooms") {
          pinSource = "rooms"
        } else if (lockCode) {
          pinSource = "backup"
        }

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
    
    try {
      if (payment.metadata && typeof payment.metadata === "object") {
        const meta = payment.metadata as Record<string, unknown>
        if (meta.backup_pincode && typeof meta.backup_pincode === "string") {
          backupCode = meta.backup_pincode
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
