import { auth } from "@clerk/nextjs/server";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export interface Me {
  status: "pending" | "approved" | "rejected";
  isAdmin: boolean;
}

export type MeResult = { kind: "signed-out" } | { kind: "unavailable" } | { kind: "ok"; me: Me };

// Both layout.tsx (header) and page.tsx (splash/pending/home branch) need
// this on every signed-in page load. Next.js dedupes fetch() calls with
// identical URL + options within a single render pass, so calling this
// from both places costs one network round trip, not two.
//
// "unavailable" covers the API being unreachable or slow to wake — Render's
// free tier spins services down after 15 minutes idle, and can serve an
// HTML gateway page instead of JSON while the API container restarts, so a
// successful fetch() is never assumed to mean a JSON body.
export async function getMe(): Promise<MeResult> {
  const { userId, getToken } = await auth();
  if (!userId) return { kind: "signed-out" };

  try {
    const token = await getToken();
    const response = await fetch(`${API_BASE_URL}/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) return { kind: "unavailable" };

    const me: Me = await response.json();
    return { kind: "ok", me };
  } catch {
    return { kind: "unavailable" };
  }
}
