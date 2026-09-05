# GPCC V11 Administration Production Fix

The current production error `column audit_logs.metadata does not exist` means the existing Supabase audit table predates the Administration console.

## Fix
Run `supabase/admin_migration.sql` from this package in a new Supabase SQL Editor query. V11 adds the missing `metadata` column and ensures the audit table's core columns/index exist.

The Administration UI also contains a compatibility fallback: it can load audit records without `metadata` while the migration is pending.

Do not run `schema.sql` against the populated production database.
