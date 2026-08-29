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

export default function AppShell({children}:{children:React.ReactNode}){
  const pathname=usePathname(); const router=useRouter();
  const [ready,setReady]=useState(false); const [profile,setProfile]=useState<Profile|null>(null); const [email,setEmail]=useState("");

  useEffect(()=>{
    let active=true;
    const load=async()=>{
      const {data:{user}}=await supabase.auth.getUser();
      if(!active) return;
      if(!user){ setProfile(null); setReady(true); return; }
      setEmail(user.email||"");
      const {data}=await supabase.from("profiles").select("full_name,role,status").eq("id",user.id).maybeSingle();
      if(!active) return;
      setProfile(data as Profile|null); setReady(true);
    };
    load();
    const {data:listener}=supabase.auth.onAuthStateChange(()=>load());
    return ()=>{active=false; listener.subscription.unsubscribe();};
  },[]);

  const logout=async()=>{await supabase.auth.signOut(); router.replace("/login"); router.refresh();};

  // Unauthenticated and unapproved users see only the Account surface.
  if(!ready) return <div className="auth-only"><div className="auth-brand"><h1>GREENWOOD PARK</h1><p>Account</p></div></div>;
  if(!profile || profile.status!=="Approved"){
    if(pathname!=="/login") router.replace("/login");
    return <div className="auth-only"><div className="auth-brand"><h1>GREENWOOD PARK</h1><p>Secure Account Access</p></div>{children}</div>;
  }

  const allowed=items.filter(i=>(i[3] as readonly string[]).includes(profile.role));
  const isApplicationRoute=pathname!=="/login";
  const canViewRoute=pathname==="/dashboard" || allowed.some(i=>i[0]===pathname);
  if(isApplicationRoute && !canViewRoute) return <div className="auth-only"><div className="auth-brand"><h1>GREENWOOD PARK</h1><p>Access restricted</p><p className="muted">Your current privilege does not permit this section.</p></div></div>;
  return <div className="shell">
    <aside className="side"><div className="brand"><h1>GREENWOOD PARK</h1><p>Cultural Finance Portal</p></div>
      <nav className="nav">{allowed.map(([href,icon,label])=><Link key={href} href={href} style={pathname===href?{background:"#ffffff1c"}:{}}>{icon} <span>{label}</span></Link>)}</nav>
    </aside>
    <main className="main"><div className="topbar"><div><b>Greenwood Park Cultural Committee</b><div className="muted">Centralized Finance & Governance</div></div>
      <div className="account-area"><span className="role-badge">{profile.role}</span><span className="account-user">{profile.full_name||email}</span><button className="btn secondary" onClick={logout}>Logout</button></div>
    </div>{children}</main>
  </div>;
}
