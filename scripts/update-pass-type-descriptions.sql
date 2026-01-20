-- Update pass type descriptions to show correct end times
-- Day Pass: 11:59 PM same day
-- Camping Pass: 10:00 AM on last day

-- Update Day Pass descriptions
UPDATE pass.pass_types
SET description = 'Single entry - valid until 11:59 PM same day'
WHERE LOWER(name) LIKE '%day%pass%'
  AND LOWER(name) NOT LIKE '%camping%';

-- Update Camping Pass descriptions  
UPDATE pass.pass_types
SET description = 'Camping access - valid until 10:00 AM on last day'
WHERE LOWER(name) LIKE '%camping%';
