# V32 Puja Dashboard Chart & Contributor Fix

## Changes
- Fixed the HIG / MIG / LIG chart so the left Y-axis has sufficient space and labels are not clipped.
- Added the explicit left Y-axis title: `Amount (₹)`.
- Added the explicit right Y-axis title: `No. of Flats`.
- Added compact Indian-currency axis tick formatting for readability.
- Added `Contributor Name` immediately after the `Owner` column in the Flat-Level Contribution Drill-down.
- Retained the contributor classification as a separate `Contributor Type` column (Owner/Tenant).
- Contributor Name is taken from the latest relevant payment for the dominant contributor source; for unpaid rows it falls back to the current tenant or owner name.
