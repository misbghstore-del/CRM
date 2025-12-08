-- Migration Script: Update customer type from "New Lead" to "Prospect Dealer"
-- Run this in your Supabase SQL Editor

-- Update all existing customers with type "New Lead" to "Prospect Dealer"
UPDATE customers 
SET type = 'Prospect Dealer' 
WHERE type = 'New Lead';

-- Verify the migration
SELECT type, COUNT(*) as count
FROM customers
GROUP BY type
ORDER BY type;
