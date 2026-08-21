"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";

export interface MyIdentification {
  id: string;
  imageUrl: string;
  commonName: string;
  isFictionalOrCostume: boolean;
  confidence: "low" | "medium" | "high";
  description: string;
  createdAt: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

const CONFIDENCE_STYLES: Record<MyIdentification["confidence"], string> = {
  high: "bg-green-100 text-green-800",
  medium: "bg-amber-100 text-amber-800",
  low: "bg-red-100 text-red-800",
};

export function HistoryList({
  initialIdentifications,
  pageSize,
}: {
  initialIdentifications: MyIdentification[];
  pageSize: number;
}) {
  const { getToken } = useAuth();
  const [items, setItems] = useState(initialIdentifications);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initialIdentifications.length === pageSize);
  const [error, setError] = useState<string | null>(null);

  async function loadMore() {
    setLoadingMore(true);
    setError(null);
    try {
      const token = await getToken();
      const response = await fetch(`${API_BASE_URL}/identifications?limit=${pageSize}&offset=${items.length}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to load more.");
      const more: MyIdentification[] = await response.json();
      setItems((current) => [...current, ...more]);
      setHasMore(more.length === pageSize);
    } catch {
      setError("Failed to load more.");
    } finally {
      setLoadingMore(false);
    }
  }

  if (items.length === 0) {
    return <p className="text-gray-500">You haven&apos;t identified any birds yet.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {items.map((item) => (
          <Link
            key={item.id}
            href={`/history/${item.id}`}
            className="rounded-2xl border border-gray-200 bg-white p-2 flex flex-col gap-1 hover:border-sky-300 transition-colors"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- signed Supabase URL, not worth next/image remote-origin config */}
            <img
              src={item.imageUrl}
              alt={item.commonName}
              loading="lazy"
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
            <p className="text-xs text-gray-500 line-clamp-2">{item.description}</p>
          </Link>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

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
