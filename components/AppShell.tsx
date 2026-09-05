"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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

function Gate({message}:{message?:string}){
  return <div className="auth-only"><div className="auth-brand"><h1>GREENWOOD PARK</h1><p>{message || "Secure Account Access"}</p></div></div>;
}

export default function AppShell({children}:{children:React.ReactNode}){
  const pathname=usePathname();
  const router=useRouter();
  const [ready,setReady]=useState(false);
  const [profile,setProfile]=useState<Profile|null>(null);
  const [email,setEmail]=useState("");

  useEffect(()=>{
    let active=true;
    const load=async()=>{
      const {data:{user}}=await supabase.auth.getUser();
      if(!active) return;
      if(!user){ setProfile(null); setEmail(""); setReady(true); return; }

      setEmail(user.email||"");
      const {data}=await supabase
        .from("profiles")
        .select("full_name,role,status")
        .eq("id",user.id)
        .maybeSingle();
      if(!active) return;
      setProfile(data as Profile|null);
      setReady(true);
    };

    load();
    const {data:listener}=supabase.auth.onAuthStateChange(()=>load());
    return ()=>{active=false; listener.subscription.unsubscribe();};
  },[]);

  // Never render the protected shell while the login route is active.
  // If an already-authenticated approved user reaches /login, redirect to
  // the dashboard without ever rendering the finance navigation around it.
  useEffect(()=>{
    if(!ready || pathname!=="/login") return;
    if(profile?.status==="Approved") router.replace("/dashboard");
  },[ready, pathname, profile, router]);

  const logout=async()=>{
    await supabase.auth.signOut();
    setProfile(null);
    setReady(false);
    router.replace("/login");
    router.refresh();
  };

  // /login is an isolated public account surface. The protected application
  // layout is NEVER mounted around it, even when a stale/active session exists.
  if(pathname==="/login"){
    if(!ready) return <Gate message="Loading secure account access…"/>;
    if(profile?.status==="Approved") return <Gate message="Authenticated — opening GPCC Finance…"/>;
    return <>{children}</>;
  }

  // Protected routes: middleware is the first line of defence; this client
  // gate prevents accidental UI exposure while the session/profile resolves.
  if(!ready) return <Gate message="Verifying secure account access…"/>;
  if(!profile || profile.status!=="Approved"){
    router.replace("/login");
    return <Gate message="Authentication required"/>;
  }

  const allowed=items.filter(i=>(i[3] as readonly string[]).includes(profile.role));
  const canViewRoute=allowed.some(i=>i[0]===pathname);
  if(!canViewRoute){
    router.replace("/dashboard");
    return <Gate message="Opening your authorized workspace…"/>;
  }

  return <div className="shell">
    <aside className="side"><div className="brand"><h1>GREENWOOD PARK</h1><p>Cultural Finance Portal</p></div>
      <nav className="nav">{allowed.map(([href,icon,label])=><Link key={href} href={href} style={pathname===href?{background:"#ffffff1c"}:{}}>{icon} <span>{label}</span></Link>)}</nav>
    </aside>
    <main className="main"><div className="topbar"><div><b>Greenwood Park Cultural Committee</b><div className="muted">Centralized Finance & Governance</div></div>
      <div className="account-area"><span className="role-badge">{profile.role}</span><span className="account-user">{profile.full_name||email}</span><button className="btn secondary" onClick={logout}>Logout</button></div>
    </div>{children}</main>
  </div>;
}
