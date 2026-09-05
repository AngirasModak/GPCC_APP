-- GPCC ADMINISTRATION HARDENING / MIGRATION
-- Run after the main schema.sql in Supabase SQL Editor.
-- This adds secure administrator profile-management RPC support.

alter table public.profiles add column if not exists email text;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,full_name,email,role,status)
  values(
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    new.email,
    'Member',
    'Pending'
  )
  on conflict (id) do update
    set email = coalesce(excluded.email, public.profiles.email),
        full_name = case when public.profiles.full_name = '' then excluded.full_name else public.profiles.full_name end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Backfill emails for rows that already exist.
-- This is intentionally done through the trigger path for future users; existing
-- users can be backfilled from a trusted SQL session if required.

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

-- Direct browser UPDATE access is removed. User administration must go through
-- the validated security-definer RPC above.
drop policy if exists profiles_admin_update on public.profiles;
revoke all on function public.admin_update_profile(uuid,text,public.gpcc_role,public.account_status) from public;
grant execute on function public.admin_update_profile(uuid,text,public.gpcc_role,public.account_status) to authenticated;
