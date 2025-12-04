/**
 * Supabase Client Exports
 *
 * Re-exports all Supabase utilities for convenient importing
 */

// Client-side Supabase client
export { createClient } from "./client"

// Server-side Supabase clients
export {
  createClient as createServerClient,
  createServiceClient,
  createCoreServiceClient,
  createSchemaServiceClient,
} from "./server"

// Database types (for JSDoc annotations)
// Usage: @typedef {import('@/lib/supabase').Tables} Tables
