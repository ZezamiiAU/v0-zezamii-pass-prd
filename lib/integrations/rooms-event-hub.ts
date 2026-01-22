import { createSchemaServiceClient } from "@/lib/supabase/server"
import logger from "@/lib/logger"
import { v5 as uuidv5 } from "uuid"

export type RoomsReservationStatus = "Pending" | "Confirmed" | "Cancelled"

export interface RoomsReservationPayload {
  propertyId: string // site_id
  reservationId: string // pass_id (booking id)
  arrivalDate: string // valid_from ISO format
  departureDate: string // valid_to ISO format
  guestId: string // UUID generated from email/phone
  guestFirstName: string // "Guest" or empty
  guestLastName: string // email address
  guestEmail: string // email or empty
  guestPhone: string // phone or empty
  roomId: string // device_id
  roomName: string // org-slug/site-slug/device-slug
  status: RoomsReservationStatus // "Pending", "Confirmed", or "Cancelled"
}

export interface RoomsReservationResponse {
  success: boolean
  reservationId?: string // The pass_id we sent
  error?: string
  statusCode?: number
  pincode?: string // PIN code if returned by Rooms API (may also arrive async via Portal webhook)
}

const GUEST_ID_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8" // UUID v1 namespace

/**
 * Generate a deterministic UUID v5 from email or phone
 */
export function generateGuestId(emailOrPhone: string): string {
  return uuidv5(emailOrPhone.toLowerCase().trim(), GUEST_ID_NAMESPACE)
}

/**
 * Split a full name into first and last name components
 * Uses regex to handle various name formats:
 * - "John Smith" -> { firstName: "John", lastName: "Smith" }
 * - "John" -> { firstName: "John", lastName: "" }
 * - "John Paul Smith" -> { firstName: "John Paul", lastName: "Smith" }
 * - "" -> { firstName: "Guest", lastName: "" }
 * 
 * Always returns valid strings - never throws, always has defaults
 */
export function splitFullName(fullName?: string): { firstName: string; lastName: string } {
  const DEFAULT_RESULT = { firstName: "Guest", lastName: "" }
  
  try {
    // Handle null, undefined, or non-string inputs
    if (!fullName || typeof fullName !== "string") {
      return DEFAULT_RESULT
    }

    const trimmed = fullName.trim()
    
    // Handle empty string after trim
    if (!trimmed || trimmed.length === 0) {
      return DEFAULT_RESULT
    }

    // Clean the name - remove extra spaces, keep only valid characters
    const cleaned = trimmed.replace(/\s+/g, " ").replace(/[^a-zA-Z\s'-]/g, "")
    
    if (!cleaned || cleaned.length === 0) {
      return DEFAULT_RESULT
    }

    // Match: everything before the last space = firstName, everything after = lastName
    const match = cleaned.match(/^(.+)\s+(\S+)$/)
    
    if (match && match[1] && match[2]) {
      return {
        firstName: match[1].trim() || "Guest",
        lastName: match[2].trim() || "",
      }
    }

    // Single word name - treat as first name only
    return {
      firstName: cleaned || "Guest",
      lastName: "",
    }
  } catch (error) {
    // If anything goes wrong, return safe defaults
    logger.warn({ fullName, error: error instanceof Error ? error.message : String(error) }, "Error splitting full name, using defaults")
    return DEFAULT_RESULT
  }
}

/**
 * Build the Rooms reservation payload from pass data
 * roomId uses the combined slugPath (org-slug/site-slug/device-slug) for consistency
 */
export function buildRoomsPayload(params: {
  siteId: string
  passId: string
  validFrom: string
  validTo: string
  fullName?: string
  email?: string
  phone?: string
  slugPath: string // "org-slug/site-slug/device-slug" - used as roomId
  status?: RoomsReservationStatus // "Pending", "Confirmed", or "Cancelled"
}): RoomsReservationPayload {
  const contactInfo = params.email || params.phone || "unknown"
  const { firstName, lastName } = splitFullName(params.fullName)

  return {
    propertyId: params.siteId,
    reservationId: params.passId,
    arrivalDate: params.validFrom,
    departureDate: params.validTo,
    guestId: generateGuestId(contactInfo),
    guestFirstName: firstName,
    guestLastName: lastName,
    guestEmail: params.email || "",
    guestPhone: params.phone || "",
    roomId: params.slugPath, // Use combined slug as roomId
    roomName: params.slugPath,
    status: params.status || "Pending",
  }
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
  logger.info({ organisationId }, "createRoomsReservation called")

  try {
    // Fetch integration config from database
    const core = createSchemaServiceClient("core")
    logger.info({ organisationId }, "Querying integrations table for rooms_event_hub")
    const { data: integration, error: configError } = await core
      .from("integrations")
      .select("id, config, credentials")
      .eq("organisation_id", organisationId)
      .eq("integration_type", "rooms_event_hub")
      .eq("status", "active")
      .maybeSingle()

    logger.info({ organisationId, found: !!integration, error: configError?.message }, "Integration query result")

    if (configError || !integration) {
      logger.warn({ organisationId, configError: configError?.message || "No integration found" }, "Rooms integration not configured")
      return {
        success: false,
        error: "Rooms integration not configured for this organisation",
      }
    }

    const config = integration.config as { base_url: string; webhook_path: string }
    const url = `${config.base_url}${config.webhook_path}`
    logger.info({ organisationId, url }, "Calling Rooms API")

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

    // Note: Per PRD, Rooms API does NOT return a PIN in its response.
    // PIN is delivered asynchronously via Portal webhook to /api/webhooks/rooms/pin
    // We consider the call successful if HTTP response is OK (2xx)
    const pincode =
      responseBody.pincode || responseBody.pin_code || responseBody.pin || responseBody.code || responseBody.accessCode

    logger.info(
      {
        organisationId,
        reservationId: payload.reservationId,
        duration,
        hasPincode: !!pincode,
        responseBody,
      },
      "Rooms reservation created successfully - PIN will arrive via webhook",
    )

    return {
      success: true,
      pincode: pincode ? String(pincode) : undefined,
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
        .maybeSingle()

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
