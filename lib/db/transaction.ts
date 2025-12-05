/**
 * Transaction support for Supabase operations
 * Uses Postgres advisory locks for coordination
 */

import { createServiceClient } from "@/lib/supabase/server"

export type TransactionContext = {
  client: ReturnType<typeof createServiceClient>
}

/**
 * Execute multiple operations in a transaction-like context
 * Uses advisory locks for coordination
 *
 * Note: Supabase JS client doesn't support true transactions,
 * so this provides coordination via advisory locks
 */
export async function withTransaction<T>(lockKey: number, fn: (ctx: TransactionContext) => Promise<T>): Promise<T> {
  const client = createServiceClient()

  // Acquire advisory lock
  const { error: lockError } = await client.rpc("pg_advisory_lock", { key: lockKey })
  if (lockError) {
    throw new Error(`Failed to acquire lock: ${lockError.message}`)
  }

  try {
    const result = await fn({ client })
    return result
  } finally {
    // Release advisory lock
    await client.rpc("pg_advisory_unlock", { key: lockKey })
  }
}

/**
 * Generate a consistent lock key from a string identifier
 */
export function getLockKey(identifier: string): number {
  let hash = 0
  for (let i = 0; i < identifier.length; i++) {
    const char = identifier.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash)
}
