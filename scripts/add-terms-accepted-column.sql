-- Add terms_accepted_at column to passes table
ALTER TABLE pass.passes 
ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMP WITH TIME ZONE;

-- Add comment to document the column
COMMENT ON COLUMN pass.passes.terms_accepted_at IS 'Timestamp when the user accepted the terms and conditions for pass usage';
