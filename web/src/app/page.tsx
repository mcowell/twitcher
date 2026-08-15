import { HomeContent } from "./home-content";
import { PendingApproval } from "./pending-approval";
import { Splash } from "./splash";
import { getMe } from "./get-me";

export default async function Home() {
  // getMe() reads sign-in state without redirecting, so signed-out visitors
  // see the splash page here instead of getting bounced straight to Clerk.
  // The actual security boundary is unchanged — it's the Express API
  // requiring a valid Clerk JWT (and, now, an approved account), not this
  // page.
  const me = await getMe();

  if (!me) return <Splash />;

  return me.status === "approved" ? <HomeContent /> : <PendingApproval />;
}
