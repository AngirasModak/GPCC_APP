# GPCC V21 — Flat Type Classification

## What changed
- Residential / Flat-House master now stores `flat_type` with controlled values `LIG`, `MIG`, `HIG`.
- Administration > Financial Masters > Flat / House Directory includes a dedicated **Flat Type** tab.
- New and edited residences require a Flat Type.
- Residential Excel import requires a valid Flat Type and supports the `Flat Type` column.
- Income > Add Income includes a **Flat Category** selector. Selecting LIG, MIG or HIG filters the Flat / House dropdown to only matching active residences.
- Changing the Flat Category clears an incompatible previously selected flat.

## Production migration
Run `supabase/admin_migration.sql` in a new Supabase SQL Editor query against the existing production database. Do not run `schema.sql` against a populated production database.

## Existing records
The migration deliberately leaves existing `flat_type` values NULL rather than guessing a classification. Existing residences will display as **Unclassified** in Administration until an Administrator edits them and selects LIG/MIG/HIG. They will not appear when a specific category is selected in the Income form until classified.

## Excel columns
Residential directory import now supports:
- Flat / House No.
- Flat Type (LIG/MIG/HIG)
- Owner Name
- Tenant Yes/No
- Tenant Name
