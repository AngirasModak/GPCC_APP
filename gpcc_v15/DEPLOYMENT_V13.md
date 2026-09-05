# GPCC V13 Deployment

## Vercel
Deploy the V13 project after the database migration succeeds. Keep the existing Supabase URL and publishable/anon key environment variables.

## Supabase production upgrade
Run the complete `supabase/admin_migration.sql` in a NEW SQL Editor query against the existing production database. Do not run `schema.sql` on the populated production database.

The migration adds:
- permission_catalog
- custom_roles
- custom_role_permissions
- profiles.custom_role_id
- custom-role CRUD/status RPCs
- bulk standard/custom permission RPCs
- effective-permission RPCs used by the application shell
- permission validation and audit events

## Validation
After the migration, run:

```sql
select to_regclass('public.custom_roles');
select to_regclass('public.custom_role_permissions');
select to_regclass('public.permission_catalog');
select to_regprocedure('public.get_my_permissions()');
select to_regprocedure('public.admin_create_custom_role(text,text,public.gpcc_role)');
```

Then log in as an approved Administrator and open `/admin`.
