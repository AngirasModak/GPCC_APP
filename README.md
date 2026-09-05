# GPCC Cultural Finance Portal — Secure V6

The portal uses a strict authentication-first experience:

`Account/Login/Signup → Authentication → Approved profile → Role privileges → Finance application`

Before approval, the finance application shell and financial data are not rendered.
Database RLS remains the final authorization boundary.

See `DEPLOYMENT_FIX_V6.md` and `SECURITY_MODEL.md` for details.
