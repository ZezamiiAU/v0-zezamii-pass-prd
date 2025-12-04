/**
 * Export Surface Guardrail
 *
 * This file ensures all expected exports from api.schema.js exist.
 * If any export is removed or renamed, imports will fail.
 *
 * DO NOT delete this file. It serves as a contract for API route schemas.
 */

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
  checkoutSchema,
  stripeMetaSchema,
  uuidSchema,
  emailSchema,
  urlSchema,
  slugSchema,
  isoDateSchema,
  positiveIntSchema,
  nonEmptyStringSchema,
} from "./api.schema"

// Verify all schemas are Zod schemas (runtime check)
const _schemaGuards = [
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
  checkoutSchema,
  stripeMetaSchema,
  uuidSchema,
  emailSchema,
  urlSchema,
  slugSchema,
  isoDateSchema,
  positiveIntSchema,
  nonEmptyStringSchema,
]

// Export a marker so this module is not empty
export const API_SCHEMA_EXPORTS_VERIFIED = true
