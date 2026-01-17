-- Create table to track processed webhook events and prevent duplicate processing
CREATE TABLE IF NOT EXISTS pass.processed_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookup by event_id
CREATE INDEX IF NOT EXISTS idx_processed_webhooks_event_id ON pass.processed_webhooks(event_id);

-- Index for cleanup queries (remove old events after 30 days)
CREATE INDEX IF NOT EXISTS idx_processed_webhooks_created_at ON pass.processed_webhooks(created_at);

COMMENT ON TABLE pass.processed_webhooks IS 'Tracks processed Stripe webhook events to prevent duplicate processing';
COMMENT ON COLUMN pass.processed_webhooks.event_id IS 'Stripe event ID (evt_xxx)';
COMMENT ON COLUMN pass.processed_webhooks.event_type IS 'Stripe event type (e.g., payment_intent.succeeded)';
