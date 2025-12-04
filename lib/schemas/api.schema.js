import { z } from "zod"

/**
 * API Schema Definitions
 *
 * This file contains all Zod validation schemas used across API routes.
 * Do NOT add default exports or move schemas inline to routes.
 * All schemas must be centralized here.
 *
 * Guardrail: lib/schemas/api.schema.test-d.ts imports all exports to ensure
 * TypeScript compilation fails if any export is removed or renamed.
 */

// ============================================================================
// PARAMS SCHEMAS - For dynamic route segments like [gateId], [passId], etc.
// ============================================================================

export const accessPointIdParamSchema = z.object({
  accessPointId: z.string().uuid("accessPointId must be a UUID"),
})

export const passIdParamSchema = z.object({
  passId: z.string().uuid("passId must be a UUID"),
})

export const subscriptionIdParamSchema = z.object({
  subscriptionId: z.string().uuid("subscriptionId must be a UUID"),
})

// ============================================================================
// BODY SCHEMAS - For JSON request payloads
// ============================================================================

export const accessPointVerifyBodySchema = z.object({
  code: z.string().min(1, "Code is required"),
  token: z.string().optional(),
  accessPointId: z.string().uuid("accessPointId must be a UUID").optional(),
})

export const syncPaymentBodySchema = z.object({
  paymentIntentId: z.string().min(1, "Payment intent ID is required"),
})

export const webhookSubscriptionBodySchema = z.object({
  org_id: z.string().uuid("org_id must be a UUID"),
  url: z.string().url("URL must be a valid URL"),
  events: z.array(z.string()).optional(),
  description: z.string().optional(),
})

export const webhookSubscriptionUpdateSchema = z.object({
  events: z.array(z.string()).min(1).optional(),
  is_active: z.boolean().optional(),
})

export const checkoutSchema = z.object({
  accessPointId: z.string().min(1, "Access Point ID is required"),
  passTypeId: z.string().uuid("Invalid pass type ID"),
  email: z.string().email("Invalid email address").min(1, "Email is required"),
  plate: z
    .string()
    .regex(/^[A-Z0-9]{1,8}$/, "Invalid plate format")
    .optional()
    .or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  baseUrl: z.string().url("Invalid base URL").optional(),
})

/** @typedef {z.infer<typeof checkoutSchema>} CheckoutInput */

export const stripeMetaSchema = z.object({
  org_slug: z.string().min(1).optional(),
  orgId: z.string().uuid().optional(),
  product: z.enum(["pass", "room"]).optional(),
  passId: z.string().uuid().optional(),
  pass_id: z.string().uuid().optional(),
  passTypeId: z.string().uuid().optional(),
  pass_type_id: z.string().uuid().optional(),
  accessPointId: z.string().uuid().optional(),
  access_point_id: z.string().uuid().optional(),
  gate_id: z.string().uuid().optional(), // @deprecated - use accessPointId
  variant: z.string().optional(),
  customer_email: z.string().optional(),
  customer_phone: z.string().optional(),
  customer_plate: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  plate: z.string().optional(),
})

// ============================================================================
// QUERY SCHEMAS - For URL search parameters
// ============================================================================

export const sessionQuerySchema = z
  .object({
    session_id: z.string().startsWith("cs_", "Session ID must start with cs_").nullable().optional(),
    payment_intent: z.string().startsWith("pi_", "Payment Intent ID must start with pi_").nullable().optional(),
  })
  .refine((data) => data.session_id || data.payment_intent, {
    message: "Either session_id or payment_intent is required",
    path: ["session_id"],
  })

export const walletSaveQuerySchema = z.object({
  passId: z.string().uuid("passId must be a UUID").optional(),
  platform: z.enum(["apple", "google"]).optional(),
  userId: z.string().optional(),
  deviceId: z.string().optional(),
  passType: z.string().optional(),
  code: z.string().optional(),
  validFrom: z.string().optional(),
  validTo: z.string().optional(),
  accessPoint: z.string().optional(),
})

export const unlockJwtQuerySchema = z.object({
  token: z.string().min(1, "Token is required"),
  userId: z.string().min(1, "User ID is required"),
  deviceId: z.string().min(1, "Device ID is required"),
})

// ============================================================================
// COMMON REUSABLE SCHEMAS
// ============================================================================

export const uuidSchema = z.string().uuid("Must be a valid UUID")
export const emailSchema = z.string().email("Invalid email address")
export const urlSchema = z.string().url("Invalid URL")
export const slugSchema = z.string().regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens")
export const isoDateSchema = z.string().datetime({ message: "Must be ISO 8601 date string" })
export const positiveIntSchema = z.number().int().positive()
export const nonEmptyStringSchema = z.string().min(1, "Cannot be empty")
