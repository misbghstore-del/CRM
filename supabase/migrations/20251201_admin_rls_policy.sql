-- Policy to allow admins to view all visits
create policy "Admins can view all visits."
  on visits for select
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );
