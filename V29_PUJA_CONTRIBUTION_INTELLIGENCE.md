# GPCC V29 — Puja Contribution Intelligence

## Included
- Dedicated navigation: **Puja Contribution Intelligence**
- Event-level analytics, defaulting to Durga Puja 2026 when present
- HIG / MIG / LIG collection comparison
- Owner vs Tenant contribution analysis
- Multiple-flat owner aggregation and priority list
- Per-flat standard contribution amount
- Configurable early-payment discount and deadline per HIG/MIG/LIG
- Gross expected, discount availed, net expected, collected and outstanding KPIs
- Paid / Partial / Unpaid flat status
- Flat-level drill-down

## Database deployment
Run `supabase/V29_PUJA_CONTRIBUTION_INTELLIGENCE.sql` in Supabase SQL Editor before deploying the application.

## Discount rule implemented
A flat avails the configured discount when:
1. A discount deadline is configured.
2. Its first recorded payment is on or before that deadline.
3. Total payment is at least the discounted payable amount (`standard_amount - early_payment_discount`).

The policy is configurable per event and flat type.
