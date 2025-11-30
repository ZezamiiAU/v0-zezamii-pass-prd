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

export const sessionQuerySchema = z.object({
  session_id: z.string().min(1, "Session ID is required").optional(),
  payment_intent: z.string().min(1, "Payment Intent ID is required").optional(),
})
export type SessionQuery = z.infer<typeof sessionQuerySchema>

export const walletSaveQuerySchema = z.object({
  passId: z.string().uuid("passId must be a UUID"),
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
