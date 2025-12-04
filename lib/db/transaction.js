import { createSchemaServiceClient } from "@/lib/supabase/server"
import logger from "@/lib/logger"
import { ok, err } from "./result"

/**
 * @typedef {Object} TransactionStep
 * @property {string} name - Step name for logging
 * @property {Function} execute - The operation to execute
 * @property {Function} [rollback] - Optional rollback function if step fails
 */

/**
 * Executes multiple database operations as a logical transaction.
 *
 * Since Supabase doesn't support client-side transactions directly,
 * this utility provides:
 * 1. Sequential execution with automatic rollback on failure
 * 2. Structured logging for each step
 * 3. Consistent error handling
 *
 * For true ACID transactions, use a Postgres function/procedure.
 *
 * @template T
 * @param {Object} options
 * @param {string} options.name - Transaction name for logging
 * @param {TransactionStep[]} options.steps - Steps to execute
 * @param {Object} [options.context] - Additional context for logging
 * @returns {Promise<import('./result').Result<T>>}
 *
 * @example
 * const result = await withTransaction({
 *   name: 'activate_pass',
 *   steps: [
 *     {
 *       name: 'update_pass_status',
 *       execute: async () => updatePassStatus(passId, 'active'),
 *       rollback: async () => updatePassStatus(passId, 'pending'),
 *     },
 *     {
 *       name: 'create_payment',
 *       execute: async () => createPayment({ passId, amount }),
 *       rollback: async (paymentId) => deletePayment(paymentId),
 *     },
 *   ],
 * })
 */
export async function withTransaction(options) {
  const { name, steps, context = {} } = options
  const completedSteps = []
  const stepResults = []

  logger.info({ transaction: name, stepCount: steps.length, ...context }, "[Transaction] Starting")

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    const stepNumber = i + 1

    try {
      logger.debug(
        { transaction: name, step: step.name, stepNumber, totalSteps: steps.length },
        "[Transaction] Executing step",
      )

      const result = await step.execute(stepResults)

      // Track completed step for potential rollback
      completedSteps.push({ step, result })
      stepResults.push(result)

      logger.debug({ transaction: name, step: step.name, stepNumber }, "[Transaction] Step completed")
    } catch (error) {
      logger.error(
        {
          transaction: name,
          step: step.name,
          stepNumber,
          error: error instanceof Error ? error.message : String(error),
          ...context,
        },
        "[Transaction] Step failed, initiating rollback",
      )

      // Rollback completed steps in reverse order
      await rollbackSteps(name, completedSteps)

      return err(
        "TRANSACTION_FAILED",
        `Transaction '${name}' failed at step '${step.name}': ${error instanceof Error ? error.message : String(error)}`,
        { details: `Failed at step ${stepNumber} of ${steps.length}` },
      )
    }
  }

  logger.info({ transaction: name, stepsCompleted: steps.length, ...context }, "[Transaction] Completed successfully")

  // Return the last step's result as the transaction result
  return ok(stepResults[stepResults.length - 1])
}

/**
 * Rolls back completed steps in reverse order
 * @param {string} transactionName
 * @param {Array<{step: TransactionStep, result: any}>} completedSteps
 */
async function rollbackSteps(transactionName, completedSteps) {
  for (let i = completedSteps.length - 1; i >= 0; i--) {
    const { step, result } = completedSteps[i]

    if (!step.rollback) {
      logger.warn(
        { transaction: transactionName, step: step.name },
        "[Transaction] No rollback function defined for step",
      )
      continue
    }

    try {
      logger.debug({ transaction: transactionName, step: step.name }, "[Transaction] Rolling back step")

      await step.rollback(result)

      logger.debug({ transaction: transactionName, step: step.name }, "[Transaction] Step rolled back successfully")
    } catch (rollbackError) {
      // Log but don't throw - continue rolling back other steps
      logger.error(
        {
          transaction: transactionName,
          step: step.name,
          error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
        },
        "[Transaction] Rollback failed for step",
      )
    }
  }
}

/**
 * Executes a raw SQL transaction using Postgres RPC.
 * This provides true ACID guarantees.
 *
 * Requires a Postgres function that handles the transaction.
 *
 * @param {string} functionName - Name of the Postgres function
 * @param {Object} params - Parameters to pass to the function
 * @param {string} [schema='pass'] - Schema where the function is defined
 * @returns {Promise<import('./result').Result<any>>}
 */
export async function withRpcTransaction(functionName, params, schema = "pass") {
  const supabase = createSchemaServiceClient(schema)

  try {
    logger.debug({ function: functionName, schema }, "[Transaction] Calling RPC function")

    const { data, error } = await supabase.rpc(functionName, params)

    if (error) {
      logger.error({ function: functionName, error: error.message }, "[Transaction] RPC function failed")
      return err(error.code || "RPC_ERROR", error.message, {
        details: error.details,
        hint: error.hint,
      })
    }

    logger.debug({ function: functionName }, "[Transaction] RPC function completed")
    return ok(data)
  } catch (error) {
    logger.error(
      { function: functionName, error: error instanceof Error ? error.message : String(error) },
      "[Transaction] RPC call failed",
    )
    return err("RPC_ERROR", error instanceof Error ? error.message : "RPC call failed")
  }
}
