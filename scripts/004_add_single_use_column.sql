-- Add single_use flag to passes table
ALTER TABLE pass.passes ADD COLUMN IF NOT EXISTS single_use BOOLEAN NOT NULL DEFAULT false;

-- Add index for querying single-use passes
CREATE INDEX IF NOT EXISTS idx_passes_single_use ON pass.passes(single_use) WHERE single_use = true;

COMMENT ON COLUMN pass.passes.single_use IS 'If true, pass can only be used once and will be marked as "used" after first entry';
