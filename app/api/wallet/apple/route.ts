import { type NextRequest, NextResponse } from "next/server"
import { getPassByCheckoutSession, getPassByPaymentIntent } from "@/lib/db/payments"
import { getLockCodeByPassId } from "@/lib/db/lock-codes"
import logger from "@/lib/logger"
import { rateLimit, getRateLimitHeaders } from "@/lib/rate-limit"

export async function GET(request: NextRequest) {
  if (!rateLimit(request, 20, 60000)) {
    const headers = getRateLimitHeaders(request, 20)
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429, headers })
  }

  const searchParams = request.nextUrl.searchParams
  const sessionId = searchParams.get("session_id")
  const intentId = searchParams.get("payment_intent")

  if (!sessionId && !intentId) {
    return NextResponse.json({ error: "Missing session_id or payment_intent" }, { status: 400 })
  }

  try {
    let result
    if (sessionId) {
      result = await getPassByCheckoutSession(sessionId)
    } else if (intentId) {
      result = await getPassByPaymentIntent(intentId)
    }

    if (!result) {
      logger.error({ sessionId, intentId }, "Pass not found for Apple Wallet")
      return NextResponse.json({ error: "Pass not found" }, { status: 404 })
    }

    const payment = result
    const pass = payment.pass

    if (!pass) {
      return NextResponse.json({ error: "Pass data not found" }, { status: 404 })
    }

    // Get lock code
    const lockCodeData = await getLockCodeByPassId(pass.id)
    const lockCode = lockCodeData?.code || ""

    return NextResponse.json(
      {
        error: "Apple Wallet temporarily unavailable",
        message: "This feature is currently disabled. Please use Google Wallet instead.",
        lockCode: lockCode,
      },
      { status: 503 },
    )
  } catch (error) {
    logger.error({ error, sessionId, intentId }, "Apple Wallet pass generation error")
    return NextResponse.json({ error: "Failed to generate Apple Wallet pass" }, { status: 500 })
  }
}
