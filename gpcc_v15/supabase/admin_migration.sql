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
-- 1A) Audit log compatibility for existing production databases
-- ================================================================
-- Older GPCC databases may already have audit_logs without metadata.
-- The Administration console can safely read this optional field once added.
create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id uuid references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id text,
  old_data jsonb,
  new_data jsonb,
  metadata jsonb
);
alter table public.audit_logs add column if not exists occurred_at timestamptz not null default now();
alter table public.audit_logs add column if not exists actor_id uuid references auth.users(id);
alter table public.audit_logs add column if not exists action text not null default 'UNKNOWN';
alter table public.audit_logs add column if not exists entity_type text not null default 'UNKNOWN';
alter table public.audit_logs add column if not exists entity_id text;
alter table public.audit_logs add column if not exists old_data jsonb;
alter table public.audit_logs add column if not exists new_data jsonb;
alter table public.audit_logs add column if not exists metadata jsonb;
create index if not exists idx_audit_actor_time on public.audit_logs(actor_id, occurred_at desc);

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

-- Canonical permission catalog. Server-side RPCs validate every requested
-- permission against this catalog; the browser cannot invent a new privilege.
create table if not exists public.permission_catalog (
  module text not null,
  action text not null,
  primary key (module, action)
);
insert into public.permission_catalog(module,action) values
 ('dashboard','view'),
 ('income','view'),('income','create'),('income','update'),('income','delete'),
 ('expenses','view'),('expenses','create'),('expenses','update'),('expenses','delete'),
 ('petty_cash','view'),('petty_cash','create'),('petty_cash','update'),('petty_cash','delete'),
 ('bank_transfers','view'),('bank_transfers','create'),('bank_transfers','update'),('bank_transfers','delete'),
 ('reports','view'),('excel','view'),('excel','import'),('admin','view'),('users','manage'),
 ('bank_setup','manage'),('petty_cash_setup','manage'),('audit','view')
 on conflict do nothing;

alter table public.permission_catalog enable row level security;
drop policy if exists permission_catalog_admin_read on public.permission_catalog;
create policy permission_catalog_admin_read
on public.permission_catalog for select
to authenticated
using (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='Administrator' and p.status='Approved'));

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
-- 6A) Administrator permission-management RPCs
-- ================================================================
-- The browser never writes role_permissions directly. These SECURITY DEFINER
-- functions verify that the caller is an approved Administrator, validate the
-- requested role/module/action, write the change, and record it in audit_logs.
create or replace function public.admin_set_permission(
  p_role public.gpcc_role,
  p_module text,
  p_action text
)
returns public.role_permissions
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role public.gpcc_role;
  result_row public.role_permissions;
begin
  select role into actor_role
  from public.profiles
  where id = auth.uid() and status = 'Approved';

  if actor_role is distinct from 'Administrator' then
    raise exception 'Administrator privileges are required';
  end if;

  if nullif(trim(p_module), '') is null or nullif(trim(p_action), '') is null then
    raise exception 'Module and action are required';
  end if;
  if not exists (select 1 from public.permission_catalog where module=trim(p_module) and action=trim(p_action)) then
    raise exception 'Unsupported permission: % / %', trim(p_module), trim(p_action);
  end if;

  insert into public.role_permissions(role, module, action)
  values (p_role, trim(p_module), trim(p_action))
  on conflict (role, module, action) do nothing
  returning * into result_row;

  if result_row is null then
    select * into result_row
    from public.role_permissions
    where role = p_role and module = trim(p_module) and action = trim(p_action);
  end if;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, old_data, new_data, metadata)
  values (
    auth.uid(), 'GRANT', 'role_permissions',
    p_role::text || ':' || trim(p_module) || ':' || trim(p_action),
    null,
    jsonb_build_object('role', p_role::text, 'module', trim(p_module), 'action', trim(p_action)),
    jsonb_build_object('source', 'administration', 'operation', 'grant_permission')
  );

  return result_row;
end;
$$;

