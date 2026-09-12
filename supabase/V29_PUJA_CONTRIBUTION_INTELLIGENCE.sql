-- GPCC V29: Puja Contribution Intelligence
create table if not exists public.puja_contribution_policies (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  flat_type text not null check (flat_type in ('HIG','MIG','LIG')),
  standard_amount numeric(14,2) not null check (standard_amount >= 0),
  early_payment_discount numeric(14,2) not null default 0 check (early_payment_discount >= 0),
  discount_deadline date,
  is_active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_id, flat_type),
  check (early_payment_discount <= standard_amount)
);
alter table public.puja_contribution_policies enable row level security;
drop policy if exists puja_policy_select on public.puja_contribution_policies;
create policy puja_policy_select on public.puja_contribution_policies for select to authenticated using (true);
drop policy if exists puja_policy_write on public.puja_contribution_policies;
create policy puja_policy_write on public.puja_contribution_policies for all to authenticated
  using (public.has_permission('admin','view')) with check (public.has_permission('admin','view'));

-- Dashboard permission
insert into public.permission_catalog(module,action) values ('puja_contribution','view') on conflict do nothing;
insert into public.role_permissions(role,module,action) values
 ('Administrator','puja_contribution','view'),('Editor','puja_contribution','view'),('Member','puja_contribution','view') on conflict do nothing;

-- Optional backfill helper: grants dashboard users access to residential master if missing
-- Existing authenticated residential select policy is retained where already present.
drop policy if exists residential_units_puja_dashboard_select on public.residential_units;
create policy residential_units_puja_dashboard_select on public.residential_units for select to authenticated
  using (public.has_permission('puja_contribution','view') or public.has_permission('income','view') or public.has_permission('admin','view'));
