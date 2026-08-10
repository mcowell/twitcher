import { clerkMiddleware } from "@clerk/nextjs/server";

// This only attaches Clerk's auth context to every request (and gives us a
// central place to add optimistic redirects later, per Next.js's guidance).
// The real access control lives next to each resource: see
// `await auth.protect()` in src/app/page.tsx and
// src/app/api/identify/route.ts. Don't rely on this file alone for security.
export default clerkMiddleware();

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
