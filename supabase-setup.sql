-- LeaveFlow demo database setup for Supabase
-- Run this entire script in Supabase Dashboard > SQL Editor.
-- New sign-ups are always employees. Promote test managers/admins manually using the SQL below.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default 'Employee',
  email text,
  role text not null default 'employee'
    check (role in ('employee','manager','hr_admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete cascade,
  leave_type text not null check (leave_type in ('Annual leave','Sick leave','Personal leave','Unpaid leave')),
  start_date date not null,
  end_date date not null,
  reason text not null check (char_length(trim(reason)) between 1 and 1000),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  review_note text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint valid_leave_dates check (end_date >= start_date)
);

create index if not exists leave_requests_employee_id_idx on public.leave_requests(employee_id);
create index if not exists leave_requests_status_idx on public.leave_requests(status);

-- Create a profile automatically when a person signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', 'Employee'),
    new.email,
    'employee'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.leave_requests enable row level security;

-- Security-definer helper avoids recursive profile-table RLS checks.
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = (select auth.uid())
$$;

-- Users can see their own profile. Managers and HR admins can see profiles
-- for this starter demo. Production deployments should scope managers to teams.
drop policy if exists "profile self or reviewer read" on public.profiles;
create policy "profile self or reviewer read" on public.profiles
for select to authenticated
using (
  id = (select auth.uid())
  or (select public.current_user_role()) in ('manager','hr_admin')
);

-- A user can update their own display name only; role is not user-editable.
drop policy if exists "profile self update name" on public.profiles;
create policy "profile self update name" on public.profiles
for update to authenticated
using (id = (select auth.uid()))
with check (
  id = (select auth.uid())
  and role = (select public.current_user_role())
);

-- Employees can read only their own requests. Managers and HR admins can read all.
drop policy if exists "employee or reviewer read requests" on public.leave_requests;
create policy "employee or reviewer read requests" on public.leave_requests
for select to authenticated
using (
  employee_id = (select auth.uid())
  or exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('manager','hr_admin')
  )
);

-- Employees may submit requests only for themselves, always initially pending.
drop policy if exists "employee create own pending request" on public.leave_requests;
create policy "employee create own pending request" on public.leave_requests
for insert to authenticated
with check (
  employee_id = (select auth.uid())
  and status = 'pending'
  and reviewed_by is null
  and reviewed_at is null
);

-- Only managers and HR admins can update request decisions.
drop policy if exists "manager or hr review requests" on public.leave_requests;
create policy "manager or hr review requests" on public.leave_requests
for update to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('manager','hr_admin')
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('manager','hr_admin')
  )
);

-- No delete policy is intentionally provided in this starter.

-- AFTER creating your test accounts in the app, promote one account to manager:
-- update public.profiles set role = 'manager' where email = 'manager@example.com';
--
-- Optional: promote a separate HR account:
-- update public.profiles set role = 'hr_admin' where email = 'hr@example.com';
--
-- IMPORTANT: Run promotion commands only as the project owner/admin in SQL Editor.