create or replace function public.admin_remove_permission(
  p_role public.gpcc_role,
  p_module text,
  p_action text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role public.gpcc_role;
  existed boolean;
  admin_critical boolean;
begin
  select role into actor_role
  from public.profiles
  where id = auth.uid() and status = 'Approved';

  if actor_role is distinct from 'Administrator' then
    raise exception 'Administrator privileges are required';
  end if;

  admin_critical := p_role = 'Administrator'
    and ((p_module = 'admin' and p_action = 'view')
      or (p_module = 'users' and p_action = 'manage')
      or (p_module = 'audit' and p_action = 'view'));

  if admin_critical then
    raise exception 'Critical Administrator control permissions are protected';
  end if;
  if not exists (select 1 from public.permission_catalog where module=trim(p_module) and action=trim(p_action)) then
    raise exception 'Unsupported permission: % / %', trim(p_module), trim(p_action);
  end if;

  select exists(
    select 1 from public.role_permissions
    where role = p_role and module = trim(p_module) and action = trim(p_action)
  ) into existed;

  delete from public.role_permissions
  where role = p_role and module = trim(p_module) and action = trim(p_action);

  if existed then
    insert into public.audit_logs(actor_id, action, entity_type, entity_id, old_data, new_data, metadata)
    values (
      auth.uid(), 'REVOKE', 'role_permissions',
      p_role::text || ':' || trim(p_module) || ':' || trim(p_action),
      jsonb_build_object('role', p_role::text, 'module', trim(p_module), 'action', trim(p_action)),
      null,
      jsonb_build_object('source', 'administration', 'operation', 'revoke_permission')
    );
  end if;

  return existed;
end;
$$;

revoke all on function public.admin_set_permission(public.gpcc_role,text,text) from public;
grant execute on function public.admin_set_permission(public.gpcc_role,text,text) to authenticated;
revoke all on function public.admin_remove_permission(public.gpcc_role,text,text) from public;
grant execute on function public.admin_remove_permission(public.gpcc_role,text,text) to authenticated;

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
using (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='Administrator' and p.status='Approved'));

-- Audit logs: administrators can read, nobody can edit/delete from the browser.
alter table public.audit_logs enable row level security;
drop policy if exists audit_admin_read on public.audit_logs;
create policy audit_admin_read
on public.audit_logs for select
to authenticated
using (public.has_permission('audit','view'));

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

-- ================================================================
-- GPCC V13: CUSTOM RBAC + BULK PERMISSION GOVERNANCE
-- Safe incremental extension for the existing production database.
-- ================================================================

begin;

create table if not exists public.custom_roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text not null default '',
  is_active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists custom_role_id uuid references public.custom_roles(id) on delete set null;
create index if not exists idx_profiles_custom_role on public.profiles(custom_role_id);

create table if not exists public.custom_role_permissions (
  custom_role_id uuid not null references public.custom_roles(id) on delete cascade,
  module text not null,
  action text not null,
  primary key (custom_role_id, module, action)
);

-- Publicly readable only to authenticated users for active role names; all
-- writes and permission reads are mediated by Administrator-only RPCs.
alter table public.custom_roles enable row level security;
drop policy if exists custom_roles_authenticated_read on public.custom_roles;
create policy custom_roles_authenticated_read
on public.custom_roles for select
to authenticated
using (is_active = true or exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='Administrator' and p.status='Approved'));

alter table public.custom_role_permissions enable row level security;
drop policy if exists custom_role_permissions_admin_read on public.custom_role_permissions;
create policy custom_role_permissions_admin_read
on public.custom_role_permissions for select
to authenticated
using (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='Administrator' and p.status='Approved'));

