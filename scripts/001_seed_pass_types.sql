-- Seed initial pass types for testing
-- Note: organisation_id should be replaced with actual org ID in production

INSERT INTO pass.pass_types (
  id,
  code,
  name,
  description,
  price_cents,
  currency,
  duration_minutes,
  is_active,
  organisation_id
) VALUES
  (
    gen_random_uuid(),
    'DAY',
    'Day Pass',
    'Valid for 24 hours from time of purchase',
    1000,
    'USD',
    1440,
    true,
    '00000000-0000-0000-0000-000000000000'::uuid
  ),
  (
    gen_random_uuid(),
    'WEEK',
    'Week Pass',
    'Valid for 7 days from time of purchase',
    5000,
    'USD',
    10080,
    true,
    '00000000-0000-0000-0000-000000000000'::uuid
  ),
  (
    gen_random_uuid(),
    'MONTH',
    'Month Pass',
    'Valid for 30 days from time of purchase',
    15000,
    'USD',
    43200,
    true,
    '00000000-0000-0000-0000-000000000000'::uuid
  )
ON CONFLICT (code) DO NOTHING;
