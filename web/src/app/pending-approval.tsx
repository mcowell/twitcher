// Shown to signed-in users whose account hasn't been approved yet. There's
// no self-service approval — someone with Supabase table-editor access flips
// the row's status manually. This page just needs to say "hang on".
export function PendingApproval() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-6 px-6 py-24 text-center bg-gray-50">
      <span className="text-7xl" aria-hidden>
        ⏳
      </span>
      <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-gray-900">Almost there</h1>
      <p className="max-w-md text-lg text-gray-600">
        You&apos;re signed in, but new accounts need to be approved before they can use Twitcher. Check
        back soon.
      </p>
    </main>
  );
}