-- Effective permission helper: custom role replaces the base role while
-- assigned; otherwise the built-in role_permissions are used.
create or replace function public.has_permission(p_module text, p_action text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p.custom_role_id is not null and exists (select 1 from public.custom_roles cr where cr.id=p.custom_role_id and cr.is_active) then exists (
      select 1 from public.custom_role_permissions crp
      where crp.custom_role_id = p.custom_role_id
        and crp.module = p_module
        and crp.action = p_action
    )
    else exists (
      select 1 from public.role_permissions rp
      where rp.role = p.role
        and rp.module = p_module
        and rp.action = p_action
    )
  end
  from public.profiles p
  where p.id = auth.uid() and p.status = 'Approved'
  limit 1
$$;

create or replace function public.get_my_permissions()
returns table(module text, action text)
language sql
stable
security definer
set search_path = public
as $$
  select crp.module, crp.action
  from public.profiles p
  join public.custom_roles cr on cr.id = p.custom_role_id and cr.is_active
  join public.custom_role_permissions crp on crp.custom_role_id = cr.id
  where p.id = auth.uid() and p.status = 'Approved'
  union all
  select rp.module, rp.action
  from public.profiles p
  join public.role_permissions rp on rp.role = p.role
  where p.id = auth.uid() and p.status = 'Approved'
    and (p.custom_role_id is null or not exists (select 1 from public.custom_roles cr where cr.id=p.custom_role_id and cr.is_active))
$$;
revoke all on function public.get_my_permissions() from public;
grant execute on function public.get_my_permissions() to authenticated;

create or replace function public.get_my_access()
returns table(full_name text, role_name text, status text, custom_role_id uuid, custom_role_name text)
language sql
stable
security definer
set search_path = public
as $$
  select p.full_name,
         p.role::text,
         p.status::text,
         p.custom_role_id,
         cr.name
  from public.profiles p
  left join public.custom_roles cr on cr.id = p.custom_role_id
  where p.id = auth.uid()
  limit 1
$$;
revoke all on function public.get_my_access() from public;
grant execute on function public.get_my_access() to authenticated;

-- Extended profile governance RPC. The old four-argument function remains for
-- backwards compatibility; V13 uses this five-argument form.
create or replace function public.admin_update_profile(
  p_user_id uuid,
  p_full_name text,
  p_role public.gpcc_role,
  p_status public.account_status,
  p_custom_role_id uuid
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
  custom_active boolean;
begin
  select role into actor_role from public.profiles where id = auth.uid() and status = 'Approved';
  if actor_role is distinct from 'Administrator' then raise exception 'Administrator privileges are required'; end if;
  if p_user_id = auth.uid() then raise exception 'For security, an administrator cannot change their own role or status'; end if;
  if p_role = 'Administrator' and p_custom_role_id is not null then raise exception 'Custom roles cannot override Administrator access'; end if;
  if p_custom_role_id is not null then
    select is_active into custom_active from public.custom_roles where id = p_custom_role_id;
    if not found or not custom_active then raise exception 'Custom role is not active'; end if;
  end if;
  select * into target from public.profiles where id = p_user_id for update;
  if not found then raise exception 'User profile not found'; end if;
  if target.role = 'Administrator' and target.status = 'Approved'
     and (p_role <> 'Administrator' or p_status <> 'Approved') then
    select count(*) into admin_count from public.profiles where role = 'Administrator' and status = 'Approved';
    if admin_count <= 1 then raise exception 'The last approved Administrator cannot be removed'; end if;
  end if;
  update public.profiles
  set full_name = coalesce(nullif(trim(p_full_name), ''), full_name),
      role = p_role,
      status = p_status,
      custom_role_id = case when p_role = 'Administrator' then null else p_custom_role_id end,
      updated_at = now()
  where id = p_user_id
  returning * into target;
  return target;
end;
$$;
revoke all on function public.admin_update_profile(uuid,text,public.gpcc_role,public.account_status,uuid) from public;
grant execute on function public.admin_update_profile(uuid,text,public.gpcc_role,public.account_status,uuid) to authenticated;

-- Bulk permission operations for standard roles.
create or replace function public.admin_bulk_role_permissions(p_role public.gpcc_role, p_mode text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer := 0; actor_role public.gpcc_role;
begin
  select role into actor_role from public.profiles where id=auth.uid() and status='Approved';
  if actor_role is distinct from 'Administrator' then raise exception 'Administrator privileges are required'; end if;
  if p_mode = 'grant_all' then
    insert into public.role_permissions(role,module,action)
    select p_role, x.module, x.action from (values
      ('dashboard','view'),('income','view'),('income','create'),('income','update'),('income','delete'),
      ('expenses','view'),('expenses','create'),('expenses','update'),('expenses','delete'),
      ('petty_cash','view'),('petty_cash','create'),('petty_cash','update'),('petty_cash','delete'),
      ('bank_transfers','view'),('bank_transfers','create'),('bank_transfers','update'),('bank_transfers','delete'),
      ('reports','view'),('excel','view'),('excel','import'),('admin','view'),('users','manage'),
      ('bank_setup','manage'),('petty_cash_setup','manage'),('audit','view')) x(module,action)
    on conflict do nothing;
  elsif p_mode = 'remove_all' then
    if p_role = 'Administrator' then
      delete from public.role_permissions where role=p_role and not ((module='admin' and action='view') or (module='users' and action='manage') or (module='audit' and action='view'));
    else delete from public.role_permissions where role=p_role; end if;
  elsif p_mode = 'reset' then
    if p_role = 'Administrator' then
      delete from public.role_permissions where role=p_role and not ((module='admin' and action='view') or (module='users' and action='manage') or (module='audit' and action='view'));
    else delete from public.role_permissions where role=p_role; end if;
    if p_role='Administrator' then
      insert into public.role_permissions(role,module,action) select 'Administrator',x.module,x.action from (values
       ('dashboard','view'),('income','view'),('income','create'),('income','update'),('income','delete'),('expenses','view'),('expenses','create'),('expenses','update'),('expenses','delete'),('petty_cash','view'),('petty_cash','create'),('petty_cash','update'),('petty_cash','delete'),('bank_transfers','view'),('bank_transfers','create'),('bank_transfers','update'),('bank_transfers','delete'),('reports','view'),('excel','view'),('excel','import'),('admin','view'),('users','manage'),('bank_setup','manage'),('petty_cash_setup','manage'),('audit','view')) x(module,action) on conflict do nothing;
    elsif p_role='Editor' then
      insert into public.role_permissions(role,module,action) select 'Editor',x.module,x.action from (values
       ('dashboard','view'),('income','view'),('income','create'),('income','update'),('income','delete'),('expenses','view'),('expenses','create'),('expenses','update'),('expenses','delete'),('petty_cash','view'),('petty_cash','create'),('petty_cash','update'),('petty_cash','delete'),('bank_transfers','view'),('bank_transfers','create'),('bank_transfers','update'),('bank_transfers','delete'),('reports','view'),('excel','view'),('excel','import')) x(module,action) on conflict do nothing;
    else
      insert into public.role_permissions(role,module,action) values ('Member','dashboard','view'),('Member','reports','view') on conflict do nothing;
    end if;
  else raise exception 'Unsupported permission operation: %', p_mode; end if;
  get diagnostics n = row_count;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,new_data,metadata) values(auth.uid(),'PERMISSION_BULK','role_permissions',p_role::text,jsonb_build_object('role',p_role::text,'mode',p_mode),jsonb_build_object('source','administration','operation','bulk_permission'));
  return n;
end;
$$;
revoke all on function public.admin_bulk_role_permissions(public.gpcc_role,text) from public;
grant execute on function public.admin_bulk_role_permissions(public.gpcc_role,text) to authenticated;

-- Custom role CRUD and permission operations.
create or replace function public.admin_create_custom_role(p_name text,p_description text,p_copy_from_role public.gpcc_role)
returns public.custom_roles
language plpgsql security definer set search_path=public as $$
declare actor_role public.gpcc_role; r public.custom_roles;
begin
 select role into actor_role from public.profiles where id=auth.uid() and status='Approved';
 if actor_role is distinct from 'Administrator' then raise exception 'Administrator privileges are required'; end if;
 if nullif(trim(p_name),'') is null then raise exception 'Role name is required'; end if;
 insert into public.custom_roles(name,description,created_by) values(trim(p_name),coalesce(trim(p_description),''),auth.uid()) returning * into r;
 insert into public.custom_role_permissions(custom_role_id,module,action) select r.id,module,action from public.role_permissions where role=p_copy_from_role on conflict do nothing;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,new_data,metadata) values(auth.uid(),'CREATE','custom_role',r.id::text,to_jsonb(r),jsonb_build_object('source','administration','copied_from',p_copy_from_role::text));
 return r;
end; $$;
revoke all on function public.admin_create_custom_role(text,text,public.gpcc_role) from public;
grant execute on function public.admin_create_custom_role(text,text,public.gpcc_role) to authenticated;

create or replace function public.admin_update_custom_role(p_custom_role_id uuid,p_name text,p_description text)
returns public.custom_roles language plpgsql security definer set search_path=public as $$
declare actor_role public.gpcc_role; r public.custom_roles;
begin
 select role into actor_role from public.profiles where id=auth.uid() and status='Approved';
 if actor_role is distinct from 'Administrator' then raise exception 'Administrator privileges are required'; end if;
 if nullif(trim(p_name),'') is null then raise exception 'Role name is required'; end if;
 update public.custom_roles set name=trim(p_name), description=coalesce(trim(p_description),''), updated_at=now() where id=p_custom_role_id returning * into r;
 if not found then raise exception 'Custom role not found'; end if;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,new_data,metadata) values(auth.uid(),'UPDATE','custom_role',r.id::text,to_jsonb(r),jsonb_build_object('source','administration'));
 return r;
