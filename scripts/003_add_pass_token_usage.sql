-- Create table to track token usage for replay protection
CREATE TABLE IF NOT EXISTS pass.pass_token_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pass_id UUID NOT NULL REFERENCES pass.passes(id) ON DELETE CASCADE,
  token_id TEXT NOT NULL UNIQUE,
  gate_id UUID,
  action TEXT NOT NULL CHECK (action IN ('entry', 'exit')),
  verified_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookup by token_id (replay check)
CREATE INDEX IF NOT EXISTS idx_pass_token_usage_token_id ON pass.pass_token_usage(token_id);

-- Index for pass history queries
CREATE INDEX IF NOT EXISTS idx_pass_token_usage_pass_id ON pass.pass_token_usage(pass_id);

-- Index for cleanup queries (remove old tokens after 24 hours)
CREATE INDEX IF NOT EXISTS idx_pass_token_usage_created_at ON pass.pass_token_usage(created_at);

COMMENT ON TABLE pass.pass_token_usage IS 'Tracks JWS token usage to prevent replay attacks';
COMMENT ON COLUMN pass.pass_token_usage.token_id IS 'Unique token ID (jti claim) from JWS';
COMMENT ON COLUMN pass.pass_token_usage.action IS 'Entry or exit verification';
