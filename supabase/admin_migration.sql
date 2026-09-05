-- GPCC ADMINISTRATION / PRODUCTION REPAIR MIGRATION
-- IMPORTANT: Run this file against the EXISTING production database.
-- Do NOT run schema.sql against an existing populated database.
-- This migration is intentionally dependency-ordered and safe to re-run.

begin;

-- ================================================================
-- 0) Required enum types (create only if the existing DB lacks them)
-- ================================================================
do $$ begin
  create type public.gpcc_role as enum ('Administrator','Editor','Member');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.account_status as enum ('Pending','Approved','Rejected','Inactive');
exception when duplicate_object then null; end $$;

-- ================================================================
-- 1) Profiles: ensure the governance columns exist
-- ================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text,
  role public.gpcc_role not null default 'Member',
  status public.account_status not null default 'Pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists full_name text not null default '';
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

-- ================================================================
-- 2) CRITICAL DEPENDENCY: role_permissions must exist BEFORE
--    current_role()/has_permission() are created.
-- ================================================================
create table if not exists public.role_permissions (
  role public.gpcc_role not null,
  module text not null,
  action text not null,
  primary key (role, module, action)
);

insert into public.role_permissions(role,module,action) values
 ('Administrator','dashboard','view'),
 ('Administrator','income','view'),('Administrator','income','create'),('Administrator','income','update'),('Administrator','income','delete'),
 ('Administrator','expenses','view'),('Administrator','expenses','create'),('Administrator','expenses','update'),('Administrator','expenses','delete'),
 ('Administrator','petty_cash','view'),('Administrator','petty_cash','create'),('Administrator','petty_cash','update'),('Administrator','petty_cash','delete'),
 ('Administrator','bank_transfers','view'),('Administrator','bank_transfers','create'),('Administrator','bank_transfers','update'),('Administrator','bank_transfers','delete'),
 ('Administrator','reports','view'),('Administrator','excel','view'),('Administrator','excel','import'),
 ('Administrator','admin','view'),('Administrator','users','manage'),('Administrator','bank_setup','manage'),('Administrator','petty_cash_setup','manage'),('Administrator','audit','view'),
 ('Editor','dashboard','view'),
 ('Editor','income','view'),('Editor','income','create'),('Editor','income','update'),('Editor','income','delete'),
 ('Editor','expenses','view'),('Editor','expenses','create'),('Editor','expenses','update'),('Editor','expenses','delete'),
 ('Editor','petty_cash','view'),('Editor','petty_cash','create'),('Editor','petty_cash','update'),('Editor','petty_cash','delete'),
 ('Editor','bank_transfers','view'),('Editor','bank_transfers','create'),('Editor','bank_transfers','update'),('Editor','bank_transfers','delete'),
 ('Editor','reports','view'),('Editor','excel','view'),('Editor','excel','import'),
 ('Member','dashboard','view'),('Member','reports','view')
on conflict do nothing;

-- ================================================================
-- 3) Existing accounts: backfill email from auth.users
-- ================================================================
update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id
  and coalesce(p.email, '') = '';

-- ================================================================
-- 4) Permission helpers. These are SECURITY DEFINER so RLS on
--    role_permissions does not recursively block permission checks.
-- ================================================================
create or replace function public.current_role()
returns public.gpcc_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid()
    and status = 'Approved'
  limit 1
$$;

create or replace function public.has_permission(p_module text, p_action text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.role_permissions rp
    where rp.role = public.current_role()
      and rp.module = p_module
      and rp.action = p_action
  )
$$;

revoke all on function public.current_role() from public;
revoke all on function public.has_permission(text,text) from public;
grant execute on function public.current_role() to authenticated;
grant execute on function public.has_permission(text,text) to authenticated;

-- ================================================================
-- 5) New-user synchronization
-- ================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles(id, full_name, email, role, status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    'Member',
    'Pending'
  )
  on conflict (id) do update
  set email = coalesce(excluded.email, public.profiles.email),
      full_name = case
        when coalesce(public.profiles.full_name, '') = '' then excluded.full_name
        else public.profiles.full_name
      end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ================================================================
-- 6) Administrator-only profile governance RPC
-- ================================================================
create or replace function public.admin_update_profile(
  p_user_id uuid,
  p_full_name text,
  p_role public.gpcc_role,
  p_status public.account_status
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role public.gpcc_role;
  target public.profiles;
  admin_count integer;
begin
  select role into actor_role
  from public.profiles
  where id = auth.uid() and status = 'Approved';

  if actor_role is distinct from 'Administrator' then
    raise exception 'Administrator privileges are required';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'For security, an administrator cannot change their own role or status';
  end if;

  select * into target
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    raise exception 'User profile not found';
  end if;

  if target.role = 'Administrator'
     and target.status = 'Approved'
     and (p_role <> 'Administrator' or p_status <> 'Approved') then
    select count(*) into admin_count
    from public.profiles
    where role = 'Administrator' and status = 'Approved';

    if admin_count <= 1 then
      raise exception 'The last approved Administrator cannot be removed';
    end if;
  end if;

  update public.profiles
  set full_name = coalesce(nullif(trim(p_full_name), ''), full_name),
      role = p_role,
      status = p_status,
      updated_at = now()
  where id = p_user_id
  returning * into target;

  return target;
end;
$$;

revoke all on function public.admin_update_profile(uuid,text,public.gpcc_role,public.account_status) from public;
grant execute on function public.admin_update_profile(uuid,text,public.gpcc_role,public.account_status) to authenticated;

-- ================================================================
-- 7) Profile RLS: self-read OR administrator-read
-- ================================================================
alter table public.profiles enable row level security;
drop policy if exists profiles_select_self_or_admin on public.profiles;
create policy profiles_select_self_or_admin
on public.profiles for select
to authenticated
using (id = auth.uid() or public.has_permission('users','manage'));

-- Permission definitions are administrator-readable only.
alter table public.role_permissions enable row level security;
drop policy if exists permissions_admin_read on public.role_permissions;
create policy permissions_admin_read
on public.role_permissions for select
to authenticated
using (public.has_permission('users','manage'));

-- ================================================================
-- 8) Indexes used by Administration
-- ================================================================
create index if not exists idx_profiles_status on public.profiles(status);
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_email on public.profiles(email);

commit;

-- ================================================================
-- OPTIONAL VERIFICATION (run separately after the migration)
-- ================================================================
-- select id, full_name, email, role, status, created_at
-- from public.profiles
-- order by created_at desc;
--
-- select * from public.role_permissions order by role, module, action;
--
-- select to_regprocedure('public.has_permission(text,text)');
