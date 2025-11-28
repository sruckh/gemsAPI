-- Supabase DDL for gemsAPI
-- Run this in Supabase SQL Editor (connected as an admin/service role).
-- Adjust schema name if you do not use "public".

-- Extensions (uuid generation)
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- Table definition
create table if not exists public.gems (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) default auth.uid(),
  name text not null,
  description text,
  instructions text not null,
  created_at timestamptz not null default now()
);

-- Useful index for ordering/filtering
create index if not exists idx_gems_created_at on public.gems (created_at desc);
create index if not exists idx_gems_user_id on public.gems (user_id);

-- Row Level Security
-- Enable RLS
alter table public.gems enable row level security;

-- Policy: Service Role (Backend System) has full access
do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'gems' and policyname = 'service_role_all'
  ) then
    create policy service_role_all on public.gems
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end$$;

-- Policy: Users can manage only their own gems
-- This covers SELECT, INSERT, UPDATE, DELETE
do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'gems' and policyname = 'users_manage_own_gems'
  ) then
    create policy "users_manage_own_gems" on public.gems
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end$$;


-- Admin users table for authentication
create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  role text not null default 'admin' check (role in ('admin', 'super_admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for admin users
create index if not exists idx_admin_users_email on public.admin_users (email);

-- RLS for admin_users - allow service role full access
alter table public.admin_users enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'admin_users' and policyname = 'service_role_all'
  ) then
    create policy service_role_all on public.admin_users
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end$$;

-- Policy: Users can read their own admin status (to support Gems RLS)
do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'admin_users' and policyname = 'admins_read_own_status'
  ) then
    create policy "admins_read_own_status" on public.admin_users
      for select
      using (email = auth.jwt() ->> 'email');
  end if;
end$$;

-- Gems RLS
-- Policy: Users can manage their own gems, Admins can manage ALL gems
do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'gems' and policyname = 'users_and_admins_manage_gems'
  ) then
    create policy "users_and_admins_manage_gems" on public.gems
      for all
      using (
        auth.uid() = user_id 
        or 
        (select count(*) from public.admin_users where email = auth.jwt() ->> 'email') > 0
      )
      with check (
        auth.uid() = user_id 
        or 
        (select count(*) from public.admin_users where email = auth.jwt() ->> 'email') > 0
      );
  end if;
end$$;


-- Function to automatically update updated_at timestamp
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger to auto-update updated_at for admin_users
drop trigger if exists trigger_admin_users_updated_at on public.admin_users;
create trigger trigger_admin_users_updated_at
  before update on public.admin_users
  for each row execute procedure update_updated_at_column();

-- ==========================================
-- MIGRATION HELPERS (For existing DBs)
-- Run these if you are upgrading from a previous version
-- ==========================================

-- 1. Add user_id column if missing
-- alter table public.gems add column if not exists user_id uuid references auth.users(id) default auth.uid();

-- 2. Backfill user_id for existing gems (Optional: Assign to a specific user or leave null)
-- update public.gems set user_id = 'YOUR_USER_ID' where user_id is null;

-- 3. Apply new policies (Run the policy creation blocks above)