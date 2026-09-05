# V20 — Residential Directory

Adds a controlled Flat / House master for GPCC Income.

## Features
- Flat / House No. dropdown in Income
- Owner Name master
- Tenant Yes/No occupancy tab
- Conditional Tenant Name
- Bulk Excel import with preview and commit
- Downloadable import template
- Active/archive control
- Tenant/owner information is retained in the master while historical income rows remain unchanged

## Production migration
Run `supabase/admin_migration.sql` in a new Supabase SQL Editor query against the existing production database. Do not run `schema.sql` against an existing populated database.
