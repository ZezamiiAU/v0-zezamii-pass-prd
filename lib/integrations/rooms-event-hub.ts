import { createSchemaServiceClient } from "@/lib/supabase/server"
import logger from "@/lib/logger"

export interface RoomsReservationPayload {
  propertyId: string
  reservationId: string
  arrivalDate: string
  departureDate: string
  lockId: string
  guestId?: string
  guestName?: string
  guestPhone?: string
  guestEmail?: string
}

export interface RoomsReservationResponse {
  success: boolean
  pincode?: string
  reservationId?: string
  error?: string
  statusCode?: number
}

/**
 * Call Rooms Event Hub API to create reservation and get pincode
 * This is a SYNCHRONOUS call - we wait for the response with pincode
 */
export async function createRoomsReservation(
  organisationId: string,
  payload: RoomsReservationPayload,
): Promise<RoomsReservationResponse> {
  const startTime = Date.now()

  try {
    // Fetch integration config from database
    const core = createSchemaServiceClient("core")
    const { data: integration, error: configError } = await core
      .from("integrations")
      .select("id, config, credentials")
      .eq("organisation_id", organisationId)
      .eq("integration_type", "rooms_event_hub")
      .eq("status", "active")
      .single()

    if (configError || !integration) {
      logger.error({ organisationId, configError }, "Rooms integration not configured")
      return {
        success: false,
        error: "Rooms integration not configured for this organisation",
      }
    }

    const config = integration.config as { base_url: string; webhook_path: string }
    const credentials = integration.credentials as { reservation_id_prefix?: string }

    const url = `${config.base_url}${config.webhook_path}`

    // Make synchronous HTTP call to Rooms API
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    })

    const duration = Date.now() - startTime
    const responseBody = await response.json()

    // Log the API call
    await core.from("integration_logs").insert({
      integration_id: integration.id,
      operation: "create_reservation",
      request_payload: { url, payload },
      response_payload: responseBody,
      status: response.ok ? "success" : "error",
      http_status_code: response.status,
      error_message: response.ok ? null : responseBody.error || `HTTP ${response.status}`,
      duration_ms: duration,
    })

    // Update last_used_at
    await core.from("integrations").update({ last_used_at: new Date().toISOString() }).eq("id", integration.id)

    if (!response.ok) {
      logger.error(
        {
          organisationId,
          status: response.status,
          responseBody,
        },
        "Rooms API returned error",
      )

      return {
        success: false,
        statusCode: response.status,
        error: responseBody.error || `HTTP ${response.status}`,
      }
    }

    // Extract pincode from response
    const pincode = responseBody.pincode || responseBody.pin_code || responseBody.pin || responseBody.code

    if (!pincode) {
      logger.error({ organisationId, responseBody }, "Rooms API did not return pincode")
      return {
        success: false,
        error: "Rooms API did not return pincode",
      }
    }

    logger.info(
      {
        organisationId,
        reservationId: payload.reservationId,
        duration,
      },
      "Rooms reservation created successfully",
    )

    return {
      success: true,
      pincode: String(pincode),
      reservationId: payload.reservationId,
      statusCode: response.status,
    }
  } catch (error) {
    const duration = Date.now() - startTime

    logger.error(
      {
        organisationId,
        error: error instanceof Error ? error.message : String(error),
        duration,
      },
      "Rooms API call failed",
    )

    // Try to log the error
    try {
      const core = createSchemaServiceClient("core")
      const { data: integration } = await core
        .from("integrations")
        .select("id")
        .eq("organisation_id", organisationId)
        .eq("integration_type", "rooms_event_hub")
        .single()

      if (integration) {
        await core.from("integration_logs").insert({
          integration_id: integration.id,
          operation: "create_reservation",
          request_payload: { payload },
          response_payload: null,
          status: error instanceof Error && error.name === "TimeoutError" ? "timeout" : "error",
          error_message: error instanceof Error ? error.message : String(error),
          duration_ms: duration,
        })
      }
    } catch (logError) {
      // Ignore logging errors
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error calling Rooms API",
    }
  }
}
