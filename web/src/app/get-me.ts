import { auth } from "@clerk/nextjs/server";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export interface Me {
  status: "pending" | "approved" | "rejected";
  isAdmin: boolean;
}

// Both layout.tsx (header) and page.tsx (splash/pending/home branch) need
// this on every signed-in page load. Next.js dedupes fetch() calls with
// identical URL + options within a single render pass, so calling this
// from both places costs one network round trip, not two.
export async function getMe(): Promise<Me | null> {
  const { userId, getToken } = await auth();
  if (!userId) return null;

  const token = await getToken();
  const response = await fetch(`${API_BASE_URL}/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return response.json();
}
