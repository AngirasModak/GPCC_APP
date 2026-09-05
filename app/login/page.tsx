"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [signupMode, setSignupMode] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const checkExistingSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled || !session) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("status")
        .eq("id", session.user.id)
        .maybeSingle();
      if (!cancelled && profile?.status === "Approved") {
        window.location.replace("/dashboard");
      }
    };
    checkExistingSession();
    return () => { cancelled = true; };
  }, []);

  const login = async () => {
    setBusy(true);
    setMsg("");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setMsg(error.message);
      setBusy(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("status")
      .eq("id", data.user.id)
      .maybeSingle();

    if (profileError || profile?.status !== "Approved") {
      await supabase.auth.signOut();
      setMsg(profileError ? "Unable to verify account authorization. Please contact an administrator." : "Account is pending administrator approval. No application data is available until approval.");
      setBusy(false);
      return;
    }

    // Hard navigation deliberately avoids a stale Next.js client tree after auth.
    window.location.replace("/dashboard");
  };

  const signup = async () => {
    setBusy(true);
    setMsg("");
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) {
      setMsg(error.message);
      setBusy(false);
      return;
    }
    if (data.session) await supabase.auth.signOut();
    setMsg("Signup submitted. Your account will remain locked until an administrator approves it.");
    setBusy(false);
  };

  return (
    <div className="account-page">
      <div className="account-card">
        <div className="account-icon">🔐</div>
        <div className="eyebrow">SECURE ACCOUNT</div>
        <h2>{signupMode ? "Create Account" : "Sign in to GPCC Finance"}</h2>
        <p className="muted">No financial information is displayed before successful authentication and approval.</p>
        {signupMode && <input className="input" placeholder="Full name" value={fullName} onChange={e => setFullName(e.target.value)} />}
        <input className="input" type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} />
        <input className="input" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
        <button className="btn account-primary" disabled={busy} onClick={signupMode ? signup : login}>
          {busy ? "Authenticating…" : signupMode ? "Create account" : "Login"}
        </button>
        <button className="account-switch" onClick={() => { setSignupMode(!signupMode); setMsg(""); }}>
          {signupMode ? "Already have an account? Login" : "Need an account? Sign Up"}
        </button>
        {msg && <div className="auth-message">{msg}</div>}
      </div>
    </div>
  );
}