end; $$;
revoke all on function public.admin_update_custom_role(uuid,text,text) from public;
grant execute on function public.admin_update_custom_role(uuid,text,text) to authenticated;

create or replace function public.admin_set_custom_role_status(p_custom_role_id uuid,p_is_active boolean)
returns public.custom_roles language plpgsql security definer set search_path=public as $$
declare actor_role public.gpcc_role; r public.custom_roles;
begin
 select role into actor_role from public.profiles where id=auth.uid() and status='Approved';
 if actor_role is distinct from 'Administrator' then raise exception 'Administrator privileges are required'; end if;
 update public.custom_roles set is_active=p_is_active, updated_at=now() where id=p_custom_role_id returning * into r;
 if not found then raise exception 'Custom role not found'; end if;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,new_data,metadata) values(auth.uid(),'UPDATE','custom_role',r.id::text,jsonb_build_object('is_active',r.is_active),jsonb_build_object('source','administration','operation','role_status'));
 return r;
end; $$;
revoke all on function public.admin_set_custom_role_status(uuid,boolean) from public;
grant execute on function public.admin_set_custom_role_status(uuid,boolean) to authenticated;

create or replace function public.admin_delete_custom_role(p_custom_role_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare actor_role public.gpcc_role; assigned integer;
begin
 select role into actor_role from public.profiles where id=auth.uid() and status='Approved';
 if actor_role is distinct from 'Administrator' then raise exception 'Administrator privileges are required'; end if;
 select count(*) into assigned from public.profiles where custom_role_id=p_custom_role_id;
 if assigned > 0 then raise exception 'Custom role is assigned to % user(s). Reassign them before deletion.', assigned; end if;
 delete from public.custom_roles where id=p_custom_role_id;
 if not found then raise exception 'Custom role not found'; end if;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(auth.uid(),'DELETE','custom_role',p_custom_role_id::text,jsonb_build_object('source','administration'));
 return true;
end; $$;
revoke all on function public.admin_delete_custom_role(uuid) from public;
grant execute on function public.admin_delete_custom_role(uuid) to authenticated;

create or replace function public.admin_set_custom_permission(p_custom_role_id uuid,p_module text,p_action text)
returns public.custom_role_permissions language plpgsql security definer set search_path=public as $$
declare actor_role public.gpcc_role; r public.custom_role_permissions;
begin
 select role into actor_role from public.profiles where id=auth.uid() and status='Approved';
 if actor_role is distinct from 'Administrator' then raise exception 'Administrator privileges are required'; end if;
 if not exists(select 1 from public.custom_roles where id=p_custom_role_id and is_active) then raise exception 'Custom role not found or inactive'; end if;
 insert into public.custom_role_permissions(custom_role_id,module,action) values(p_custom_role_id,trim(p_module),trim(p_action)) on conflict do nothing returning * into r;
 if r is null then select * into r from public.custom_role_permissions where custom_role_id=p_custom_role_id and module=trim(p_module) and action=trim(p_action); end if;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,new_data,metadata) values(auth.uid(),'GRANT','custom_role_permission',p_custom_role_id::text,jsonb_build_object('module',trim(p_module),'action',trim(p_action)),jsonb_build_object('source','administration'));
 return r;
