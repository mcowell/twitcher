import { SignUpButton } from "@clerk/nextjs";

// Shown at "/" to signed-out visitors instead of bouncing them straight to
// Clerk. Sign-up is public, but new accounts land in "pending" until someone
// manually approves them (see pending-approval.tsx) — so this is a sign-up
// CTA, not a login one. The blue banner is the header (layout.tsx) above
// this; keep this content area light so it isn't a wall of blue.
export function Splash() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-6 px-6 py-24 text-center bg-gray-50">
      <span className="text-7xl" aria-hidden>
        🐦
      </span>
      <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-gray-900">Twitcher</h1>
      <p className="max-w-md text-lg text-gray-600">
        Upload a photo of a bird and Claude tells you what it is — species, confidence,
        and a couple of alternatives if it&apos;s not sure.
      </p>
      <SignUpButton>
        <button
          type="button"
          className="rounded-full bg-sky-600 text-white px-6 py-3 text-base font-medium hover:bg-sky-700 transition-colors cursor-pointer"
        >
          Sign up
        </button>
      </SignUpButton>
      <p className="text-sm text-gray-400">
        New accounts need approval before they can start identifying birds.
      </p>
    </main>
  );
}
