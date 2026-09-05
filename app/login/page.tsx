"use client";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {supabase} from "../../lib/supabase";

export default function Login(){
 const router=useRouter(); const[email,setEmail]=useState(""); const[password,setPassword]=useState(""); const[fullName,setFullName]=useState("");
 const[signupMode,setSignupMode]=useState(false); const[msg,setMsg]=useState(""); const[busy,setBusy]=useState(false);
 useEffect(()=>{
  let active=true;
  supabase.auth.getUser().then(async({data:{user}})=>{
    if(!active || !user) return;
    const {data}=await supabase.from("profiles").select("status").eq("id",user.id).maybeSingle();
    if(active && data?.status==="Approved") router.replace("/dashboard");
  });
  return ()=>{active=false;};
},[router]);
 const login=async()=>{setBusy(true);setMsg(""); const{data,error}=await supabase.auth.signInWithPassword({email,password}); if(error){setMsg(error.message);setBusy(false);return;} const {data:profile}=await supabase.from("profiles").select("status").eq("id",data.user.id).maybeSingle(); if(profile?.status!=="Approved"){await supabase.auth.signOut();setMsg("Account is pending administrator approval. No application data is available until approval.");setBusy(false);return;} router.replace("/dashboard");router.refresh();};
 const signup=async()=>{setBusy(true);setMsg(""); const{data,error}=await supabase.auth.signUp({email,password,options:{data:{full_name:fullName}}}); if(error){setMsg(error.message);setBusy(false);return;} if(data.session) await supabase.auth.signOut(); setMsg("Signup submitted. Your account will remain locked until an administrator approves it.");setBusy(false);};
 return <div className="account-page"><div className="account-card">
   <div className="account-icon">🔐</div><div className="eyebrow">SECURE ACCOUNT</div><h2>{signupMode?"Create Account":"Sign in to GPCC Finance"}</h2><p className="muted">No financial information is displayed before successful authentication and approval.</p>
   {signupMode&&<input className="input" placeholder="Full name" value={fullName} onChange={e=>setFullName(e.target.value)}/>}<input className="input" type="email" placeholder="Email address" value={email} onChange={e=>setEmail(e.target.value)}/><input className="input" type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} />
   <button className="btn account-primary" disabled={busy} onClick={signupMode?signup:login}>{busy?"Please wait…":signupMode?"Create account":"Login"}</button>
   <button className="account-switch" onClick={()=>{setSignupMode(!signupMode);setMsg("")}}>{signupMode?"Already have an account? Login":"Need an account? Sign Up"}</button>
   {msg&&<div className="auth-message">{msg}</div>}
 </div></div>;
}
