-- Supabase DDL for gemsAPI
-- Run this in Supabase SQL Editor (connected as an admin/service role).
-- Adjust schema name if you do not use "public".

-- Extensions (uuid generation)
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- Table definition
create table if not exists public.gems (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  instructions text not null,
  created_at timestamptz not null default now()
);

-- Useful index for ordering/filtering
create index if not exists idx_gems_created_at on public.gems (created_at desc);

-- (Optional) Row Level Security
-- Enable RLS and allow service-role key (used by backend) full access.
-- If you plan to expose anon key, lock RLS down further; this app expects server-side service key access only.
alter table public.gems enable row level security;

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

-- Function to automatically update updated_at timestamp
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger to auto-update updated_at for admin_users
create trigger trigger_admin_users_updated_at
  before update on public.admin_users
  for each row execute procedure update_updated_at_column();

-- Seed data (optional)
-- insert into public.gems (name, description, instructions) values
-- ('Python Expert', 'A helpful coding assistant specializing in Python best practices.', 'You are an expert Python developer...'),
-- ('Creative Writer', 'Helps brainstorm stories and improve creative writing flow.', 'You are a creative writing coach...');
