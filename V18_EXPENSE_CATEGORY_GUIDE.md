# GPCC V18 — Expense Category Master

## What changed
- Expenditure & TDS Category is now a controlled dropdown sourced from `public.expense_categories`.
- Administrators manage categories under **Administration → Financial Masters → Expense Categories**.
- Categories can be added, edited, reordered, activated, or archived.
- Archiving does not alter historical expenses; existing rows retain their category text.
- Category changes are recorded in the audit log.

## Production migration
Run `supabase/admin_migration.sql` in a new Supabase SQL Editor query against the existing production database. Do not run `schema.sql` on the populated production database.

## Default security
The new `category_setup:manage` permission is granted to Administrator only. Custom roles can be granted this permission through the Privilege Matrix after migration.
