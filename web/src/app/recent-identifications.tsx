"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
      const response = await fetch(`${API_BASE_URL}/identifications?limit=4`, {
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
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-gray-500">Recently identified</p>
        <Link href="/history" className="text-xs font-medium text-sky-700 hover:underline">
          See all →
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {items.map((item) => (
          <Link
            key={item.id}
            href={`/history/${item.id}`}
            className="rounded-2xl border border-sky-100 bg-white p-2 flex flex-col gap-1 hover:border-sky-300 transition-colors"
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
          </Link>
        ))}
      </div>
    </div>
  );
}
