-- Create email_failures table for dead-letter logging
CREATE TABLE IF NOT EXISTS analytics.email_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient text NOT NULL,
  subject text NOT NULL,
  template_name text,
  error_message text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  payload_summary jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for querying recent failures
CREATE INDEX IF NOT EXISTS idx_email_failures_created_at ON analytics.email_failures (created_at DESC);

-- Index for querying by recipient
CREATE INDEX IF NOT EXISTS idx_email_failures_recipient ON analytics.email_failures (recipient);
