-- Add audit fields to customers table
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS last_edited_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMP WITH TIME ZONE;

-- Backfill created_by with assigned_to for existing records (best guess)
UPDATE customers 
SET created_by = assigned_to 
WHERE created_by IS NULL;

-- Make created_by not null after backfill (optional, but good practice if we want to enforce it)
-- ALTER TABLE customers ALTER COLUMN created_by SET NOT NULL;
