/**
 * Centralized Environment Variable Configuration
 *
 * Validates and exports environment variables using Zod with lazy evaluation.
 * Safe to import in all contexts - validation happens only when values are accessed.
 */

import { z } from "zod"

const ServerEnvSchema = z.object({
  STRIPE_SECRET_KEY: z.string().min(1, "Missing STRIPE_SECRET_KEY"),
  STRIPE_WEBHOOK_SECRET: z.string().min(1, "Missing STRIPE_WEBHOOK_SECRET").optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "Missing SUPABASE_SERVICE_ROLE_KEY"),
  PUBLIC_BASE_URL: z.string().url().optional(),
  APP_ORIGIN: z.string().url().optional(),
  JWT_SECRET: z.string().min(16).optional(),
  PASS_DEV_MODE: z.string().optional(),
  SUPPORT_EMAIL: z.string().email().optional(),
  ADMIN_TOKEN: z.string().min(1, "Missing ADMIN_TOKEN").optional(),
  LOCK_API_URL: z.string().url().optional(),
  LOCK_PROPERTY_ID: z.string().optional(),
  LOCK_WEBHOOK_TOKEN: z.string().optional(),
  LOCK_CALLBACK_SECRET: z.string().optional(),
})

const ClientEnvSchema = z.object({
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_ENTRY_ACCESS_POINT_ID: z.string().uuid().optional(),
  NEXT_PUBLIC_APP_ORIGIN: z.string().url().optional(),
  NEXT_PUBLIC_DEFAULT_ORG_ID: z.string().uuid().optional(),
  NEXT_PUBLIC_DEFAULT_ORG_NAME: z.string().optional(),
  NEXT_PUBLIC_DEFAULT_SITE_NAME: z.string().optional(),
  NEXT_PUBLIC_APP_TITLE: z.string().optional(),
  NEXT_PUBLIC_APP_DESCRIPTION: z.string().optional(),
  NEXT_PUBLIC_SUPPORT_EMAIL: z.string().email().optional(),
})

let serverEnvCache: z.infer<typeof ServerEnvSchema> | null = null
let clientEnvCache: z.infer<typeof ClientEnvSchema> | null = null

/**
 * Access server-side environment variables.
 * Only validates and throws when called, not at import time.
 * Safe to use in server-side code (API routes, Server Components, etc.)
 */
function getServerEnv() {
  if (serverEnvCache) return serverEnvCache

  const result = ServerEnvSchema.safeParse({
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL,
    APP_ORIGIN: process.env.APP_ORIGIN,
    JWT_SECRET: process.env.JWT_SECRET,
    PASS_DEV_MODE: process.env.PASS_DEV_MODE,
    SUPPORT_EMAIL: process.env.SUPPORT_EMAIL,
    ADMIN_TOKEN: process.env.ADMIN_TOKEN,
    LOCK_API_URL: process.env.LOCK_API_URL,
    LOCK_PROPERTY_ID: process.env.LOCK_PROPERTY_ID,
    LOCK_WEBHOOK_TOKEN: process.env.LOCK_WEBHOOK_TOKEN,
    LOCK_CALLBACK_SECRET: process.env.LOCK_CALLBACK_SECRET,
  })

  if (!result.success) {
    throw new Error(
      `Invalid server environment variables:\n${result.error.errors.map((e) => `  - ${e.path.join(".")}: ${e.message}`).join("\n")}`,
    )
  }

  serverEnvCache = result.data
  return serverEnvCache
}

/**
 * Access client-side NEXT_PUBLIC_* environment variables.
 * Returns optional values - validate locally if required.
 * Safe to use in both browser and server contexts.
 */
function getClientEnv() {
  if (clientEnvCache) return clientEnvCache

  const result = ClientEnvSchema.safeParse({
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_ENTRY_ACCESS_POINT_ID: process.env.NEXT_PUBLIC_ENTRY_ACCESS_POINT_ID,
    NEXT_PUBLIC_APP_ORIGIN: process.env.NEXT_PUBLIC_APP_ORIGIN,
    NEXT_PUBLIC_DEFAULT_ORG_ID: process.env.NEXT_PUBLIC_DEFAULT_ORG_ID,
    NEXT_PUBLIC_DEFAULT_ORG_NAME: process.env.NEXT_PUBLIC_DEFAULT_ORG_NAME,
    NEXT_PUBLIC_DEFAULT_SITE_NAME: process.env.NEXT_PUBLIC_DEFAULT_SITE_NAME,
    NEXT_PUBLIC_APP_TITLE: process.env.NEXT_PUBLIC_APP_TITLE,
    NEXT_PUBLIC_APP_DESCRIPTION: process.env.NEXT_PUBLIC_APP_DESCRIPTION,
    NEXT_PUBLIC_SUPPORT_EMAIL: process.env.NEXT_PUBLIC_SUPPORT_EMAIL,
  })

  if (!result.success) {
    // Client vars are optional on server, just return undefined values
    clientEnvCache = {
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: undefined,
      NEXT_PUBLIC_SUPABASE_URL: undefined,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined,
      NEXT_PUBLIC_ENTRY_ACCESS_POINT_ID: undefined,
      NEXT_PUBLIC_APP_ORIGIN: undefined,
      NEXT_PUBLIC_DEFAULT_ORG_ID: undefined,
      NEXT_PUBLIC_DEFAULT_ORG_NAME: undefined,
      NEXT_PUBLIC_DEFAULT_SITE_NAME: undefined,
      NEXT_PUBLIC_APP_TITLE: undefined,
      NEXT_PUBLIC_APP_DESCRIPTION: undefined,
      NEXT_PUBLIC_SUPPORT_EMAIL: undefined,
    }
    return clientEnvCache
  }

  clientEnvCache = result.data
  return clientEnvCache
}

export const ENV = {
  server: getServerEnv,
  client: getClientEnv,
  get PUBLIC_BASE_URL() {
    return getServerEnv().PUBLIC_BASE_URL
  },
  get APP_ORIGIN() {
    return getServerEnv().APP_ORIGIN
  },
  get PASS_DEV_MODE() {
    return getServerEnv().PASS_DEV_MODE
  },
  get NEXT_PUBLIC_APP_ORIGIN() {
    return getClientEnv().NEXT_PUBLIC_APP_ORIGIN
  },
  get NEXT_PUBLIC_DEFAULT_ORG_ID() {
    return getClientEnv().NEXT_PUBLIC_DEFAULT_ORG_ID
  },
  get ADMIN_TOKEN() {
    return getServerEnv().ADMIN_TOKEN
  },
  get LOCK_API_URL() {
    return getServerEnv().LOCK_API_URL
  },
  get LOCK_PROPERTY_ID() {
    return getServerEnv().LOCK_PROPERTY_ID
  },
  get LOCK_WEBHOOK_TOKEN() {
    return getServerEnv().LOCK_WEBHOOK_TOKEN
  },
  get LOCK_CALLBACK_SECRET() {
    return getServerEnv().LOCK_CALLBACK_SECRET
  },
}

// Type exports for convenience
export type ServerEnv = z.infer<typeof ServerEnvSchema>
export type ClientEnv = z.infer<typeof ClientEnvSchema>
