import { z } from "zod"

const ClientEnvSchema = z.object({
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1).default("pk_test_preview"),
  NEXT_PUBLIC_ENTRY_ACCESS_POINT_ID: z.string().uuid().optional(),
})

const ServerEnvSchema = z.object({
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  PUBLIC_BASE_URL: z.string().url().optional(),
  APP_ORIGIN: z.string().url().optional(),
  JWT_SECRET: z.string().min(16).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().email().optional(),
  EMAIL_REPLY_TO: z.string().email().optional(),
})

// Client-safe environment variables (always available)
const clientEnv = ClientEnvSchema.parse({
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_ENTRY_ACCESS_POINT_ID: process.env.NEXT_PUBLIC_ENTRY_ACCESS_POINT_ID,
})

// Server-only environment variables (only validated on server)
const serverEnv =
  typeof window === "undefined"
    ? ServerEnvSchema.parse({
        STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
        PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL,
        APP_ORIGIN: process.env.APP_ORIGIN,
        JWT_SECRET: process.env.JWT_SECRET,
        RESEND_API_KEY: process.env.RESEND_API_KEY,
        EMAIL_FROM: process.env.EMAIL_FROM,
        EMAIL_REPLY_TO: process.env.EMAIL_REPLY_TO,
      })
    : ({} as z.infer<typeof ServerEnvSchema>)

export const ENV = {
  ...clientEnv,
  ...serverEnv,
}
