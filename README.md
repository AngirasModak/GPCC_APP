# GPCC Cultural Finance Portal — Secure Administration V8

V8 keeps the V6 authentication/authorization architecture and adds a production-ready Administration control centre.

## Important production migration
If the existing Supabase project was created before the Administration module, run:

`supabase/admin_migration.sql`

once in the Supabase SQL Editor. It adds/backfills `profiles.email`, installs the administrator profile-management RPC, and refreshes the profile RLS policy.

The Administration page is also migration-aware: if `profiles.email` is missing, it loads the rest of the page and displays a clear warning instead of failing with a blank/zero state.


## Existing-production database fix
If your existing Supabase database reports `function public.has_permission(unknown, unknown) does not exist` while running `supabase/admin_migration.sql`, use this V9 migration. It installs `current_role()` and `has_permission(text,text)` before creating the Administration RLS policy.

## Production database migration

For an existing GPCC/Supabase production database, use `supabase/admin_migration.sql` only. Do not use `supabase/schema.sql` as an upgrade script. See `supabase/PRODUCTION_REPAIR.md` for the exact sequence.
