import { type NextRequest, NextResponse } from "next/server"
import { type z, ZodError } from "zod"

import { type Result, ok, err } from "@/lib/db/result"

/**
 * Validates request search params against a Zod schema
 * Returns validated data or throws validation error
 */
export function validateSearchParams<T extends z.ZodType>(request: NextRequest, schema: T): z.infer<T> {
  const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries())
  return schema.parse(searchParams)
}

/**
 * Validates request path params against a Zod schema
 * Returns validated data or throws validation error
 *
 * ⚠️ Next.js 15: params are synchronous objects, NOT Promises
 * @example
 * export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
 *   const { id } = validateParams(params, idSchema) // params is synchronous
 * }
 */
export function validateParams<T extends z.ZodType>(params: unknown, schema: T): z.infer<T> {
  return schema.parse(params)
}

/**
 * Validates request JSON body against a Zod schema
 * Returns validated data or throws validation error
 */
export async function validateBody<T extends z.ZodType>(request: NextRequest, schema: T): Promise<z.infer<T>> {
  const body = await request.json()
  return schema.parse(body)
}

/**
 * Handles Zod validation errors and returns appropriate error response
 */
export function handleValidationError(error: unknown): NextResponse {
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

export interface ValidationError {
  code: "VALIDATION_ERROR"
  message: string
  details: Array<{ path: string; message: string }>
}

function formatZodError(error: ZodError): ValidationError {
  return {
    code: "VALIDATION_ERROR",
    message: "Validation failed",
    details: error.errors.map((e) => ({
      path: e.path.join("."),
      message: e.message,
    })),
  }
}

/**
 * Safely validates request search params against a Zod schema
 * Returns Result<T, ValidationError> instead of throwing
 */
export function safeValidateSearchParams<T extends z.ZodType>(
  request: NextRequest,
  schema: T,
): Result<z.infer<T>, ValidationError> {
  const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries())
  const result = schema.safeParse(searchParams)
  if (result.success) {
    return ok(result.data)
  }
  return err(formatZodError(result.error))
}

/**
 * Safely validates request path params against a Zod schema
 * Returns Result<T, ValidationError> instead of throwing
 */
export function safeValidateParams<T extends z.ZodType>(
  params: unknown,
  schema: T,
): Result<z.infer<T>, ValidationError> {
  const result = schema.safeParse(params)
  if (result.success) {
    return ok(result.data)
  }
  return err(formatZodError(result.error))
}

/**
 * Safely validates request JSON body against a Zod schema
 * Returns Result<T, ValidationError> instead of throwing
 */
export async function safeValidateBody<T extends z.ZodType>(
  request: NextRequest,
  schema: T,
): Promise<Result<z.infer<T>, ValidationError>> {
  try {
    const body = await request.json()
    const result = schema.safeParse(body)
    if (result.success) {
      return ok(result.data)
    }
    return err(formatZodError(result.error))
  } catch {
    return err({
      code: "VALIDATION_ERROR",
      message: "Invalid JSON body",
      details: [{ path: "body", message: "Request body is not valid JSON" }],
    })
  }
}

/**
 * Converts ValidationError to NextResponse
 */
export function validationErrorResponse(error: ValidationError): NextResponse {
  return NextResponse.json(
    {
      error: error.message,
      details: error.details,
    },
    { status: 400 },
  )
}
