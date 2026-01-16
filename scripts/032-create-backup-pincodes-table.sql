-- Create backup_pincodes table for fallback PIN codes
-- These are used when the Rooms webhook fails
-- 26 fortnights of backup codes (1201-1226) starting from Jan 17, 2026

CREATE TABLE IF NOT EXISTS pass.backup_pincodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Fixed FK reference from core.organizations to core.organisations
  org_id UUID NOT NULL REFERENCES core.organisations(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES core.sites(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES core.devices(id) ON DELETE CASCADE,
  fortnight_number INTEGER NOT NULL CHECK (fortnight_number >= 1 AND fortnight_number <= 26),
  pincode VARCHAR(10) NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique fortnight per device
  CONSTRAINT unique_fortnight_per_device UNIQUE (device_id, fortnight_number)
);

-- Index for quick lookup by device and current date
CREATE INDEX IF NOT EXISTS idx_backup_pincodes_device_period 
  ON pass.backup_pincodes(device_id, period_start, period_end);

-- Add comment
COMMENT ON TABLE pass.backup_pincodes IS 'Fallback PIN codes for when Rooms webhook fails. 26 fortnights starting Jan 17, 2026.';
