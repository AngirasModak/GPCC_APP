# GPCC V23 — Residential Bulk Import Fix

## What was fixed
- Fixed the Excel header normalization bug where `Flat / House No.` became `flathouseno` but the parser only accepted `flatno`/`houseno` aliases.
- Added robust aliases for Flat / House No., Flat Type, Owner Name, Unit Number and related headings.
- Improved error messages when data is missing in individual rows.
- Redesigned the residential bulk import panel with a controlled four-step workflow: Select → Validate → Review → Import.
- Added clearer file-ready status, template action, validation action and review summary.
- Existing LIG/MIG/HIG, tenant and secure RPC behavior is retained.

## Database
No new database migration is required for the parser/UI fix. The existing V21/V22 residential migration remains compatible.

## Important
Deploy the V23 project root. Do not run `schema.sql` against the populated production database.
