"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export function NotificationEmails({ initialEmails }: { initialEmails: string[] }) {
  const { getToken } = useAuth();
  const [emails, setEmails] = useState(initialEmails);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addEmail() {
    if (!input.includes("@")) {
      setError("Enter a valid email.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      const response = await fetch(`${API_BASE_URL}/admin/notification-emails`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: input.trim() }),
      });
      if (!response.ok) throw new Error("Failed to add email.");
      setEmails(await response.json());
      setInput("");
    } catch {
      setError("Failed to add email.");
    } finally {
      setBusy(false);
    }
  }

  async function removeEmail(email: string) {
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      const response = await fetch(`${API_BASE_URL}/admin/notification-emails/${encodeURIComponent(email)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to remove email.");
      setEmails(await response.json());
    } catch {
      setError("Failed to remove email.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-sky-100 bg-white shadow-sm p-5">
      <h2 className="text-sm font-semibold text-gray-700 mb-1">Notify on new signups</h2>
      <p className="text-xs text-gray-500 mb-3">
        These addresses get an email whenever someone new signs up and needs approval.
      </p>

      {emails.length > 0 && (
        <ul className="flex flex-col gap-1 mb-3">
          {emails.map((email) => (
            <li key={email} className="flex items-center justify-between gap-2 text-sm">
              <span>{email}</span>
              <button
                type="button"
                disabled={busy}
                onClick={() => removeEmail(email)}
                className="rounded-full bg-gray-100 text-gray-700 px-3 py-1 text-xs font-medium hover:bg-gray-200 transition-colors disabled:opacity-40 cursor-pointer"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <input
          type="email"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && addEmail()}
          placeholder="someone@example.com"
          className="flex-1 min-w-0 rounded-full border border-gray-200 px-4 py-1.5 text-sm focus:outline-none focus:border-sky-400"
        />
        <button
          type="button"
          disabled={busy || !input}
          onClick={addEmail}
          className="rounded-full bg-sky-600 text-white px-4 py-1.5 text-sm font-medium hover:bg-sky-700 transition-colors disabled:opacity-40 cursor-pointer"
        >
          Add
        </button>
      </div>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  );
}
