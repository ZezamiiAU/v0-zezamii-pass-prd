/**
 * @deprecated Use imports from '@/lib/schemas/api.schema' instead.
 * This file is kept for backwards compatibility during migration.
 *
 * All schemas have been moved to lib/schemas/api.schema.js
 */

// Re-export from centralized location for backwards compatibility
export { checkoutSchema, stripeMetaSchema } from "@/lib/schemas/api.schema"

/**
 * @typedef {import('@/lib/schemas/api.schema').CheckoutInput} CheckoutInput
 */
