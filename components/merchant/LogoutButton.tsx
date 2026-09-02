"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    try {
      await fetch("/api/v1/merchant/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <button className="merchantLogout" onClick={() => void logout()} disabled={loading}>
      {loading ? "Signing out…" : "Sign out"}
    </button>
  );
}
