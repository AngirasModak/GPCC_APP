# V22 — Residential Bulk Upload Fix

The residential Excel uploader now snapshots the selected workbook into an ArrayBuffer immediately when the file is chosen. This avoids browser local-file reference errors that can occur when a File object is retained and read later.

The picker also validates Excel extension and 10 MB size, shows the selected filename/size, and resets the native input after selection so the same file can be selected again.

No Supabase migration is required for this fix.
