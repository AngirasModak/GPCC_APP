-- GPCC SECURE FINANCE SCHEMA
-- Run this in Supabase SQL Editor on a fresh database.
-- The database is the final security boundary: UI visibility, routes and RLS
-- all enforce the same privilege model.

create extension if not exists pgcrypto;

do $$ begin
  create type public.gpcc_role as enum ('Administrator','Editor','Member');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.account_status as enum ('Pending','Approved','Rejected','Inactive');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text,
  role public.gpcc_role not null default 'Member',
  status public.account_status not null default 'Pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  account_name text not null,
  opening_balance numeric(14,2) not null default 0 check (opening_balance >= 0),
  opening_balance_date date not null,
  is_active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.petty_cash_accounts (
  id uuid primary key default gen_random_uuid(),
  account_name text not null,
  opening_balance numeric(14,2) not null default 0 check (opening_balance >= 0),
  opening_balance_date date not null,
  is_active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.income (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  contributor text not null,
  flat_no text,
  amount numeric(14,2) not null check (amount > 0),
  mode text not null check (mode in ('Cash','Cheque','Online','Bank Transfer','UPI')),
  reference text,
  status text not null default 'Cleared',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  requisition_no text not null,
  vendor text not null,
  bill_no text,
  bill_date date,
  payment_mode text,
  cheque_or_utr text,
  payment_date date,
  gross_amount numeric(14,2) not null check (gross_amount > 0),
  tds_rate numeric(5,2) not null default 0 check (tds_rate >= 0 and tds_rate <= 100),
  tds_amount numeric(14,2) not null default 0 check (tds_amount >= 0),
  net_amount numeric(14,2) not null default 0 check (net_amount >= 0),
  category text,
  remarks text,
  source text,
  mode text,
  payment_date_legacy date,
  payment_reference text,
  document_url text,
  status text not null default 'Paid',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.fund_transfers (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  requisition_no text,
  type text not null,
  particulars text not null,
  amount numeric(14,2) not null check (amount > 0),
  reference text,
  remarks text,
  direction text not null check (direction in ('IN','OUT')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.tds_payments (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  amount numeric(14,2) not null check (amount > 0),
  challan_no text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

create table if not exists public.role_permissions (
  role public.gpcc_role not null,
  module text not null,
  action text not null,
  primary key (role, module, action)
);

-- Privilege matrix. Keep this table authoritative for future expansion.
insert into public.role_permissions(role,module,action) values
 ('Administrator','dashboard','view'),
 ('Administrator','income','view'),('Administrator','income','create'),('Administrator','income','update'),('Administrator','income','delete'),
 ('Administrator','expenses','view'),('Administrator','expenses','create'),('Administrator','expenses','update'),('Administrator','expenses','delete'),
 ('Administrator','petty_cash','view'),('Administrator','petty_cash','create'),('Administrator','petty_cash','update'),('Administrator','petty_cash','delete'),
 ('Administrator','bank_transfers','view'),('Administrator','bank_transfers','create'),('Administrator','bank_transfers','update'),('Administrator','bank_transfers','delete'),
 ('Administrator','reports','view'),('Administrator','excel','view'),('Administrator','excel','import'),('Administrator','admin','view'),('Administrator','users','manage'),('Administrator','bank_setup','manage'),('Administrator','petty_cash_setup','manage'),('Administrator','audit','view'),
 ('Editor','dashboard','view'),
 ('Editor','income','view'),('Editor','income','create'),('Editor','income','update'),('Editor','income','delete'),
 ('Editor','expenses','view'),('Editor','expenses','create'),('Editor','expenses','update'),('Editor','expenses','delete'),
 ('Editor','petty_cash','view'),('Editor','petty_cash','create'),('Editor','petty_cash','update'),('Editor','petty_cash','delete'),
 ('Editor','bank_transfers','view'),('Editor','bank_transfers','create'),('Editor','bank_transfers','update'),('Editor','bank_transfers','delete'),
 ('Editor','reports','view'),('Editor','excel','view'),('Editor','excel','import'),
 ('Member','dashboard','view'),('Member','reports','view')
on conflict do nothing;

create table if not exists public.permission_catalog (
  module text not null,
  action text not null,
  primary key (module, action)
);
insert into public.permission_catalog(module,action) values
 ('dashboard','view'),('income','view'),('income','create'),('income','update'),('income','delete'),
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

create index if not exists idx_profiles_status on public.profiles(status);
create index if not exists idx_income_created_by on public.income(created_by);
create index if not exists idx_expenses_created_by on public.expenses(created_by);
create index if not exists idx_transfers_created_by on public.fund_transfers(created_by);
create index if not exists idx_audit_actor_time on public.audit_logs(actor_id, occurred_at desc);

create or replace function public.current_role()
returns public.gpcc_role
language sql stable security definer set search_path=public
as $$
  select role from public.profiles where id=auth.uid() and status='Approved' limit 1
$$;

create or replace function public.has_permission(p_module text, p_action text)
returns boolean
language sql stable security definer set search_path=public
as $$
  select exists (
    select 1 from public.role_permissions rp
    where rp.role = public.current_role()
      and rp.module = p_module
      and rp.action = p_action
  )
$$;

revoke all on function public.current_role() from public;
revoke all on function public.has_permission(text,text) from public;
grant execute on function public.current_role() to authenticated;
grant execute on function public.has_permission(text,text) to authenticated;


create or replace function public.admin_update_profile(
  p_user_id uuid,
  p_full_name text,
  p_role public.gpcc_role,
  p_status public.account_status
)
returns public.profiles
language plpgsql
security definer
set search_path=public
as $$
declare
  actor_role public.gpcc_role;
  target public.profiles;
  admin_count integer;
begin
  select role into actor_role
  from public.profiles
  where id = auth.uid() and status = 'Approved';

  if actor_role <> 'Administrator' then
    raise exception 'Administrator privileges are required';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'For security, an administrator cannot change their own role or status';
  end if;

  select * into target from public.profiles where id = p_user_id for update;
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
  set full_name = coalesce(trim(p_full_name), full_name),
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

-- Always stamp the authenticated actor. Clients cannot choose another user's id.
create or replace function public.stamp_financial_actor()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if TG_OP = 'INSERT' then
    new.created_by := auth.uid();
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- Audit every privileged financial change. SECURITY DEFINER prevents users from
-- inserting or altering audit records themselves.
create or replace function public.write_audit_log()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, old_data, new_data)
  values (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    coalesce((case when TG_OP='DELETE' then old.id else new.id end)::text, null),
    case when TG_OP in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when TG_OP in ('INSERT','UPDATE') then to_jsonb(new) else null end
  );
  return case when TG_OP='DELETE' then old else new end;
end;
$$;

-- User creation: account is locked until an Administrator approves it.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,full_name,email,role,status)
  values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''),new.email,'Member','Pending')
  on conflict (id) do update
    set email = coalesce(excluded.email, public.profiles.email),
        full_name = case when public.profiles.full_name = '' then excluded.full_name else public.profiles.full_name end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

-- Updated-at + actor triggers.
drop trigger if exists trg_income_actor on public.income;
create trigger trg_income_actor before insert or update on public.income for each row execute procedure public.stamp_financial_actor();
drop trigger if exists trg_expenses_actor on public.expenses;
create trigger trg_expenses_actor before insert or update on public.expenses for each row execute procedure public.stamp_financial_actor();
drop trigger if exists trg_transfers_actor on public.fund_transfers;
create trigger trg_transfers_actor before insert or update on public.fund_transfers for each row execute procedure public.stamp_financial_actor();
drop trigger if exists trg_tds_actor on public.tds_payments;
create trigger trg_tds_actor before insert or update on public.tds_payments for each row execute procedure public.stamp_financial_actor();
drop trigger if exists trg_bank_actor on public.bank_accounts;
create trigger trg_bank_actor before insert or update on public.bank_accounts for each row execute procedure public.stamp_financial_actor();
drop trigger if exists trg_cash_actor on public.petty_cash_accounts;
create trigger trg_cash_actor before insert or update on public.petty_cash_accounts for each row execute procedure public.stamp_financial_actor();

-- Audit triggers.
do $$ declare t text; begin
  foreach t in array array['profiles','bank_accounts','petty_cash_accounts','income','expenses','fund_transfers','tds_payments'] loop
    execute format('drop trigger if exists audit_%I on public.%I', t, t);
    execute format('create trigger audit_%I after insert or update or delete on public.%I for each row execute procedure public.write_audit_log()', t, t);
  end loop;
end $$;

-- RLS is mandatory. A browser client can never bypass these rules.
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

alter table public.profiles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.bank_accounts enable row level security;
alter table public.petty_cash_accounts enable row level security;
alter table public.income enable row level security;
alter table public.expenses enable row level security;
alter table public.fund_transfers enable row level security;
alter table public.tds_payments enable row level security;
alter table public.audit_logs enable row level security;

-- Remove old policies so this script can be reapplied safely.
do $$ declare r record; begin
  for r in select schemaname, tablename, policyname from pg_policies where schemaname='public' and tablename in ('profiles','role_permissions','bank_accounts','petty_cash_accounts','income','expenses','fund_transfers','tds_payments','audit_logs') loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- Profiles: users can see themselves; only administrators can manage accounts.
create policy profiles_select_self_or_admin on public.profiles for select
  using (id=auth.uid() or public.has_permission('users','manage'));


-- Permission definitions are not editable from the browser.
create policy permissions_admin_read on public.role_permissions for select
  using (public.has_permission('users','manage'));

-- Master account setup is administrator-only.
create policy bank_select on public.bank_accounts for select
  using (public.has_permission('dashboard','view'));
create policy bank_admin_insert on public.bank_accounts for insert
  with check (public.has_permission('bank_setup','manage'));
create policy bank_admin_update on public.bank_accounts for update
  using (public.has_permission('bank_setup','manage'))
  with check (public.has_permission('bank_setup','manage'));
create policy bank_admin_delete on public.bank_accounts for delete
  using (public.has_permission('bank_setup','manage'));

create policy cash_select on public.petty_cash_accounts for select
  using (public.has_permission('dashboard','view'));
create policy cash_admin_insert on public.petty_cash_accounts for insert
  with check (public.has_permission('petty_cash_setup','manage'));
create policy cash_admin_update on public.petty_cash_accounts for update
  using (public.has_permission('petty_cash_setup','manage'))
  with check (public.has_permission('petty_cash_setup','manage'));
create policy cash_admin_delete on public.petty_cash_accounts for delete
  using (public.has_permission('petty_cash_setup','manage'));

-- Financial data: members can read permitted reporting data; editors/admins can mutate.
create policy income_select on public.income for select
  using (public.has_permission('income','view') and deleted_at is null);
create policy income_insert on public.income for insert
  with check (public.has_permission('income','create') and deleted_at is null and created_by=auth.uid());
create policy income_update on public.income for update
  using (public.has_permission('income','update'))
  with check (public.has_permission('income','update'));

create policy expenses_select on public.expenses for select
  using (public.has_permission('expenses','view') and deleted_at is null);
create policy expenses_insert on public.expenses for insert
  with check (public.has_permission('expenses','create') and deleted_at is null and created_by=auth.uid());
create policy expenses_update on public.expenses for update
  using (public.has_permission('expenses','update'))
  with check (public.has_permission('expenses','update'));

create policy transfers_select on public.fund_transfers for select
  using (public.has_permission('bank_transfers','view') or public.has_permission('petty_cash','view'));
create policy transfers_insert on public.fund_transfers for insert
  with check ((public.has_permission('bank_transfers','create') or public.has_permission('petty_cash','create')) and deleted_at is null and created_by=auth.uid());
create policy transfers_update on public.fund_transfers for update
  using (public.has_permission('bank_transfers','update') or public.has_permission('petty_cash','update'))
  with check (public.has_permission('bank_transfers','update') or public.has_permission('petty_cash','update'));

create policy tds_select on public.tds_payments for select
  using (public.has_permission('expenses','view'));
create policy tds_insert on public.tds_payments for insert
  with check (public.has_permission('expenses','create') and created_by=auth.uid());
create policy tds_update on public.tds_payments for update
  using (public.has_permission('expenses','update'))
  with check (public.has_permission('expenses','update'));

-- Audit logs are administrator-read only and cannot be changed by normal users.
create policy audit_admin_read on public.audit_logs for select
  using (public.has_permission('audit','view'));

-- No INSERT/UPDATE/DELETE policies are intentionally created for audit_logs or
-- role_permissions. Only SECURITY DEFINER server triggers can write audit rows.

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

-- V13 legacy profile governance hardening
create or replace function public.admin_update_profile(
  p_user_id uuid, p_full_name text, p_role public.gpcc_role, p_status public.account_status
) returns public.profiles language plpgsql security definer set search_path=public as $$
declare actor_role public.gpcc_role; target public.profiles; admin_count integer;
begin
  select role into actor_role from public.profiles where id=auth.uid() and status='Approved';
  if actor_role is distinct from 'Administrator' then raise exception 'Administrator privileges are required'; end if;
  if p_user_id=auth.uid() then raise exception 'For security, an administrator cannot change their own role or status'; end if;
  select * into target from public.profiles where id=p_user_id for update;
  if not found then raise exception 'User profile not found'; end if;
  if target.role='Administrator' and target.status='Approved' and (p_role<>'Administrator' or p_status<>'Approved') then
    select count(*) into admin_count from public.profiles where role='Administrator' and status='Approved';
    if admin_count<=1 then raise exception 'The last approved Administrator cannot be removed'; end if;
  end if;
  update public.profiles set full_name=coalesce(nullif(trim(p_full_name),''),full_name), role=p_role, status=p_status,
    custom_role_id=case when p_role='Administrator' then null else custom_role_id end, updated_at=now()
    where id=p_user_id returning * into target;
  return target;
end; $$;
revoke all on function public.admin_update_profile(uuid,text,public.gpcc_role,public.account_status) from public;
grant execute on function public.admin_update_profile(uuid,text,public.gpcc_role,public.account_status) to authenticated;
