"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export function ShareToggle({
  id,
  initialIsPublic,
  adminOverride = false,
}: {
  id: string;
  initialIsPublic: boolean;
  // Uses the admin-scoped endpoint (no ownership check) so an admin can
  // curate what's public regardless of who originally uploaded it.
  adminOverride?: boolean;
}) {
  const { getToken } = useAuth();
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const endpoint = adminOverride
    ? `${API_BASE_URL}/admin/identifications/${id}/share`
    : `${API_BASE_URL}/identifications/${id}/share`;

  async function toggle() {
    const next = !isPublic;
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isPublic: next }),
      });
      if (!response.ok) throw new Error("Failed to update sharing.");
      setIsPublic(next);
    } catch {
      setError("Failed to update sharing.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" checked={isPublic} disabled={busy} onChange={toggle} className="h-4 w-4" />
        Share publicly
      </label>
      {isPublic && <span className="text-xs text-gray-400">Visible to anyone signed in on the Community page</span>}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
