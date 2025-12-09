-- 1. Update the check constraint to include 'super_admin'
-- Note: You might need to drop the existing constraint first if you are running this on an existing DB
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'bdm', 'super_admin'));

-- 2. Create a unique index to ensure only ONE super_admin exists
-- This partial index ensures that for all rows where role = 'super_admin', the id must be unique (which it is by PK),
-- but more importantly, we want to ensure there is only ONE row with role 'super_admin'.
-- Actually, a better way to enforce "only one row has this value" is a partial unique index on a constant or just the role itself
CREATE UNIQUE INDEX only_one_super_admin ON profiles (role) WHERE role = 'super_admin';

-- 3. SQL to promote a user (Replace 'YOUR_EMAIL_HERE' with the actual email)
UPDATE profiles
SET role = 'super_admin'
WHERE email = 'YOUR_EMAIL_HERE';

-- Verify
SELECT * FROM profiles WHERE role = 'super_admin';
