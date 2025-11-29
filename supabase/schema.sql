-- Enable PostGIS for location features (optional, using lat/lng columns for now)
-- create extension if not exists postgis;

-- 1. Profiles Table (Public profile info for Auth users)
create table profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text,
  full_name text,
  role text check (role in ('admin', 'bdm')) default 'bdm',
  region text,
  updated_at timestamp with time zone
);

alter table profiles enable row level security;

create policy "Public profiles are viewable by everyone."
  on profiles for select
  using ( true );

create policy "Users can insert their own profile."
  on profiles for insert
  with check ( auth.uid() = id );

create policy "Users can update own profile."
  on profiles for update
  using ( auth.uid() = id );

-- 2. Customers Table
create table customers (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  type text, -- e.g., 'Retailer', 'Distributor'
  contact_person text,
  phone text,
  address text,
  stage text, -- e.g., 'Lead', 'Prospect', 'Customer'
  location_lat float,
  location_lng float,
  assigned_to uuid references profiles(id) not null,
  meeting_count int default 0
);

alter table customers enable row level security;

create policy "BDMs can view their own customers."
  on customers for select
  using ( auth.uid() = assigned_to );

create policy "BDMs can insert their own customers."
  on customers for insert
  with check ( auth.uid() = assigned_to );

create policy "BDMs can update their own customers."
  on customers for update
  using ( auth.uid() = assigned_to );

-- 3. Visits Table
create table visits (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  customer_id uuid references customers(id) on delete cascade not null,
  user_id uuid references profiles(id) not null,
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null,
  purpose text,
  outcome text,
  notes text,
  location_lat float,
  location_lng float,
  photo_url text
);

alter table visits enable row level security;

create policy "BDMs can view their own visits."
  on visits for select
  using ( auth.uid() = user_id );

create policy "BDMs can insert their own visits."
  on visits for insert
  with check ( auth.uid() = user_id );

-- 4. Tasks Table
create table tasks (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  customer_id uuid references customers(id) on delete cascade,
  user_id uuid references profiles(id) not null,
  description text not null,
  due_date timestamp with time zone,
  is_completed boolean default false
);

alter table tasks enable row level security;

create policy "BDMs can view their own tasks."
  on tasks for select
  using ( auth.uid() = user_id );

create policy "BDMs can insert their own tasks."
  on tasks for insert
  with check ( auth.uid() = user_id );

create policy "BDMs can update their own tasks."
  on tasks for update
  using ( auth.uid() = user_id );

-- Function to handle new user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger for new user signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 5. Storage for Visit Photos
-- Note: This requires the 'storage' extension which is enabled by default in Supabase.
-- We insert into storage.buckets if it doesn't exist.
insert into storage.buckets (id, name, public)
values ('visit-photos', 'visit-photos', true)
on conflict (id) do nothing;

create policy "BDMs can upload visit photos."
  on storage.objects for insert
  with check ( bucket_id = 'visit-photos' and auth.uid() = owner );

create policy "BDMs can view visit photos."
  on storage.objects for select
  using ( bucket_id = 'visit-photos' );

