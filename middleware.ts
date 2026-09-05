import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";

const routePermissions: Record<string, { module: string; action: string }> = {
  "/dashboard": { module: "dashboard", action: "view" },
  "/income": { module: "income", action: "view" },
  "/expenses": { module: "expenses", action: "view" },
  "/petty-cash": { module: "petty_cash", action: "view" },
  "/bank-transfers": { module: "bank_transfers", action: "view" },
  "/reports": { module: "reports", action: "view" },
  "/excel": { module: "excel", action: "view" },
  "/admin": { module: "admin", action: "view" },
};

/**
 * Preserve any refreshed Supabase auth cookies when middleware redirects.
 * Returning a brand-new redirect response without these cookies can cause
 * Vercel/Next.js/Supabase to bounce between /login and /dashboard forever.
 */
function redirectWithAuthCookies(request: NextRequest, source: NextResponse, path: string) {
  const target = new URL(path, request.url);
  const redirect = NextResponse.redirect(target);
  source.cookies.getAll().forEach((cookie) => {
    redirect.cookies.set(cookie);
  });
  return redirect;
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request: { headers: request.headers } });
  const path = request.nextUrl.pathname;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookies) {
          cookies.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // getUser() validates the JWT and also lets Supabase refresh an expired
  // session. The refreshed cookies are copied onto every redirect below.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // /login is the ONLY public application route.
  if (path === "/login") {
    if (!user) return response;

    const { data: profile } = await supabase
      .from("profiles")
      .select("status")
      .eq("id", user.id)
      .maybeSingle();

    // An already-approved session never sees the login form.
    if (profile?.status === "Approved") {
      return redirectWithAuthCookies(request, response, "/dashboard");
    }

    // Pending/rejected/inactive users remain on the isolated account page.
    return response;
  }

  // Every protected page/API route requires an authenticated session.
  if (!user) {
    return redirectWithAuthCookies(request, response, "/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role,status")
    .eq("id", user.id)
    .maybeSingle();

  // Do NOT sign out from middleware. Signing out here can mutate the auth
  // cookie while the response is being redirected and create redirect loops.
  if (profile?.status !== "Approved") {
    return redirectWithAuthCookies(request, response, "/login");
  }

  // API authentication is enforced above. Individual API handlers enforce
  // their own operation-level privilege checks.
  if (path.startsWith("/api/")) return response;

  const permission = Object.entries(routePermissions).find(
    ([route]) => path === route || path.startsWith(`${route}/`)
  )?.[1];

  if (permission) {
    const { data: allowed, error } = await supabase.rpc("has_permission", {
      p_module: permission.module,
      p_action: permission.action,
    });

    // Fail closed: an RPC error is never treated as permission granted.
    if (error || !allowed) {
      return redirectWithAuthCookies(request, response, "/dashboard");
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
