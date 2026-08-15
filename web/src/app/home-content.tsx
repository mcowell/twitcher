"use client";

import { useCallback, useState } from "react";
import { useReset } from "./reset-context";
import { UploadForm } from "./upload-form";
import { RecentIdentifications } from "./recent-identifications";

export function HomeContent() {
  // Remounting UploadForm on resetKey change is what actually clears it
  // back to a blank slate — see reset-context.tsx and header-logo.tsx.
  const { resetKey } = useReset();
  const [refreshKey, setRefreshKey] = useState(0);
  const handleIdentified = useCallback(() => setRefreshKey((key) => key + 1), []);

  return (
    <main className="flex-1 flex flex-col items-center gap-6 p-8 max-w-2xl md:max-w-4xl mx-auto w-full">
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Twitcher</h1>
        <p className="text-sm text-gray-500 mt-1">
          Drop in a bird photo and Claude will tell you what you spotted.
        </p>
      </div>
      <UploadForm key={resetKey} onIdentified={handleIdentified} />
      <RecentIdentifications refreshKey={refreshKey} />
    </main>
  );
}
