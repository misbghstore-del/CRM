-- Enable super_admin to view all visits and customers
-- This fixes the issue where super_admin could not see data despite code changes.

-- 1. Visits Policy
CREATE POLICY "Super Admins can view all visits"
ON visits FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'super_admin'
  )
);

-- 2. Customers Policy (Ensure visibility)
CREATE POLICY "Super Admins can view all customers"
ON customers FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'super_admin'
  )
);
