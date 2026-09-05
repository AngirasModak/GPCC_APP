# GPCC Administration — V9 database migration fix

The error shown in Supabase:

`ERROR: 42883: function public.has_permission(unknown, unknown) does not exist`

means the existing production database has the `profiles` table but does not have the `public.has_permission(text,text)` helper function that the new Administration RLS policy references.

## What V9 changes

The migration now creates/replaces these helpers **before** creating the policy:

- `public.current_role()`
- `public.has_permission(text, text)`

It then creates the Administration profile policy.

## What to do

1. Open Supabase → SQL Editor.
2. Replace the old migration SQL with the contents of `supabase/admin_migration.sql` from V9.
3. Run the complete script from the beginning.
4. Confirm the query completes with `Success. No rows returned` (or equivalent).
5. Refresh `/admin` in GPCC.

The migration is intended to be safe to re-run.
