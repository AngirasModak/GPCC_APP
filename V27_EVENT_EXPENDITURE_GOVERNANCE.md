# GPCC V27 – Event & Expenditure Governance

## What is included
- Shared Event / Campaign master enriched with Type and optional Budget.
- Income and Expenditure use the same Event / Campaign master.
- Expenditure now captures Responsible Person Handling Expense.
- Expenditure now captures PAN of Payee / Beneficiary with uppercase validation.
- Event linkage supports event-wise income vs expenditure reporting.
- Expense category remains centrally managed from Administration.

## Database deployment
1. Run the existing `supabase/V26_INCOME_MASTERS_SPONSORSHIP.sql` if it has not already been run.
2. Run `supabase/V27_EVENT_EXPENDITURE_GOVERNANCE.sql`.
3. Deploy this application build.

## Important
Run database migrations before deploying the UI so the new Event and Expense fields exist.
