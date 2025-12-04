import { NextResponse } from "next/server"
import { ZodError } from "zod"

/**
 * Validates request search params against a Zod schema
 * Returns validated data or throws validation error
 * @param {import('next/server').NextRequest} request
 * @param {import('zod').ZodType} schema
 * @returns {any}
 */
export function validateSearchParams(request, schema) {
  const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries())
  return schema.parse(searchParams)
}

/**
 * Validates request path params against a Zod schema
 * Returns validated data or throws validation error
 * @param {unknown} params
 * @param {import('zod').ZodType} schema
 * @returns {any}
 */
export function validateParams(params, schema) {
  return schema.parse(params)
}

/**
 * Validates request JSON body against a Zod schema
 * Returns validated data or throws validation error
 * @param {import('next/server').NextRequest} request
 * @param {import('zod').ZodType} schema
 * @returns {Promise<any>}
 */
export async function validateBody(request, schema) {
  const body = await request.json()
  return schema.parse(body)
}

/**
 * Handles Zod validation errors and returns appropriate error response
 * @param {unknown} error
 * @returns {NextResponse}
 */
export function handleValidationError(error) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Validation failed",
        details: error.errors.map((err) => ({
          path: err.path.join("."),
          message: err.message,
        })),
      },
      { status: 400 },
    )
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 })
}

// ============================================================================
// ============================================================================

/**
 * @template T
 * @typedef {{ ok: true, data: T } | { ok: false, response: NextResponse }} ValidationResult
 */

/**
 * Formats Zod errors into a consistent structure
 * @param {ZodError} error
 * @returns {{ path: string, message: string }[]}
 */
function formatZodErrors(error) {
  return error.errors.map((err) => ({
    path: err.path.join("."),
    message: err.message,
  }))
}

/**
 * Safely validates request JSON body against a Zod schema.
 * Returns { ok: true, data } on success or { ok: false, response } with a 400 NextResponse.
 *
 * @template T
 * @param {import('next/server').NextRequest} request
 * @param {import('zod').ZodType<T>} schema
 * @param {Record<string, string>} [headers] - Optional headers to include in error response
 * @returns {Promise<ValidationResult<T>>}
 *
 * @example
 * const result = await safeValidateBody(request, checkoutSchema, corsHeaders)
 * if (!result.ok) return result.response
 * const { accessPointId, email } = result.data
 */
export async function safeValidateBody(request, schema, headers = {}) {
  try {
    const body = await request.json()
    const validation = schema.safeParse(body)

    if (!validation.success) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Validation failed", details: formatZodErrors(validation.error) },
          { status: 400, headers },
        ),
      }
    }

    return { ok: true, data: validation.data }
  } catch (err) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers }),
    }
  }
}

/**
 * Safely validates URL search params against a Zod schema.
 * Returns { ok: true, data } on success or { ok: false, response } with a 400 NextResponse.
 *
 * @template T
 * @param {import('next/server').NextRequest} request
 * @param {import('zod').ZodType<T>} schema
 * @param {Record<string, string>} [headers] - Optional headers to include in error response
 * @returns {ValidationResult<T>}
 *
 * @example
 * const result = safeValidateQuery(request, sessionQuerySchema)
 * if (!result.ok) return result.response
 * const { session_id } = result.data
 */
export function safeValidateQuery(request, schema, headers = {}) {
  const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries())
  const validation = schema.safeParse(searchParams)

  if (!validation.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Invalid query parameters", details: formatZodErrors(validation.error) },
        { status: 400, headers },
      ),
    }
  }

  return { ok: true, data: validation.data }
}

/**
 * Safely validates route params against a Zod schema.
 * Returns { ok: true, data } on success or { ok: false, response } with a 400 NextResponse.
 *
 * @template T
 * @param {unknown} params
 * @param {import('zod').ZodType<T>} schema
 * @param {Record<string, string>} [headers] - Optional headers to include in error response
 * @returns {ValidationResult<T>}
 *
 * @example
 * const result = safeValidateParams(context.params, passIdParamSchema)
 * if (!result.ok) return result.response
 * const { passId } = result.data
 */
export function safeValidateParams(params, schema, headers = {}) {
  const validation = schema.safeParse(params)

  if (!validation.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Invalid route parameters", details: formatZodErrors(validation.error) },
        { status: 400, headers },
      ),
    }
  }

  return { ok: true, data: validation.data }
}

/**
 * Safely validates any data against a Zod schema.
 * Returns { ok: true, data } on success or { ok: false, error } with ZodError.
 * Use this when you don't want a NextResponse (e.g., for internal validation).
 *
 * @template T
 * @param {unknown} data
 * @param {import('zod').ZodType<T>} schema
 * @returns {{ ok: true, data: T } | { ok: false, error: ZodError }}
 *
 * @example
 * const result = safeValidate(metadata, stripeMetaSchema)
 * if (!result.ok) { logger.warn({ errors: result.error.errors }, "Invalid metadata") }
 */
export function safeValidate(data, schema) {
  const validation = schema.safeParse(data)

  if (!validation.success) {
    return { ok: false, error: validation.error }
  }

  return { ok: true, data: validation.data }
}
