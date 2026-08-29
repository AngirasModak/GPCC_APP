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

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookies) {
          cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  // /login is the only public application surface.
  if (path === "/login") {
    if (!user) return response;
    const { data: profile } = await supabase.from("profiles").select("status").eq("id", user.id).maybeSingle();
    if (profile?.status === "Approved") return NextResponse.redirect(new URL("/dashboard", request.url));
    return response;
  }

  // Every application/API operation requires a valid authenticated session.
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role,status")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.status !== "Approved") {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (path.startsWith("/api/")) return response;

  const permission = Object.entries(routePermissions).find(([route]) => path === route || path.startsWith(`${route}/`))?.[1];
  if (permission) {
    const { data: allowed } = await supabase.rpc("has_permission", {
      p_module: permission.module,
      p_action: permission.action,
    });
    if (!allowed) return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
