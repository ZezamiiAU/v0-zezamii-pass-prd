/**
 * PostgreSQL connection helper for the Rooms engine (Azure Functions)
 * to write lock codes back to the pass.lock_codes table.
 *
 * This file is NOT imported by the Next.js app - it's reference code
 * for the external Azure provisioning system.
 *
 * The Azure Functions should install 'pg' package separately and use
 * this pattern to connect directly to the Supabase Postgres database.
 */

/**
 * Example usage in Azure provisioning handler:
 *
 * Install in your Azure Function: npm install pg
 *
 * import { Pool } from 'pg'
 *
 * const pool = new Pool({
 *   connectionString: process.env.POSTGRES_URL_NON_POOLING,
 *   max: 10,
 *   idleTimeoutMillis: 30000,
 *   connectionTimeoutMillis: 10000,
 * })
 *
 * const client = await pool.connect()
 *
 * try {
 *   await client.query('BEGIN')
 *
 *   // Check if lock code already exists (idempotent)
 *   const { rows } = await client.query(
 *     'SELECT id FROM pass.lock_codes WHERE pass_id = $1',
 *     [passId]
 *   )
 *
 *   if (rows.length === 0) {
 *     // Insert lock code
 *     await client.query(
 *       'INSERT INTO pass.lock_codes (pass_id, code, valid_from, valid_until) VALUES ($1, $2, $3, $4)',
 *       [passId, lockCode, validFrom, validUntil]
 *     )
 *
 *     // Update pass status to active
 *     await client.query(
 *       'UPDATE pass.passes SET status = $1, valid_from = $2, valid_until = $3 WHERE id = $4',
 *       ['active', validFrom, validUntil, passId]
 *     )
 *   }
 *
 *   await client.query('COMMIT')
 * } catch (error) {
 *   await client.query('ROLLBACK')
 *   throw error
 * } finally {
 *   client.release()
 * }
 */

export {}