end; $$;
revoke all on function public.admin_set_custom_permission(uuid,text,text) from public;
grant execute on function public.admin_set_custom_permission(uuid,text,text) to authenticated;

create or replace function public.admin_remove_custom_permission(p_custom_role_id uuid,p_module text,p_action text)
returns boolean language plpgsql security definer set search_path=public as $$
declare actor_role public.gpcc_role; existed boolean;
begin
 select role into actor_role from public.profiles where id=auth.uid() and status='Approved';
 if actor_role is distinct from 'Administrator' then raise exception 'Administrator privileges are required'; end if;
 select exists(select 1 from public.custom_role_permissions where custom_role_id=p_custom_role_id and module=trim(p_module) and action=trim(p_action)) into existed;
 delete from public.custom_role_permissions where custom_role_id=p_custom_role_id and module=trim(p_module) and action=trim(p_action);
 if existed then insert into public.audit_logs(actor_id,action,entity_type,entity_id,old_data,metadata) values(auth.uid(),'REVOKE','custom_role_permission',p_custom_role_id::text,jsonb_build_object('module',trim(p_module),'action',trim(p_action)),jsonb_build_object('source','administration')); end if;
 return existed;
end; $$;
revoke all on function public.admin_remove_custom_permission(uuid,text,text) from public;
grant execute on function public.admin_remove_custom_permission(uuid,text,text) to authenticated;

