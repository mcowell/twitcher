"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";

interface RecentIdentification {
  id: string;
  imageUrl: string;
  commonName: string;
  isFictionalOrCostume: boolean;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

// refreshKey is bumped by the parent after each successful identification,
// so this refetches without needing to poll.
export function RecentIdentifications({ refreshKey }: { refreshKey: number }) {
  const { getToken } = useAuth();
  const [items, setItems] = useState<RecentIdentification[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const token = await getToken();
      const response = await fetch(`${API_BASE_URL}/identifications?limit=3`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok || cancelled) return;
      const data: RecentIdentification[] = await response.json();
      if (!cancelled) setItems(data);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [refreshKey, getToken]);

  if (items.length === 0) return null;

  return (
    <div className="w-full">
      <p className="text-sm font-medium text-gray-500 mb-2">Recently identified</p>
      <div className="flex gap-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="w-48 shrink-0 rounded-2xl border border-sky-100 bg-white p-2 flex flex-col gap-1"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- signed Supabase URL, not worth next/image remote-origin config */}
            <img
              src={item.imageUrl}
              alt={item.commonName}
              className="w-full aspect-square object-cover rounded-lg"
            />
            <p className="text-xs font-medium truncate">
              {item.commonName}
              {item.isFictionalOrCostume && " 🎭"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
