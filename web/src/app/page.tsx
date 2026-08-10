import { auth } from "@clerk/nextjs/server";
import { HomeContent } from "./home-content";

export default async function Home() {
  // Redirects signed-out visitors to sign-in. Combined with Clerk's
  // "Restricted" sign-up mode (invite-only), this means only people you've
  // explicitly invited can ever reach the page that triggers an API call.
  await auth.protect();

  return <HomeContent />;
}
