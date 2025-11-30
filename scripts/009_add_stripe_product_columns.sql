-- Add Stripe product and price IDs to pass_types table
-- This enables direct linking between pass types and Stripe products

ALTER TABLE pass.pass_types
ADD COLUMN IF NOT EXISTS stripe_product_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;

COMMENT ON COLUMN pass.pass_types.stripe_product_id IS 'Stripe Product ID for this pass type';
COMMENT ON COLUMN pass.pass_types.stripe_price_id IS 'Stripe Price ID for this pass type';

-- Create index for faster Stripe ID lookups
CREATE INDEX IF NOT EXISTS idx_pass_types_stripe_product_id ON pass.pass_types(stripe_product_id);
CREATE INDEX IF NOT EXISTS idx_pass_types_stripe_price_id ON pass.pass_types(stripe_price_id);
