"use client";

import { useReset } from "./reset-context";

export function HeaderLogo() {
  const { triggerReset } = useReset();

  return (
    <button
      type="button"
      onClick={triggerReset}
      className="flex items-center gap-2 text-lg font-semibold tracking-tight cursor-pointer hover:opacity-80 transition-opacity"
    >
      <span aria-hidden>🐦</span> Twitcher
    </button>
  );
}
