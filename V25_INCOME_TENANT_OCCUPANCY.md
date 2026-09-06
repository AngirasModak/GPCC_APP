# V25 – Income Flat Category & Tenant Occupancy

## Changes

1. **Flat Category is mandatory before Flat / House No. selection**
   - Default placeholder: `Select Flat Category first`.
   - Flat / House No. dropdown remains disabled until LIG, MIG or HIG is selected.
   - Only active flats belonging to the selected category are listed.

2. **Tenant Occupied checkbox**
   - Available after a Flat Category is selected.
   - Unchecked (default): Flat options display `Flat No. — Owner Name`.
   - Checked: only active flats with a registered tenant are listed and options display `Flat No. — Tenant Name`.

3. **Automatic contributor update**
   - Selecting a flat populates Contributor Name with the owner name by default.
   - Selecting a flat in Tenant Occupied mode populates Contributor Name with the tenant name.
   - Switching the checkbox updates the contributor for the currently selected flat.

4. **Controlled reset behavior**
   - Changing Flat Category clears the selected flat and contributor to prevent category mismatch.
   - Switching to Tenant Occupied clears the current flat if it has no registered tenant.

No Supabase schema change is required for V25.
