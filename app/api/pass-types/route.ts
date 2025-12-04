import { type NextRequest, NextResponse } from "next/server"
import { getActivePassTypes } from "@/lib/db/pass-types"
import { rateLimit, getRateLimitHeaders } from "@/lib/rate-limit"
import logger from "@/lib/logger"

export async function GET(request: NextRequest) {
  if (!rateLimit(request, 60, 60000)) {
    const headers = getRateLimitHeaders(request, 60)
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429, headers })
  }

  try {
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get("orgId") || undefined

    const passTypes = await getActivePassTypes(orgId)
    return NextResponse.json(passTypes)
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : error }, "[PassTypes] Failed to fetch pass types")
    return NextResponse.json({ error: "Failed to fetch pass types" }, { status: 500 })
  }
}
