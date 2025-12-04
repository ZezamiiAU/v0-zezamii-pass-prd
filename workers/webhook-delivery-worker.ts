import { createServiceClient } from "@/lib/supabase/server"
import { deliverWebhook, calculateNextRetry, shouldRetry } from "@/lib/webhooks/delivery"
import logger from "@/lib/logger"

/**
 * Webhook delivery worker
 * Polls events.outbox for pending events and delivers to HTTP subscribers
 * Run this as a cron job every 1-5 minutes
 */
export async function processWebhookDeliveries() {
  const supabase = createServiceClient()

  // Fetch pending events from outbox
  const { data: events, error: eventsError } = await supabase
    .from("outbox")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(50)

  if (eventsError) {
    logger.error({ error: eventsError.message }, "[WebhookWorker] Error fetching events")
    return
  }

  if (!events || events.length === 0) {
    return
  }

  // Fetch active webhook subscriptions
  const { data: subscriptions, error: subsError } = await supabase
    .from("webhook_subscriptions")
    .select("*")
    .eq("status", "active")

  if (subsError) {
    logger.error({ error: subsError.message }, "[WebhookWorker] Error fetching subscriptions")
    return
  }

  if (!subscriptions || subscriptions.length === 0) {
    return
  }

  // Process each event
  for (const event of events) {
    // Find subscriptions that match this event topic
    const matchingSubscriptions = subscriptions.filter((sub) => sub.events.includes(event.topic))

    if (matchingSubscriptions.length === 0) {
      continue
    }

    // Deliver to each matching subscription
    for (const subscription of matchingSubscriptions) {
      await deliverToSubscription(supabase, event, subscription)
    }
  }

  // Process retries
  await processRetries(supabase)
}

async function deliverToSubscription(supabase: any, event: any, subscription: any) {
  try {
    // Check if already delivered
    const { data: existing } = await supabase
      .from("webhook_deliveries")
      .select("id")
      .eq("subscription_id", subscription.id)
      .eq("outbox_id", event.id)
      .eq("status", "success")
      .single()

    if (existing) {
      return
    }

    // Prepare webhook payload
    const webhookPayload = {
      topic: event.topic,
      data: event.payload,
      event_id: event.id,
      created_at: event.created_at,
    }

    // Attempt delivery
    const result = await deliverWebhook(subscription.url, subscription.secret, webhookPayload, 1)

    // Record delivery attempt
    const deliveryRecord = {
      subscription_id: subscription.id,
      outbox_id: event.id,
      attempt_number: 1,
      status: result.success ? "success" : shouldRetry(1, result.statusCode) ? "retrying" : "failed",
      http_status_code: result.statusCode,
      response_body: result.responseBody,
      error_message: result.error,
      delivered_at: result.success ? new Date().toISOString() : null,
      next_retry_at: result.success
        ? null
        : shouldRetry(1, result.statusCode)
          ? calculateNextRetry(1).toISOString()
          : null,
    }

    await supabase.from("webhook_deliveries").insert(deliveryRecord)

    if (result.success) {
      // Update subscription last_delivery_at
      await supabase
        .from("webhook_subscriptions")
        .update({ last_delivery_at: new Date().toISOString() })
        .eq("id", subscription.id)
    }
  } catch (error) {
    logger.error(
      { url: subscription.url, error: error instanceof Error ? error.message : error },
      "[WebhookWorker] Delivery error",
    )
  }
}

async function processRetries(supabase: any) {
  // Fetch deliveries that need retry
  const { data: retries, error } = await supabase
    .from("webhook_deliveries")
    .select("*, webhook_subscriptions(*)")
    .eq("status", "retrying")
    .lte("next_retry_at", new Date().toISOString())
    .limit(20)

  if (error || !retries || retries.length === 0) {
    return
  }

  for (const delivery of retries) {
    const subscription = delivery.webhook_subscriptions

    // Fetch the original event
    const { data: event } = await supabase.from("outbox").select("*").eq("id", delivery.outbox_id).single()

    if (!event) continue

    const webhookPayload = {
      topic: event.topic,
      data: event.payload,
      event_id: event.id,
      created_at: event.created_at,
    }

    const attemptNumber = delivery.attempt_number + 1
    const result = await deliverWebhook(subscription.url, subscription.secret, webhookPayload, attemptNumber)

    // Update delivery record
    const updates: any = {
      attempt_number: attemptNumber,
      http_status_code: result.statusCode,
      response_body: result.responseBody,
      error_message: result.error,
    }

    if (result.success) {
      updates.status = "success"
      updates.delivered_at = new Date().toISOString()
      updates.next_retry_at = null
    } else if (shouldRetry(attemptNumber, result.statusCode)) {
      updates.status = "retrying"
      updates.next_retry_at = calculateNextRetry(attemptNumber).toISOString()
    } else {
      updates.status = "failed"
      updates.next_retry_at = null
    }

    await supabase.from("webhook_deliveries").update(updates).eq("id", delivery.id)

    if (result.success) {
      await supabase
        .from("webhook_subscriptions")
        .update({ last_delivery_at: new Date().toISOString() })
        .eq("id", subscription.id)
    }
  }
}

// Export for cron job
export default processWebhookDeliveries
