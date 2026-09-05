# GPCC V16 — Excel Reconciliation & Import History

## Production database
Run `supabase/admin_migration.sql` in a new Supabase SQL Editor query against the existing production database. Do not run `schema.sql` against the populated database.

This migration adds `excel_import_history` plus the protected `record_excel_import()` function.

## New Excel Centre capabilities
- Workbook-to-database reconciliation
- Duplicate detection within workbook and against current database records
- Row and amount comparisons
- Downloadable validation error workbook
- Import history with status, row counts, file name, timestamp and sheets
- Audit event for completed/failed imports

## Vercel
Deploy the `gpcc_v16` directory as the project root and retain the existing Supabase environment variables.
