-- Policy to allow admins to view all customers
create policy "Admins can view all customers."
  on customers for select
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );
