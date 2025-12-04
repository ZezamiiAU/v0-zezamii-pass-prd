/**
 * TypeScript Export Surface Guardrail
 *
 * This file ensures all expected exports from api.schema.ts exist.
 * If any export is removed or renamed, TypeScript compilation will fail.
 *
 * DO NOT delete this file. It serves as a contract for API route schemas.
 */

import type { z } from "zod"

// Import all schema exports
import {
  accessPointIdParamSchema,
  passIdParamSchema,
  subscriptionIdParamSchema,
  accessPointVerifyBodySchema,
  syncPaymentBodySchema,
  webhookSubscriptionBodySchema,
  webhookSubscriptionUpdateSchema,
  sessionQuerySchema,
  walletSaveQuerySchema,
  unlockJwtQuerySchema,
} from "./api.schema"

// Import all type exports
import type {
  AccessPointIdParam,
  PassIdParam,
  SubscriptionIdParam,
  AccessPointVerifyBody,
  SyncPaymentBody,
  WebhookSubscriptionBody,
  WebhookSubscriptionUpdate,
  SessionQuery,
  WalletSaveQuery,
  UnlockJwtQuery,
} from "./api.schema"

// Verify all schemas are Zod schemas
const _schemaGuards: z.ZodTypeAny[] = [
  accessPointIdParamSchema,
  passIdParamSchema,
  subscriptionIdParamSchema,
  accessPointVerifyBodySchema,
  syncPaymentBodySchema,
  webhookSubscriptionBodySchema,
  webhookSubscriptionUpdateSchema,
  sessionQuerySchema,
  walletSaveQuerySchema,
  unlockJwtQuerySchema,
]

// Verify all types are assignable (compile-time check)
const _typeGuards = {
  accessPointIdParam: {} as AccessPointIdParam,
  passIdParam: {} as PassIdParam,
  subscriptionIdParam: {} as SubscriptionIdParam,
  accessPointVerifyBody: {} as AccessPointVerifyBody,
  syncPaymentBody: {} as SyncPaymentBody,
  webhookSubscriptionBody: {} as WebhookSubscriptionBody,
  webhookSubscriptionUpdate: {} as WebhookSubscriptionUpdate,
  sessionQuery: {} as SessionQuery,
  walletSaveQuery: {} as WalletSaveQuery,
  unlockJwtQuery: {} as UnlockJwtQuery,
}

// Export a marker so this module is not empty
export const API_SCHEMA_EXPORTS_VERIFIED = true as const
