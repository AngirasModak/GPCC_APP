# GPCC Secure Login — V6

## Root cause fixed

V5 could still loop because middleware performed authorization redirects. In particular,
when the `has_permission('dashboard','view')` check returned false/error, `/dashboard`
was redirected back to `/dashboard`, creating `ERR_TOO_MANY_REDIRECTS`. A second possible
loop existed when an authenticated user was redirected to `/login` while the login page
immediately redirected approved users back to `/dashboard`.

## V6 architecture

- `/login` is completely outside the application shell.
- Middleware performs authentication only.
- Middleware redirects unauthenticated users to `/login`.
- Middleware never redirects an authenticated request based on role/permission.
- AppShell loads the authenticated user's own profile after authentication.
- AppShell renders financial children only when the profile is `Approved`.
- AppShell filters navigation by role.
- An unauthorized route renders a neutral access-denied gate rather than redirecting.
- Supabase RLS remains the database security boundary and blocks unauthorized data access.
- Logout returns to `/login`.

## Deployment

1. Deploy V6 as a new Vercel deployment.
2. Ensure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` exist in Production.
3. Redeploy with a fresh build.
4. Test in Incognito first.
5. If necessary, clear cookies for `gpcc-app.vercel.app` once before signing in.

No database migration is required for the redirect-loop correction itself.
