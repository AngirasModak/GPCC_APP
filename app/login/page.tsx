"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  const login = async () => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setMsg(error?.message || "Login successful.");

    if (!error) {
      window.location.href = "/dashboard";
    }
  };

  const signup = async () => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    setMsg(
      error?.message ||
        "Signup submitted. Administrator approval is required."
    );
  };

  return (
    <div
      style={{
        maxWidth: 420,
        margin: "60px auto",
        background: "white",
        padding: 30,
        borderRadius: 12,
      }}
    >
      <h2>Secure Access</h2>

      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{
          width: "100%",
          padding: 10,
          marginBottom: 10,
          boxSizing: "border-box",
        }}
      />

      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{
          width: "100%",
          padding: 10,
          marginBottom: 15,
          boxSizing: "border-box",
        }}
      />

      <div>
        <button onClick={login}>
          Login
        </button>

        <button
          onClick={signup}
          style={{ marginLeft: 10 }}
        >
          Sign Up
        </button>
      </div>

      {msg && (
        <p style={{ marginTop: 15 }}>
          {msg}
        </p>
      )}
    </div>
  );
}