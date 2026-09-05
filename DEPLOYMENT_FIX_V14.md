# GPCC V14 Deployment Fix

## Vercel build error fixed

The V13 Vercel build failed during TypeScript checking with:

`Property 'finally' does not exist on type 'PromiseLike<void>'`

The failing code was the custom-role permission checkbox handler in `app/admin/page.tsx`. Supabase's `.then()` chain is typed as `PromiseLike`, which does not expose `.finally()` under the current TypeScript definitions.

V14 replaces that chain with an explicit async IIFE using `try/catch/finally`, preserving the same behavior while satisfying TypeScript.

## Deployment

1. Deploy the contents of this project directory as the Vercel project root.
2. Keep the existing Vercel environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. No new Supabase migration is required solely for this TypeScript build fix.
4. The `middleware` deprecation message shown by Vercel is a warning, not the build failure. It can be migrated to the newer `proxy` convention separately after the deployment is stable.

## Database

Continue using the existing production database and the V13 administration migration already applied. Do not run `schema.sql` against the populated production database.
