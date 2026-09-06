-- GPCC V26: Income Masters, Sponsorship and Event Linkage
-- Run this file in Supabase SQL Editor after the existing GPCC schema.

begin;

create table if not exists public.income_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.income_categories (
  id uuid primary key default gen_random_uuid(),
  income_type_id uuid not null references public.income_types(id) on delete restrict,
  name text not null,
  description text,
  requires_flat boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(income_type_id, name)
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  start_date date,
  end_date date,
  is_active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.income add column if not exists income_type_id uuid references public.income_types(id) on delete restrict;
alter table public.income add column if not exists income_category_id uuid references public.income_categories(id) on delete restrict;
alter table public.income add column if not exists contributor_source text;
alter table public.income add column if not exists event_id uuid references public.events(id) on delete set null;
alter table public.income add column if not exists contact_person text;
alter table public.income add column if not exists contact_mobile text;
alter table public.income add column if not exists contact_email text;
alter table public.income add column if not exists sponsor_benefit_details text;

create index if not exists idx_income_type_id on public.income(income_type_id);
create index if not exists idx_income_category_id on public.income(income_category_id);
create index if not exists idx_income_event_id on public.income(event_id);

alter table public.income_types enable row level security;
alter table public.income_categories enable row level security;
alter table public.events enable row level security;

drop policy if exists income_types_select on public.income_types;
create policy income_types_select on public.income_types for select to authenticated
using (public.has_permission('income','view') or (select role from public.profiles where id=auth.uid())='Administrator');

drop policy if exists income_types_write on public.income_types;
create policy income_types_write on public.income_types for all to authenticated
using ((select role from public.profiles where id=auth.uid())='Administrator')
with check ((select role from public.profiles where id=auth.uid())='Administrator');

drop policy if exists income_categories_select on public.income_categories;
create policy income_categories_select on public.income_categories for select to authenticated
using (public.has_permission('income','view') or (select role from public.profiles where id=auth.uid())='Administrator');

drop policy if exists income_categories_write on public.income_categories;
create policy income_categories_write on public.income_categories for all to authenticated
using ((select role from public.profiles where id=auth.uid())='Administrator')
with check ((select role from public.profiles where id=auth.uid())='Administrator');

drop policy if exists events_select on public.events;
create policy events_select on public.events for select to authenticated
using (public.has_permission('income','view') or (select role from public.profiles where id=auth.uid())='Administrator');

drop policy if exists events_write on public.events;
create policy events_write on public.events for all to authenticated
using ((select role from public.profiles where id=auth.uid())='Administrator')
with check ((select role from public.profiles where id=auth.uid())='Administrator');

insert into public.income_types(name, description, is_active, sort_order)
values
('Subscription / Maintenance','Regular residential contributions and maintenance collections',true,10),
('Puja Contribution','Contributions collected for puja activities',true,20),
('Donation','General or earmarked voluntary donations',true,30),
('Sponsorship','Business, organisation or individual sponsorships',true,40),
('Event Contribution','Contributions linked to a specific event or programme',true,50),
('Rental Income','Income from rentable GPCC facilities or assets',true,60),
('Interest Income','Interest credited by bank or investment accounts',true,70),
('Other Income','Controlled catch-all income classification',true,90)
on conflict (name) do nothing;

insert into public.income_categories(income_type_id,name,description,requires_flat,is_active,sort_order)
select id, v.name, v.description, v.requires_flat, true, v.sort_order
from public.income_types t
join (values
('Subscription / Maintenance','Monthly Maintenance','Regular monthly maintenance collection',true,10),
('Subscription / Maintenance','Quarterly Maintenance','Quarterly maintenance collection',true,20),
('Subscription / Maintenance','Annual Maintenance','Annual maintenance collection',true,30),
('Puja Contribution','Durga Puja','Contribution for Durga Puja',false,10),
('Puja Contribution','Kali Puja','Contribution for Kali Puja',false,20),
('Puja Contribution','Saraswati Puja','Contribution for Saraswati Puja',false,30),
('Puja Contribution','Other Puja','Contribution for another puja',false,90),
('Donation','General Donation','General voluntary donation',false,10),
('Donation','Corpus Fund','Donation earmarked for corpus',false,20),
('Donation','Special Contribution','Donation for a special purpose',false,30),
('Sponsorship','Title Sponsor','Principal event sponsor',false,10),
('Sponsorship','Co-Sponsor','Co-sponsorship contribution',false,20),
('Sponsorship','Gold Sponsor','Gold sponsorship tier',false,30),
('Sponsorship','Silver Sponsor','Silver sponsorship tier',false,40),
('Sponsorship','Bronze Sponsor','Bronze sponsorship tier',false,50),
('Sponsorship','Event Sponsor','General event sponsorship',false,60),
('Sponsorship','Advertisement Sponsor','Advertisement or branding sponsorship',false,70),
('Sponsorship','Other Sponsorship','Other sponsorship arrangement',false,90)
) as v(type_name,name,description,requires_flat,sort_order) on t.name=v.type_name
on conflict (income_type_id,name) do nothing;

commit;
