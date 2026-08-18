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
// "unavailable" covers the API being unreachable — a slow-to-wake free-tier
// instance, or (more likely now that both services run on Starter) a brief
// connection blip during a deploy's old-instance/new-instance swap. Retried
// once with a fresh token, since a token that's momentarily stale right
// after a page load is a plausible one-off cause too. Logged either way —
// "unavailable" silently drops isAdmin to false in the header with no
// visible error, so without a log line a real outage and a one-off blip
// look identical from the browser.
export async function getMe(): Promise<MeResult> {
  const { userId, getToken } = await auth();
  if (!userId) return { kind: "signed-out" };

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const token = await getToken();
      const response = await fetch(`${API_BASE_URL}/me`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      });
      if (response.ok) {
        const me: Me = await response.json();
        return { kind: "ok", me };
      }
      console.error(`getMe(): /me returned HTTP ${response.status} on attempt ${attempt}`);
    } catch (error) {
      console.error(`getMe(): request failed on attempt ${attempt}:`, error);
    }

    if (attempt === 1) await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return { kind: "unavailable" };
}
