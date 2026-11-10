"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export function StagedRetention({ initialDays }: { initialDays: number }) {
  const { getToken } = useAuth();
  const [savedDays, setSavedDays] = useState(initialDays);
  const [input, setInput] = useState(String(initialDays));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const parsed = Number(input);
  const valid = input.trim() !== "" && Number.isInteger(parsed) && parsed >= 0 && parsed <= 3650;

  async function save() {
    if (!valid) {
      setError("Enter a whole number of days from 0 to 3650.");
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const token = await getToken();
      const response = await fetch(`${API_BASE_URL}/admin/settings/staged-retention`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ days: parsed }),
      });
      if (!response.ok) throw new Error("Failed to save.");
      const { days } = await response.json();
      setSavedDays(days);
      setInput(String(days));
      setSaved(true);
    } catch {
      setError("Failed to save retention setting.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-sky-100 bg-white shadow-sm p-5">
      <h2 className="text-sm font-semibold text-gray-700 mb-1">Frigate queue retention</h2>
      <p className="text-xs text-gray-500 mb-3">
        {savedDays === 0
          ? "Unreviewed Frigate images are kept until you approve or delete them."
          : `Unreviewed Frigate images are deleted automatically ${savedDays} day${savedDays === 1 ? "" : "s"} after they arrive.`}{" "}
        Set to 0 to keep them forever. Approved identifications aren&apos;t affected.
      </p>

      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          max={3650}
          step={1}
          value={input}
          onChange={(event) => {
            setInput(event.target.value);
            setSaved(false);
          }}
          onKeyDown={(event) => event.key === "Enter" && save()}
          className="w-24 rounded-full border border-gray-200 px-4 py-1.5 text-sm focus:outline-none focus:border-sky-400"
        />
        <span className="text-sm text-gray-500">days</span>
        <button
          type="button"
          disabled={busy || !valid || parsed === savedDays}
          onClick={save}
          className="rounded-full bg-sky-600 text-white px-4 py-1.5 text-sm font-medium hover:bg-sky-700 transition-colors disabled:opacity-40 cursor-pointer"
        >
          Save
        </button>
        {saved && <span className="text-xs text-green-700">Saved</span>}
      </div>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  );
}
