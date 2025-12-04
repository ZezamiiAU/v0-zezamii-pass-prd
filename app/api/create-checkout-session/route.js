import { NextResponse } from "next/server"
import Stripe from "stripe"
import { rateLimit, getRateLimitHeaders } from "@/lib/rate-limit"
import { checkoutSchema } from "@/lib/schemas/api.schema"
import { safeValidateBody } from "@/lib/utils/validate-request"
import logger from "@/lib/logger"
import { ENV } from "@/lib/env"
import { getAllowedOrigin } from "@/lib/utils/get-allowed-origin"

export async function POST(request) {
  try {
    if (!rateLimit(request, 10, 60000)) {
      const headers = getRateLimitHeaders(request, 10)
      logger.warn({ ip: request.headers.get("x-forwarded-for") }, "Rate limit exceeded")
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429, headers })
    }

    const allowedOrigin = getAllowedOrigin(request)
    const corsHeaders = {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Methods": "POST",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Credentials": "true",
    }

    const serverEnv = ENV.server()
    if (!serverEnv.STRIPE_SECRET_KEY) {
      logger.error("STRIPE_SECRET_KEY is missing")
      return NextResponse.json({ error: "Payment system not configured" }, { status: 500, headers: corsHeaders })
    }

    const stripe = new Stripe(serverEnv.STRIPE_SECRET_KEY)

    const validation = await safeValidateBody(request, checkoutSchema, corsHeaders)
    if (!validation.ok) return validation.response

    const { accessPointId, passTypeId, email, plate, phone, baseUrl: clientBaseUrl } = validation.data

    // Add code to create a checkout session here
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Pass Type",
            },
            unit_amount: 1000, // Amount in cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${clientBaseUrl}/success`,
      cancel_url: `${clientBaseUrl}/cancel`,
    })

    return NextResponse.json({ id: session.id }, { status: 200, headers: corsHeaders })
  } catch (error) {
    logger.error({ error }, "Failed to create checkout session")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
