# GPCC Excel Centre V17 UI Fix

## Changes
- Reworked Data Workspace / Reconciliation / Import History into a spaced, card-like tab bar with icons and subtitles.
- Increased spacing between Import Template, Validate Workbook, and Reconcile Workbook actions.
- Added clearer selection indicator for export sheets.
- Added date-range constraints to the Export form:
  - To date cannot be earlier than From date.
  - From date cannot be later than To date.
  - Changing one date automatically adjusts the other when necessary.
- Added client-side export validation and matching server-side validation so invalid ranges cannot be submitted directly to the API.
- Added responsive behavior for the new tab bar and section headers.

## Deployment
Use the project root contained in this package. No Supabase migration is required for these UI/date-range changes.
Keep the existing Supabase environment variables in Vercel.
