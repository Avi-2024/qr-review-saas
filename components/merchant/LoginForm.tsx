"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/v1/merchant/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error?.message || "Could not sign in.");
      const nextPath = body.identity?.onboardingCompletedAt ? "/dashboard" : "/onboarding";
      router.replace(nextPath);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not sign in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="merchantField">
        <label htmlFor="email">Work email</label>
        <input id="email" type="email" autoComplete="email" value={email} onChange={(e)=>setEmail(e.target.value)} required />
      </div>
      <div className="merchantField">
        <label htmlFor="password">Password</label>
        <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e)=>setPassword(e.target.value)} required />
      </div>
      {error ? <div className="merchantError" role="alert">{error}</div> : null}
      <button className="merchantBtn" disabled={loading}>{loading ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}
