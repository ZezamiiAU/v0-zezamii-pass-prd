import logger from "@/lib/logger"
import { stripeMetaSchema } from "@/lib/schemas/api.schema"
import { safeValidate } from "@/lib/utils/validate-request"

const Meta = stripeMetaSchema

async function handleCheckoutComplete(session) {
  const metaResult = safeValidate(session.metadata ?? {}, Meta)
  if (!metaResult.ok) {
    logger.warn({ session: session.id, errors: metaResult.error.errors }, "Invalid session metadata")
    return
  }
  const meta = metaResult.data
}

async function handlePaymentIntentSucceeded(paymentIntent) {
  const metaResult = safeValidate(paymentIntent.metadata ?? {}, Meta)
  if (!metaResult.ok) {
    logger.warn(
      { paymentIntentId: paymentIntent.id, errors: metaResult.error.errors },
      "Invalid payment intent metadata",
    )
    return
  }
  const meta = metaResult.data
}

async function handlePaymentIntentFailed(paymentIntent) {
  const metaResult = safeValidate(paymentIntent.metadata ?? {}, Meta)
  if (!metaResult.ok) {
    logger.warn(
      { paymentIntentId: paymentIntent.id, errors: metaResult.error.errors },
      "Invalid payment intent metadata",
    )
    return
  }
  const meta = metaResult.data
}
