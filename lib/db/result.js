/**
 * @template T
 * @typedef {Object} Success
 * @property {true} success
 * @property {T} data
 * @property {null} error
 */

/**
 * @template T
 * @typedef {Object} Failure
 * @property {false} success
 * @property {null} data
 * @property {DbError} error
 */

/**
 * @template T
 * @typedef {Success<T> | Failure<T>} Result
 */

/**
 * @typedef {Object} DbError
 * @property {string} code - Error code (e.g., 'NOT_FOUND', 'CONSTRAINT_VIOLATION', 'NETWORK_ERROR')
 * @property {string} message - Human-readable error message
 * @property {string} [details] - Additional error details
 * @property {string} [hint] - Suggestion for fixing the error
 */

/**
 * Creates a successful result
 * @template T
 * @param {T} data - The success data
 * @returns {Success<T>}
 */
export function ok(data) {
  return { success: true, data, error: null }
}

/**
 * Creates a failure result
 * @template T
 * @param {string} code - Error code
 * @param {string} message - Error message
 * @param {Object} [options] - Optional error details
 * @param {string} [options.details] - Additional details
 * @param {string} [options.hint] - Suggestion for fixing
 * @returns {Failure<T>}
 */
export function err(code, message, options = {}) {
  return {
    success: false,
    data: null,
    error: {
      code,
      message,
      details: options.details,
      hint: options.hint,
    },
  }
}

/**
 * Maps a Supabase error to a standardized DbError
 * @param {Object} supabaseError - The Supabase error object
 * @returns {Failure<any>}
 */
export function fromSupabaseError(supabaseError) {
  if (!supabaseError) {
    return err("UNKNOWN", "An unknown error occurred")
  }

  const { code, message, details, hint } = supabaseError

  // Map common Supabase/Postgres error codes to our codes
  const codeMap = {
    PGRST116: "NOT_FOUND",
    23505: "DUPLICATE_KEY",
    23503: "FOREIGN_KEY_VIOLATION",
    23502: "NOT_NULL_VIOLATION",
    "22P02": "INVALID_INPUT",
    42501: "PERMISSION_DENIED",
    "42P01": "TABLE_NOT_FOUND",
    57014: "QUERY_CANCELLED",
    40001: "SERIALIZATION_FAILURE",
  }

  const mappedCode = codeMap[code] || code || "DB_ERROR"

  return err(mappedCode, message, { details, hint })
}

/**
 * Checks if a result is successful
 * @template T
 * @param {Result<T>} result
 * @returns {result is Success<T>}
 */
export function isOk(result) {
  return result.success === true
}

/**
 * Checks if a result is a failure
 * @template T
 * @param {Result<T>} result
 * @returns {result is Failure<T>}
 */
export function isErr(result) {
  return result.success === false
}

/**
 * Unwraps a result, throwing if it's an error
 * @template T
 * @param {Result<T>} result
 * @returns {T}
 * @throws {Error} If the result is a failure
 */
export function unwrap(result) {
  if (isErr(result)) {
    throw new Error(`${result.error.code}: ${result.error.message}`)
  }
  return result.data
}

/**
 * Unwraps a result with a default value
 * @template T
 * @param {Result<T>} result
 * @param {T} defaultValue
 * @returns {T}
 */
export function unwrapOr(result, defaultValue) {
  if (isErr(result)) {
    return defaultValue
  }
  return result.data
}
