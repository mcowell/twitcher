"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";

export interface HistoryIdentification {
  id: string;
  imageUrl: string;
  commonName: string;
  scientificName: string;
  isFictionalOrCostume: boolean;
  confidence: "low" | "medium" | "high";
  email: string | null;
  createdAt: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

const CONFIDENCE_STYLES: Record<HistoryIdentification["confidence"], string> = {
  high: "bg-green-100 text-green-800",
  medium: "bg-amber-100 text-amber-800",
  low: "bg-red-100 text-red-800",
};

export function HistoryGrid({
  initialIdentifications,
  pageSize,
}: {
  initialIdentifications: HistoryIdentification[];
  pageSize: number;
}) {
  const { getToken } = useAuth();
  const [items, setItems] = useState(initialIdentifications);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initialIdentifications.length === pageSize);
  const [message, setMessage] = useState<string | null>(null);

  const allSelected = items.length > 0 && selected.size === items.length;

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(items.map((item) => item.id)));
  }

  async function handleDelete() {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} identification(s)? This can't be undone.`)) return;

    setBusy(true);
    setMessage(null);
    try {
      const token = await getToken();
      const response = await fetch(`${API_BASE_URL}/admin/identifications/delete`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      if (!response.ok) throw new Error("Delete failed.");
      setItems((current) => current.filter((item) => !selected.has(item.id)));
      setSelected(new Set());
    } catch {
      setMessage("Failed to delete selected identifications.");
    } finally {
      setBusy(false);
    }
  }

  async function loadMore() {
    setLoadingMore(true);
    setMessage(null);
    try {
      const token = await getToken();
      const response = await fetch(
        `${API_BASE_URL}/admin/identifications?limit=${pageSize}&offset=${items.length}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!response.ok) throw new Error("Failed to load more.");
      const more: HistoryIdentification[] = await response.json();
      setItems((current) => [...current, ...more]);
      setHasMore(more.length === pageSize);
    } catch {
      setMessage("Failed to load more.");
    } finally {
      setLoadingMore(false);
    }
  }

  if (items.length === 0) {
    return <p className="text-gray-500">No identifications yet.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4" />
          Select all ({items.length})
        </label>
        <button
          type="button"
          disabled={busy || selected.size === 0}
          onClick={handleDelete}
          className="rounded-full bg-red-50 text-red-700 px-4 py-1.5 text-sm font-medium hover:bg-red-100 transition-colors disabled:opacity-40 cursor-pointer"
        >
          Delete selected ({selected.size})
        </button>
      </div>

      {message && <p className="text-sm text-gray-600">{message}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {items.map((item) => (
          <label
            key={item.id}
            className={`relative rounded-2xl border p-2 flex flex-col gap-1 cursor-pointer transition-colors ${
              selected.has(item.id) ? "border-sky-500 bg-sky-50" : "border-gray-200 bg-white hover:border-sky-300"
            }`}
          >
            <input
              type="checkbox"
              checked={selected.has(item.id)}
              onChange={() => toggle(item.id)}
              className="absolute top-3 left-3 h-4 w-4 z-10"
            />
            {/* eslint-disable-next-line @next/next/no-img-element -- signed Supabase URL, not worth next/image remote-origin config */}
            <img
              src={item.imageUrl}
              alt={item.commonName}
              className="w-full aspect-square object-cover rounded-lg"
            />
            <div className="flex items-center justify-between gap-1">
              <p className="text-xs font-medium truncate">
                {item.commonName}
                {item.isFictionalOrCostume && " 🎭"}
              </p>
              <span
                className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap ${CONFIDENCE_STYLES[item.confidence]}`}
              >
                {item.confidence}
              </span>
            </div>
            <p className="text-xs text-gray-400 truncate">{item.email ?? "unknown"}</p>
            {/* Plain ISO-date slice, not toLocaleDateString() — see admin-table.tsx */}
            <p className="text-xs text-gray-400">{item.createdAt.slice(0, 10)}</p>
          </label>
        ))}
      </div>

      {hasMore && (
        <button
          type="button"
          disabled={loadingMore}
          onClick={loadMore}
          className="self-center rounded-full bg-gray-100 text-gray-700 px-4 py-1.5 text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-40 cursor-pointer"
        >
          {loadingMore ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  );
}
