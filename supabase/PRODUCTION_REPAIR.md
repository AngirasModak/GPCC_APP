# GPCC Production Database Repair

## Important

The existing GPCC production database is **not a fresh database**. Do not use `schema.sql` as an upgrade script against it.

Use:

`supabase/admin_migration.sql`

It is dependency ordered and creates `role_permissions` before the `has_permission()` function references it.

## Why the previous migration failed

The previous migration created `has_permission()` and its RLS policy while `public.role_permissions` was still missing. PostgreSQL therefore stopped with:

`ERROR: 42P01: relation "public.role_permissions" does not exist`

The earlier error:

`function public.has_permission(unknown, unknown) does not exist`

was the same dependency problem in the opposite direction: the function had not yet been created when the policy referenced it.

## Exact procedure

1. Open Supabase → SQL Editor → Production database.
2. Create a **new query**.
3. Paste the complete contents of `supabase/admin_migration.sql` from this version.
4. Run the whole script, not a selected fragment.
5. Confirm the result says the query completed successfully.
6. Then run the optional verification queries at the bottom, one at a time.
7. Refresh GPCC `/admin`.

Do not run `schema.sql` on the populated production database. `schema.sql` is for a fresh database only.

## Expected verification

This should return one row showing the function signature:

```sql
select to_regprocedure('public.has_permission(text,text)');
```

This should return the permission rows:

```sql
select * from public.role_permissions order by role, module, action;
```

And this should show the existing users:

```sql
select id, full_name, email, role, status, created_at
from public.profiles
order by created_at desc;
```
