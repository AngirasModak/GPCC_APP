"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Role = "Administrator" | "Editor" | "Member";
type Status = "Pending" | "Approved" | "Rejected" | "Inactive";
type Profile = { full_name: string; role: Role; status: Status };

const items = [
  ["/dashboard", "🏠", "Dashboard", ["Administrator", "Editor", "Member"]],
  ["/income", "💰", "Income & Subscription", ["Administrator", "Editor"]],
  ["/expenses", "💸", "Expenditure & TDS", ["Administrator", "Editor"]],
  ["/petty-cash", "💵", "Petty Cash", ["Administrator", "Editor"]],
  ["/bank-transfers", "🏦", "Bank & Transfers", ["Administrator", "Editor"]],
  ["/reports", "📊", "Reports & Analytics", ["Administrator", "Editor", "Member"]],
  ["/excel", "📁", "Excel Centre", ["Administrator", "Editor"]],
  ["/admin", "👥", "Administration", ["Administrator"]],
] as const;

function Gate({ message, action }: { message?: string; action?: React.ReactNode }) {
  return (
    <div className="auth-only">
      <div className="auth-brand">
        <h1>GREENWOOD PARK</h1>
        <p>{message || "Secure Account Access"}</p>
        {action}
      </div>
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled) return;

      if (!session) {
        setProfile(null);
        setEmail("");
        setReady(true);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("full_name,role,status")
        .eq("id", session.user.id)
        .maybeSingle();

      if (cancelled) return;

      setEmail(session.user.email || "");
      setProfile(error ? null : (data as Profile | null));
      setReady(true);
    };

    load();

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      // Schedule outside Supabase's auth lock. We deliberately re-read the
      // session/profile rather than doing database work inside the callback.
      setTimeout(() => {
        if (!cancelled) load();
      }, 0);
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    // Return to the isolated Account surface after the session is cleared.
    await supabase.auth.signOut();
    window.location.replace("/login");
  };

  // /login is NEVER wrapped in the finance shell. This is the critical privacy
  // boundary: before authentication, only Account/Login/Signup can be shown.
  if (pathname === "/login") {
    return <>{children}</>;
  }

  // Do not render any protected child page until the auth/profile decision is
  // complete. This prevents financial components from mounting prematurely.
  if (!ready) {
    return <Gate message="Verifying secure account access…" />;
  }

  if (!profile || profile.status !== "Approved") {
    return <Gate message="Authentication and administrator approval are required." />;
  }

  const allowed = items.filter((item) =>
    (item[3] as readonly string[]).includes(profile.role)
  );
  const canViewRoute = allowed.some(([href]) => href === pathname);

  // Never redirect an unauthorized route to itself. Showing a neutral access
  // gate avoids redirect loops while exposing no financial data.
  if (!canViewRoute) {
    return (
      <Gate
        message="You do not have permission to view this section."
        action={
          <Link className="btn secondary" href="/dashboard" style={{ marginTop: 16 }}>
            Return to Dashboard
          </Link>
        }
      />
    );
  }

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <h1>GREENWOOD PARK</h1>
          <p>Cultural Finance Portal</p>
        </div>
        <nav className="nav">
          {allowed.map(([href, icon, label]) => (
            <Link
              key={href}
              href={href}
              style={pathname === href ? { background: "#ffffff1c" } : {}}
            >
              {icon} <span>{label}</span>
            </Link>
          ))}
        </nav>
      </aside>

      <main className="main">
        <div className="topbar">
          <div>
            <b>Greenwood Park Cultural Committee</b>
            <div className="muted">Centralized Finance & Governance</div>
          </div>
          <div className="account-area">
            <span className="role-badge">{profile.role}</span>
            <span className="account-user">{profile.full_name || email}</span>
            <button className="btn secondary" onClick={logout}>
              Logout
            </button>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
