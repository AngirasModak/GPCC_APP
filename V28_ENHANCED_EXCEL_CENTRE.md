# GPCC V28 — Enhanced Excel Centre

This package enhances the Excel Centre UI and keeps the existing controlled import/export workflow intact.

## What changed
- Premium Excel Centre hero and operational summary cards
- Clear Upload → Validate → Commit workflow rail
- Drag-and-drop Excel upload area with selected-file state
- Improved dataset selection cards for all supported financial sheets
- Stronger visual validation and error-review state
- Reconciliation workspace with selected workbook context
- Improved import-history presentation and status treatment
- Responsive layout for desktop and smaller screens
- Updated import template example columns for:
  - Income sponsorship/event metadata
  - Expense event linkage
  - Responsible person name
  - Beneficiary PAN

## Important compatibility note
The existing backend still governs which sheet names are supported and which columns are validated. The enhanced template preserves the current six supported import sheets:
Income, Expenses, Fund Transfers, TDS Payments, Bank Accounts and Petty Cash Accounts.

For linked fields such as `income_type_id`, `income_category_id` and `event_id`, use the UUID values from the corresponding GPCC masters when performing a direct Excel import.

## Files changed
- `app/excel/page.tsx`
- `app/globals.css`

No Supabase schema changes are required for this UI enhancement.
