-- Add status tracking columns to processed_webhooks for proper idempotency
-- This allows webhooks to be retried if they fail mid-processing

-- Add status column with default for existing rows
ALTER TABLE pass.processed_webhooks
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'completed';

-- Add completed_at column
ALTER TABLE pass.processed_webhooks
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Add error_message column for debugging failed webhooks
ALTER TABLE pass.processed_webhooks
ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Update existing rows to have completed_at = processed_at
UPDATE pass.processed_webhooks
SET completed_at = processed_at
WHERE completed_at IS NULL;

-- Add index for status queries (find failed/processing webhooks)
CREATE INDEX IF NOT EXISTS idx_processed_webhooks_status
ON pass.processed_webhooks(status)
WHERE status != 'completed';

-- Add check constraint for valid statuses
ALTER TABLE pass.processed_webhooks
DROP CONSTRAINT IF EXISTS processed_webhooks_status_check;

ALTER TABLE pass.processed_webhooks
ADD CONSTRAINT processed_webhooks_status_check
CHECK (status IN ('processing', 'completed', 'failed'));

COMMENT ON COLUMN pass.processed_webhooks.status IS 'processing = in progress, completed = success, failed = error (can retry)';
COMMENT ON COLUMN pass.processed_webhooks.completed_at IS 'When processing finished (success or failure)';
COMMENT ON COLUMN pass.processed_webhooks.error_message IS 'Error message if status = failed';
