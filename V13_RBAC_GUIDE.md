# GPCC V13 — Advanced RBAC

V13 extends the Administration Centre with standard-role controls and custom roles.

## Features
- Grant All / Remove All / Reset Default for Administrator, Editor and Member.
- Individual permission toggles with confirmation on revocation.
- Custom roles with descriptions.
- Copy permissions from Administrator, Editor or Member into a custom role.
- Custom-role Grant All / Remove All.
- Assign custom roles to approved non-Administrator users from Users & Access.
- Effective permission count, enabled-module count and affected-user count.
- Critical Administrator controls remain protected.
- Permission changes and role operations are written to `audit_logs`.

## Production upgrade
1. Do **not** run `schema.sql` against the populated production database.
2. Run the complete `supabase/admin_migration.sql` in a new Supabase SQL Editor query.
3. Refresh GPCC.

## Important security model
A custom role is an effective permission profile. When assigned, it replaces the user's base role permissions. Custom roles cannot be attached to Administrator accounts. The database functions validate Administrator authority; browser writes to permission tables are not permitted.

## Recommended test
Create `Finance Reviewer` copied from Member, grant `income:view`, assign it to an approved non-Administrator test user, then confirm that the user sees Dashboard/Reports/Income only if those permissions are present. Revoke `income:view` and confirm the Income route and data access disappear.
