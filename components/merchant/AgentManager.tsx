"use client";

import { useState } from "react";
import type { AgentUser } from "@/server/merchant/domain/merchant";

export default function AgentManager({
  initialAgents,
  role,
}: {
  initialAgents: AgentUser[];
  role: string;
}) {
  const [agents, setAgents] = useState<AgentUser[]>(initialAgents);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const canWrite = role === "owner" || role === "admin";
  const totalShops = agents.reduce((sum, a) => sum + (a.shopsCount || 0), 0);

  async function handleRegisterAgent(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password || loading) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/v1/merchant/agents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error?.message || "Could not register agent.");
      }

      setAgents([data.data.agent, ...agents]);
      setName("");
      setEmail("");
      setPassword("");
      setSuccess(`Agent ${data.data.agent.name} registered successfully! They can now sign in at /login`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      {/* Top Notice */}
      <div
        style={{
          background: "#ecfdf5",
          border: "1px solid #a7f3d0",
          borderRadius: "14px",
          padding: "1rem 1.25rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <strong style={{ color: "#065f46", fontSize: "0.9375rem", display: "block" }}>
            Field Sales &amp; Ground Onboarding Team
          </strong>
          <span style={{ color: "#047857", fontSize: "0.8125rem", marginTop: "2px", display: "block" }}>
            Field agents can onboard shops and bind QR standees using the fast mobile Field Portal (<code>/agent</code>). They cannot see your revenue, billing, or subscription data.
          </span>
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <span className="merchantPill" style={{ background: "#ffffff", borderColor: "#a7f3d0", color: "#065f46" }}>
            👥 {agents.length} Field Agents
          </span>
          <span className="merchantPill" style={{ background: "#ffffff", borderColor: "#a7f3d0", color: "#065f46" }}>
            🏬 {totalShops} Shops Onboarded
          </span>
        </div>
      </div>

      {/* Main Grid: Form on Left, Table on Right */}
      <div className="merchantFormGrid">
        {/* Register Agent Card */}
        {canWrite ? (
          <div className="merchantCard merchantFormCard">
            <h2>Register New Field Agent</h2>
            <p>Create login credentials for a sales representative to onboard client merchants in the market.</p>

            <form onSubmit={handleRegisterAgent}>
              <div className="merchantField">
                <label htmlFor="agentName">Agent Full Name</label>
                <input
                  id="agentName"
                  type="text"
                  placeholder="e.g. Rahul Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="merchantField">
                <label htmlFor="agentEmail">Login Work Email</label>
                <input
                  id="agentEmail"
                  type="email"
                  placeholder="e.g. rahul@agency.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="merchantField">
                <label htmlFor="agentPassword">Initial Password (min 8 chars)</label>
                <input
                  id="agentPassword"
                  type="password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>

              {error ? <div className="merchantError" role="alert">{error}</div> : null}
              {success ? (
                <div
                  style={{
                    marginTop: "12px",
                    padding: "10px 12px",
                    borderRadius: "10px",
                    background: "#ecfdf5",
                    color: "#065f46",
                    fontSize: "12px",
                  }}
                  role="status"
                >
                  {success}
                </div>
              ) : null}

              <div className="merchantFormActions">
                <button type="submit" className="merchantBtn" disabled={loading}>
                  {loading ? "Registering…" : "⚡ Register Field Agent"}
                </button>
              </div>
            </form>
          </div>
        ) : null}

        {/* Field Agent Portal Shortcut Card */}
        <div className="merchantCard merchantFormCard" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <h2>Agent Field Portal Preview</h2>
            <p>Field agents see an ultra-fast, mobile-friendly interface specifically designed for shop counters and street visits.</p>

            <div style={{ marginTop: "1rem", display: "grid", gap: "0.75rem" }}>
              <div style={{ padding: "0.75rem", borderRadius: "10px", background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <strong style={{ fontSize: "0.875rem", color: "#0f172a" }}>⚡ 10-Second Google Place Onboarding</strong>
                <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "#64748b" }}>
                  Agent searches business on Google Maps, taps result, and Place ID &amp; Review URL are automatically captured.
                </p>
              </div>

              <div style={{ padding: "0.75rem", borderRadius: "10px", background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <strong style={{ fontSize: "0.875rem", color: "#0f172a" }}>🔗 Immediate Standee Binding</strong>
                <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "#64748b" }}>
                  Pick from in-stock pre-printed standees or scan a physical standee to activate on the spot.
                </p>
              </div>

              <div style={{ padding: "0.75rem", borderRadius: "10px", background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <strong style={{ fontSize: "0.875rem", color: "#0f172a" }}>🔒 Data Privacy &amp; Security</strong>
                <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "#64748b" }}>
                  No access to agency margins, Razorpay billing, plans, or master database settings.
                </p>
              </div>
            </div>
          </div>

          <div style={{ marginTop: "1.25rem" }}>
            <a
              href="/agent"
              target="_blank"
              rel="noopener noreferrer"
              className="merchantBtn secondary"
              style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", textDecoration: "none" }}
            >
              Open Agent Portal (/agent) ↗
            </a>
          </div>
        </div>
      </div>

      {/* Agents Roster Table */}
      <div className="merchantCard merchantTableCard">
        <div className="merchantTableHead">
          <h2>Active Field Representatives ({agents.length})</h2>
        </div>

        {agents.length === 0 ? (
          <div className="merchantEmpty">
            No field agents registered yet. Use the form above to add your first sales agent.
          </div>
        ) : (
          <table className="merchantTable">
            <thead>
              <tr>
                <th>Agent Name</th>
                <th>Work Email</th>
                <th>Role</th>
                <th>Shops Deployed</th>
                <th>Status</th>
                <th>Joined Date</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((ag) => (
                <tr key={ag.id}>
                  <td>
                    <strong>{ag.name}</strong>
                  </td>
                  <td>{ag.email}</td>
                  <td>
                    <span className="merchantPill" style={{ fontSize: "11px", padding: "4px 8px" }}>
                      Field Agent
                    </span>
                  </td>
                  <td>
                    <strong style={{ color: ag.shopsCount > 0 ? "#059669" : "#64748b" }}>
                      {ag.shopsCount} {ag.shopsCount === 1 ? "shop" : "shops"}
                    </strong>
                  </td>
                  <td>
                    <span className="merchantStatus">
                      <span className="merchantStatusDot" /> Active
                    </span>
                  </td>
                  <td>
                    <small>{new Date(ag.createdAt).toLocaleDateString()}</small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
