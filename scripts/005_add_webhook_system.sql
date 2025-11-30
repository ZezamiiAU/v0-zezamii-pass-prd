-- Webhook subscription and delivery system
-- Allows external services to subscribe to events via HTTP POST

CREATE TABLE IF NOT EXISTS events.webhook_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES core.organisations(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  secret TEXT NOT NULL, -- HMAC secret for signature verification
  events TEXT[] NOT NULL DEFAULT ARRAY['pass.pass_paid.v1'], -- Event topics to subscribe to
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'disabled')),
  description TEXT, -- Optional description of the webhook
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_delivery_at TIMESTAMPTZ, -- Last successful delivery
  UNIQUE(organisation_id, url)
);

CREATE INDEX idx_webhook_subscriptions_org ON events.webhook_subscriptions(organisation_id);
CREATE INDEX idx_webhook_subscriptions_status ON events.webhook_subscriptions(status);

-- Track webhook delivery attempts
CREATE TABLE IF NOT EXISTS events.webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES events.webhook_subscriptions(id) ON DELETE CASCADE,
  outbox_id UUID NOT NULL REFERENCES events.outbox(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL CHECK (status IN ('pending', 'success', 'failed', 'retrying')),
  http_status_code INTEGER,
  response_body TEXT,
  error_message TEXT,
  delivered_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webhook_deliveries_subscription ON events.webhook_deliveries(subscription_id);
CREATE INDEX idx_webhook_deliveries_outbox ON events.webhook_deliveries(outbox_id);
CREATE INDEX idx_webhook_deliveries_status ON events.webhook_deliveries(status);
CREATE INDEX idx_webhook_deliveries_next_retry ON events.webhook_deliveries(next_retry_at) WHERE status = 'retrying';

-- Grant permissions for webhook management
GRANT SELECT, INSERT, UPDATE, DELETE ON events.webhook_subscriptions TO authenticated;
GRANT SELECT ON events.webhook_deliveries TO authenticated;

COMMENT ON TABLE events.webhook_subscriptions IS 'HTTP webhook subscriptions for external services';
COMMENT ON TABLE events.webhook_deliveries IS 'Tracks webhook delivery attempts and status';
