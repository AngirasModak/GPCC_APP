# GPCC V26 — Income Masters & Sponsorship

## New functionality
- Controlled Income Type dropdown.
- Cascading Income Category dropdown.
- Flat / House selection only for categories marked `requires_flat`.
- Sponsorship is a first-class Income Type.
- Sponsorship categories include Title, Co-, Gold, Silver, Bronze, Event and Advertisement Sponsor.
- Contributor Source supports Resident, External Individual and Organisation / Company.
- Optional Event / Campaign linkage.
- Sponsorship-specific contact and benefit fields.
- Administration → Financial Masters now manages Income Types, Income Categories and Events / Campaigns.

## Required Supabase migration
Run:

`supabase/V26_INCOME_MASTERS_SPONSORSHIP.sql`

in Supabase SQL Editor before using V26.

## Income flow
Income Type → Income Category → conditional contributor/residential fields → amount → receipt → status.

For categories with `Requires Flat / House` enabled, the user must select:
1. Flat Category (LIG/MIG/HIG)
2. Optional Tenant Occupied checkbox
3. Flat / House No.

When Tenant Occupied is checked, only tenant-occupied units are offered and the tenant name is used as contributor.
