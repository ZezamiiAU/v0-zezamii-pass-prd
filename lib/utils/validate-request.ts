import { type NextRequest, NextResponse } from "next/server"
import { type z, ZodError } from "zod"

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
