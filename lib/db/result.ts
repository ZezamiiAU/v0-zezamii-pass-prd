/**
 * Result type for better error handling
 * Wraps function returns with success/failure states
 */

export type Result<T, E = Error> = { success: true; data: T } | { success: false; error: E }

export function ok<T>(data: T): Result<T, never> {
  return { success: true, data }
}

export function err<E = Error>(error: E): Result<never, E> {
  return { success: false, error }
}

/**
 * Wrap an async function that might throw into a Result
 */
export async function tryCatch<T>(fn: () => Promise<T>): Promise<Result<T, Error>> {
  try {
    const data = await fn()
    return ok(data)
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)))
  }
}

/**
 * Wrap a nullable return into a Result with a custom error message
 */
export function fromNullable<T>(value: T | null | undefined, errorMessage: string): Result<T, Error> {
  if (value === null || value === undefined) {
    return err(new Error(errorMessage))
  }
  return ok(value)
}
