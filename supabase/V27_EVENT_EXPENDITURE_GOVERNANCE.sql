-- GPCC V27: Event/Campaign financial governance and expenditure accountability
-- Run after V26_INCOME_MASTERS_SPONSORSHIP.sql.

begin;

-- Enrich the shared Event / Campaign master.
alter table public.events add column if not exists event_type text;
alter table public.events add column if not exists budget numeric(14,2);
update public.events set event_type = coalesce(nullif(trim(event_type),''),'Other') where event_type is null or trim(event_type)='';
alter table public.events alter column event_type set default 'Other';
alter table public.events drop constraint if exists events_event_type_check;
alter table public.events add constraint events_event_type_check check (
  event_type in ('Puja','Cultural Event','Sponsorship','Fundraising','Community Activity','Maintenance / Administration','Other')
);
alter table public.events drop constraint if exists events_budget_check;
alter table public.events add constraint events_budget_check check (budget is null or budget >= 0);

-- Link expenditure to the same event/campaign master used by income.
alter table public.expenses add column if not exists event_id uuid references public.events(id) on delete set null;
alter table public.expenses add column if not exists responsible_person_id uuid references public.profiles(id) on delete set null;
alter table public.expenses add column if not exists responsible_person_name text;
alter table public.expenses add column if not exists beneficiary_pan text;

alter table public.expenses drop constraint if exists expenses_beneficiary_pan_check;
alter table public.expenses add constraint expenses_beneficiary_pan_check check (
  beneficiary_pan is null or beneficiary_pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'
);

create index if not exists idx_expenses_event_id on public.expenses(event_id);
create index if not exists idx_expenses_responsible_person_id on public.expenses(responsible_person_id);
create index if not exists idx_expenses_beneficiary_pan on public.expenses(beneficiary_pan);

-- Expense users also need read access to the shared event master.
drop policy if exists events_select on public.events;
create policy events_select on public.events for select to authenticated
using (
  public.has_permission('income','view')
  or public.has_permission('income','create')
  or public.has_permission('expenses','view')
  or public.has_permission('expenses','create')
  or (select role from public.profiles where id=auth.uid())='Administrator'
);

commit;
