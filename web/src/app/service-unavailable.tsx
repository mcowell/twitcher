// Shown when the API is unreachable or returns something unexpected — most
// commonly Render's free tier having spun the API down after 15 minutes
// idle. The next request wakes it automatically; this just avoids crashing
// on whatever non-JSON response Render's proxy serves in the meantime.
export function ServiceUnavailable() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-6 px-6 py-24 text-center bg-gray-50">
      <span className="text-7xl" aria-hidden>
        💤
      </span>
      <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-gray-900">Waking up</h1>
      <p className="max-w-md text-lg text-gray-600">
        The server was asleep and is starting back up — this usually takes under a minute. Try refreshing
        shortly.
      </p>
    </main>
  );
}
