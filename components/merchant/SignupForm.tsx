"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/v1/merchant/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, businessName, email, password }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.success) {
        throw new Error(body?.error?.message || "Could not create your trial account.");
      }
      router.replace("/onboarding");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create your trial account.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="merchantField">
        <label htmlFor="signup-name">Your name</label>
        <input id="signup-name" autoComplete="name" value={name} onChange={(event)=>setName(event.target.value)} required />
      </div>
      <div className="merchantField">
        <label htmlFor="signup-business">Business name</label>
        <input id="signup-business" autoComplete="organization" value={businessName} onChange={(event)=>setBusinessName(event.target.value)} required />
      </div>
      <div className="merchantField">
        <label htmlFor="signup-email">Work email</label>
        <input id="signup-email" type="email" autoComplete="email" value={email} onChange={(event)=>setEmail(event.target.value)} required />
      </div>
      <div className="merchantField">
        <label htmlFor="signup-password">Password</label>
        <input id="signup-password" type="password" autoComplete="new-password" minLength={12} value={password} onChange={(event)=>setPassword(event.target.value)} required />
        <small>Use at least 12 characters.</small>
      </div>
      {error ? <div className="merchantError" role="alert">{error}</div> : null}
      <button className="merchantBtn" disabled={loading}>{loading ? "Creating trial…" : "Start 7-day free trial"}</button>
      <p className="merchantAuthSwitch">Already have an account? <Link href="/login">Sign in</Link></p>
      <p className="merchantAuthFinePrint">No card required for the trial. Your data stays available if the trial ends; write access pauses until you choose a plan.</p>
    </form>
  );
}
