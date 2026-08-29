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
  insert into public.profiles(id,full_name,role,status)
  values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''),'Member','Pending')
  on conflict (id) do nothing;
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
create policy profiles_admin_update on public.profiles for update
  using (public.has_permission('users','manage'))
  with check (public.has_permission('users','manage'));

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
