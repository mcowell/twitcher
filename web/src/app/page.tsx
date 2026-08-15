import { auth } from "@clerk/nextjs/server";
import { HomeContent } from "./home-content";
import { PendingApproval } from "./pending-approval";
import { Splash } from "./splash";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export default async function Home() {
  // auth() (not .protect()) reads sign-in state without redirecting, so
  // signed-out visitors see the splash page here instead of getting bounced
  // straight to Clerk. The actual security boundary is unchanged — it's the
  // Express API requiring a valid Clerk JWT (and, now, an approved account),
  // not this page.
  const { userId, getToken } = await auth();

  if (!userId) return <Splash />;

  const token = await getToken();
  const response = await fetch(`${API_BASE_URL}/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const { status } = await response.json();

  return status === "approved" ? <HomeContent /> : <PendingApproval />;
}
