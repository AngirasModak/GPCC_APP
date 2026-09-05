# GPCC Secure Login — V5 Deployment Fix

## What V5 fixes

The previous build could produce `ERR_TOO_MANY_REDIRECTS` on `/dashboard` because Supabase middleware may refresh the authentication session during `getUser()`, while the redirect returned a brand-new response that discarded the refreshed auth cookies.

V5:
- copies all Supabase auth cookies from the middleware response onto redirects;
- never calls `supabase.auth.signOut()` inside middleware;
- fails closed on permission RPC errors;
- keeps `/login` as the only public application surface;
- keeps the finance shell hidden until authentication + approval are complete.

## Vercel deployment

1. Deploy this V5 project.
2. Confirm `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are configured in Vercel for the Production environment.
3. Redeploy with a fresh build (do not reuse an old deployment).
4. Test first in an Incognito window.
5. If an old session still loops, clear cookies for `gpcc-app.vercel.app` once and sign in again.

No database migration is required for this particular redirect-loop fix; it uses the existing `profiles` and `has_permission` objects.