create or replace function public.admin_bulk_custom_role_permissions(p_custom_role_id uuid,p_mode text)
returns integer language plpgsql security definer set search_path=public as $$
declare actor_role public.gpcc_role; n integer := 0;
begin
 select role into actor_role from public.profiles where id=auth.uid() and status='Approved';
 if actor_role is distinct from 'Administrator' then raise exception 'Administrator privileges are required'; end if;
 if not exists(select 1 from public.custom_roles where id=p_custom_role_id and is_active) then raise exception 'Custom role not found or inactive'; end if;
 if p_mode='grant_all' then
  insert into public.custom_role_permissions(custom_role_id,module,action) select p_custom_role_id,x.module,x.action from (values
   ('dashboard','view'),('income','view'),('income','create'),('income','update'),('income','delete'),('expenses','view'),('expenses','create'),('expenses','update'),('expenses','delete'),('petty_cash','view'),('petty_cash','create'),('petty_cash','update'),('petty_cash','delete'),('bank_transfers','view'),('bank_transfers','create'),('bank_transfers','update'),('bank_transfers','delete'),('reports','view'),('excel','view'),('excel','import'),('admin','view'),('users','manage'),('bank_setup','manage'),('petty_cash_setup','manage'),('audit','view')) x(module,action) on conflict do nothing;
 elsif p_mode='remove_all' then delete from public.custom_role_permissions where custom_role_id=p_custom_role_id;
 elsif p_mode like 'copy_%' then
  delete from public.custom_role_permissions where custom_role_id=p_custom_role_id;
  insert into public.custom_role_permissions(custom_role_id,module,action)
  select p_custom_role_id,module,action from public.role_permissions where role=(case p_mode when 'copy_admin' then 'Administrator'::public.gpcc_role when 'copy_editor' then 'Editor'::public.gpcc_role else 'Member'::public.gpcc_role end);
 else raise exception 'Unsupported custom permission operation: %',p_mode; end if;
 get diagnostics n=row_count;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,new_data,metadata) values(auth.uid(),'PERMISSION_BULK','custom_role',p_custom_role_id::text,jsonb_build_object('mode',p_mode),jsonb_build_object('source','administration'));
 return n;
end; $$;
revoke all on function public.admin_bulk_custom_role_permissions(uuid,text) from public;
grant execute on function public.admin_bulk_custom_role_permissions(uuid,text) to authenticated;

-- Base-role permission validation is intentionally server-side; custom roles
-- are never allowed to override Administrator accounts.
commit;

-- V13 compatibility hardening: ensure the legacy four-argument profile RPC
-- cannot leave a custom role attached when promoting a user to Administrator.
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
  select role into actor_role from public.profiles where id = auth.uid() and status = 'Approved';
  if actor_role is distinct from 'Administrator' then raise exception 'Administrator privileges are required'; end if;
  if p_user_id = auth.uid() then raise exception 'For security, an administrator cannot change their own role or status'; end if;
  select * into target from public.profiles where id = p_user_id for update;
  if not found then raise exception 'User profile not found'; end if;
  if target.role = 'Administrator' and target.status = 'Approved'
     and (p_role <> 'Administrator' or p_status <> 'Approved') then
    select count(*) into admin_count from public.profiles where role='Administrator' and status='Approved';
    if admin_count <= 1 then raise exception 'The last approved Administrator cannot be removed'; end if;
  end if;
  update public.profiles
  set full_name=coalesce(nullif(trim(p_full_name),''),full_name),
      role=p_role,
      status=p_status,
      custom_role_id=case when p_role='Administrator' then null else custom_role_id end,
      updated_at=now()
  where id=p_user_id
  returning * into target;
  return target;
end;
$$;
revoke all on function public.admin_update_profile(uuid,text,public.gpcc_role,public.account_status) from public;
grant execute on function public.admin_update_profile(uuid,text,public.gpcc_role,public.account_status) to authenticated;

-- ================================================================
-- GPCC V15: EXCEL CENTRE AUDIT SUPPORT
-- ================================================================
begin;

create or replace function public.admin_log_event(
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare actor_role public.gpcc_role;
begin
  select role into actor_role from public.profiles where id=auth.uid() and status='Approved';
  if actor_role is distinct from 'Administrator' then
    raise exception 'Administrator privileges are required';
  end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),coalesce(p_action,'EVENT'),coalesce(p_entity_type,'SYSTEM'),p_entity_id,coalesce(p_metadata,'{}'::jsonb));
end;
$$;
revoke all on function public.admin_log_event(text,text,text,jsonb) from public;
grant execute on function public.admin_log_event(text,text,text,jsonb) to authenticated;

commit;
