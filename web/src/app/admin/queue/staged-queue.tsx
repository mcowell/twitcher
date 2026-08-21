"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";

export interface StagedImage {
  id: string;
  imageUrl: string;
  camera?: string;
  eventId?: string;
  score?: number;
  createdAt: string;
}

interface ApproveResult {
  id: string;
  ok: boolean;
  isBird?: boolean;
  error?: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export function StagedQueue({ initialImages }: { initialImages: StagedImage[] }) {
  const { getToken } = useAuth();
  const [images, setImages] = useState(initialImages);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const allSelected = images.length > 0 && selected.size === images.length;

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(images.map((image) => image.id)));
  }

  async function handleDelete() {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} image(s)? This can't be undone, and doesn't call Claude.`)) return;

    setBusy(true);
    setMessage(null);
    try {
      const token = await getToken();
      const response = await fetch(`${API_BASE_URL}/admin/staged-images/delete`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      if (!response.ok) throw new Error("Delete failed.");
      setImages((current) => current.filter((image) => !selected.has(image.id)));
      setSelected(new Set());
    } catch {
      setMessage("Failed to delete selected images.");
    } finally {
      setBusy(false);
    }
  }

  async function handleApprove() {
    if (selected.size === 0) return;

    setBusy(true);
    setMessage(null);
    try {
      const token = await getToken();
      const response = await fetch(`${API_BASE_URL}/admin/staged-images/approve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      if (!response.ok) throw new Error("Approve failed.");
      const results: ApproveResult[] = await response.json();

      const birdCount = results.filter((result) => result.ok && result.isBird).length;
      const notBirdCount = results.filter((result) => result.ok && !result.isBird).length;
      const errorCount = results.filter((result) => !result.ok).length;
      const parts = [];
      if (birdCount) parts.push(`${birdCount} identified`);
      if (notBirdCount) parts.push(`${notBirdCount} not a bird`);
      if (errorCount) parts.push(`${errorCount} failed`);
      setMessage(parts.join(", ") || "Done.");

      setImages((current) => current.filter((image) => !selected.has(image.id)));
      setSelected(new Set());
    } catch {
      setMessage("Failed to approve selected images.");
    } finally {
      setBusy(false);
    }
  }

  if (images.length === 0) {
    return <p className="text-gray-500">Nothing in the queue.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4" />
          Select all ({images.length})
        </label>
        <button
          type="button"
          disabled={busy || selected.size === 0}
          onClick={handleApprove}
          className="rounded-full bg-sky-600 text-white px-4 py-1.5 text-sm font-medium hover:bg-sky-700 transition-colors disabled:opacity-40 cursor-pointer"
        >
          Approve selected ({selected.size})
        </button>
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
        {images.map((image) => (
          <label
            key={image.id}
            className={`relative rounded-2xl border p-2 flex flex-col gap-1 cursor-pointer transition-colors ${
              selected.has(image.id) ? "border-sky-500 bg-sky-50" : "border-gray-200 bg-white hover:border-sky-300"
            }`}
          >
            <input
              type="checkbox"
              checked={selected.has(image.id)}
              onChange={() => toggle(image.id)}
              className="absolute top-3 left-3 h-4 w-4 z-10"
            />
            {/* eslint-disable-next-line @next/next/no-img-element -- signed Supabase URL, not worth next/image remote-origin config */}
            <img
              src={image.imageUrl}
              alt="Staged bird"
              loading="lazy"
              className="w-full aspect-square object-cover rounded-lg"
            />
            <p className="text-xs text-gray-500 truncate">{image.camera ?? "unknown camera"}</p>
            {image.score !== undefined && (
              <p className="text-xs text-gray-400">score {Math.round(image.score * 100) / 100}</p>
            )}
          </label>
        ))}
      </div>
    </div>
  );
}
