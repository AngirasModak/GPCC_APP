"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Role = "Administrator" | "Editor" | "Member";
type Profile = { full_name: string; role: Role; status: "Pending"|"Approved"|"Rejected"|"Inactive" };
const items = [
  ["/dashboard","🏠","Dashboard",["Administrator","Editor","Member"]],
  ["/income","💰","Income & Subscription",["Administrator","Editor"]],
  ["/expenses","💸","Expenditure & TDS",["Administrator","Editor"]],
  ["/petty-cash","💵","Petty Cash",["Administrator","Editor"]],
  ["/bank-transfers","🏦","Bank & Transfers",["Administrator","Editor"]],
  ["/reports","📊","Reports & Analytics",["Administrator","Editor","Member"]],
  ["/excel","📁","Excel Centre",["Administrator","Editor"]],
  ["/admin","👥","Administration",["Administrator"]],
] as const;

function Gate({message}:{message?:string}) {
  return <div className="auth-only"><div className="auth-brand"><h1>GREENWOOD PARK</h1><p>{message || "Secure Account Access"}</p></div></div>;
}

export default function AppShell({children}:{children:React.ReactNode}) {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<Profile|null>(null);
  const [email, setEmail] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async (userId: string, userEmail?: string) => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name,role,status")
        .eq("id", userId)
        .maybeSingle();
      if (cancelled) return;
      setEmail(userEmail || "");
      setProfile(error ? null : (data as Profile|null));
      setReady(true);
    };

    const bootstrap = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session) {
        setProfile(null);
        setEmail("");
        setReady(true);
        return;
      }
      setReady(false);
      await loadProfile(session.user.id, session.user.email);
    };

    bootstrap();

    // Do not call Supabase APIs directly inside onAuthStateChange. Supabase
    // holds an internal auth lock during callbacks; doing so can deadlock the UI.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => {
        if (cancelled) return;
        if (!session) {
          setProfile(null);
          setEmail("");
          setReady(true);
        } else {
          setReady(false);
          loadProfile(session.user.id, session.user.email);
        }
      }, 0);
    });

    return () => { cancelled = true; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (pathname !== "/login" || !ready || profile?.status !== "Approved") return;
    window.location.replace("/dashboard");
  }, [pathname, ready, profile]);

  const logout = async () => {
    await supabase.auth.signOut();
    window.location.replace("/login");
  };

  // The login route is never rendered inside the protected finance shell.
  if (pathname === "/login") {
    if (!ready) return <Gate message="Verifying secure account access…" />;
    if (profile?.status === "Approved") return <Gate message="Authenticated — opening GPCC Finance…" />;
    return <>{children}</>;
  }

  if (!ready) return <Gate message="Verifying secure account access…" />;
  if (!profile || profile.status !== "Approved") {
    return <Gate message="Authentication required" />;
  }

  const allowed = items.filter(i => (i[3] as readonly string[]).includes(profile.role));
  const canViewRoute = allowed.some(i => i[0] === pathname);
  if (!canViewRoute) {
    return <Gate message="Opening your authorized workspace…" />;
  }

  return <div className="shell">
    <aside className="side"><div className="brand"><h1>GREENWOOD PARK</h1><p>Cultural Finance Portal</p></div>
      <nav className="nav">{allowed.map(([href,icon,label]) => <Link key={href} href={href} style={pathname===href?{background:"#ffffff1c"}:{}}>{icon} <span>{label}</span></Link>)}</nav>
    </aside>
    <main className="main"><div className="topbar"><div><b>Greenwood Park Cultural Committee</b><div className="muted">Centralized Finance & Governance</div></div>
      <div className="account-area"><span className="role-badge">{profile.role}</span><span className="account-user">{profile.full_name||email}</span><button className="btn secondary" onClick={logout}>Logout</button></div>
    </div>{children}</main>
  </div>;
}
