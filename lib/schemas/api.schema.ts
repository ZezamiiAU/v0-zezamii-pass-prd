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
export type AccessPointIdParam = z.infer<typeof accessPointIdParamSchema>

export const passIdParamSchema = z.object({
  passId: z.string().uuid("passId must be a UUID"),
})
export type PassIdParam = z.infer<typeof passIdParamSchema>

export const subscriptionIdParamSchema = z.object({
  subscriptionId: z.string().uuid("subscriptionId must be a UUID"),
})
export type SubscriptionIdParam = z.infer<typeof subscriptionIdParamSchema>

// ============================================================================
// BODY SCHEMAS - For JSON request payloads
// ============================================================================

export const accessPointVerifyBodySchema = z.object({
  code: z.string().min(1, "Code is required"),
  token: z.string().optional(),
  accessPointId: z.string().uuid("accessPointId must be a UUID").optional(),
})
export type AccessPointVerifyBody = z.infer<typeof accessPointVerifyBodySchema>

export const syncPaymentBodySchema = z.object({
  paymentIntentId: z.string().min(1, "Payment intent ID is required"),
})
export type SyncPaymentBody = z.infer<typeof syncPaymentBodySchema>

export const webhookSubscriptionBodySchema = z.object({
  org_id: z.string().uuid("org_id must be a UUID"),
  url: z.string().url("URL must be a valid URL"),
  events: z.array(z.string()).optional(),
  description: z.string().optional(),
})
export type WebhookSubscriptionBody = z.infer<typeof webhookSubscriptionBodySchema>

export const webhookSubscriptionUpdateSchema = z.object({
  events: z.array(z.string()).min(1).optional(),
  is_active: z.boolean().optional(),
})
export type WebhookSubscriptionUpdate = z.infer<typeof webhookSubscriptionUpdateSchema>

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
export type SessionQuery = z.infer<typeof sessionQuerySchema>

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
export type WalletSaveQuery = z.infer<typeof walletSaveQuerySchema>

export const unlockJwtQuerySchema = z.object({
  token: z.string().min(1, "Token is required"),
  userId: z.string().min(1, "User ID is required"),
  deviceId: z.string().min(1, "Device ID is required"),
})
export type UnlockJwtQuery = z.infer<typeof unlockJwtQuerySchema>

// ============================================================================
// CHECKOUT & STRIPE SCHEMAS
// ============================================================================

export const checkoutSchema = z.object({
  accessPointId: z.string().min(1, "Access Point ID is required"),
  passTypeId: z
    .string()
    .regex(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      "Invalid pass type ID - must be UUID format",
    ),
  fullName: z
    .string()
    .min(1, "Full name is required")
    .max(100, "Name too long")
    .regex(/^[a-zA-Z\s'-]+$/, "Name can only contain letters, spaces, hyphens, and apostrophes")
    .refine(
      (val) => val.trim().length >= 2,
      "Name must be at least 2 characters",
    ),
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  plate: z
    .string()
    .regex(/^[A-Z0-9\s-]{1,15}$/i, "Invalid plate format - use letters, numbers, hyphens, or spaces only")
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .transform((val) => val.replace(/[\s\-$$$$]/g, "")) // Strip spaces, hyphens, parentheses
    .refine(
      (val) => val === "" || /^(\+?\d{7,15})$/.test(val),
      "Invalid mobile number - enter 7-15 digits, optionally starting with +",
    )
    .optional()
    .or(z.literal("")),
  baseUrl: z.string().url("Invalid base URL").optional(),
  numberOfDays: z.number().int().min(1).max(28).optional().default(1),
})
export type CheckoutInput = z.infer<typeof checkoutSchema>

export const stripeMetaSchema = z.object({
  org_slug: z.string().min(1),
  product: z.enum(["pass", "room"]),
  pass_id: z.string().uuid().optional(),
  access_point_id: z.string().uuid().optional(),
  gate_id: z.string().uuid().optional(),
  variant: z.string().optional(),
  customer_email: z.string().optional(),
  customer_phone: z.string().optional(),
  customer_plate: z.string().optional(),
})
export type StripeMetadata = z.infer<typeof stripeMetaSchema>
