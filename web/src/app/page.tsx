import { auth } from "@clerk/nextjs/server";
import { HomeContent } from "./home-content";
import { Splash } from "./splash";

export default async function Home() {
  // auth() (not .protect()) reads sign-in state without redirecting, so
  // signed-out visitors see the splash page here instead of getting bounced
  // straight to Clerk. The actual security boundary is unchanged — it's the
  // Express API requiring a valid Clerk JWT, not this page.
  const { userId } = await auth();

  return userId ? <HomeContent /> : <Splash />;
}
