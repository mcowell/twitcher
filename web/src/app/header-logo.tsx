"use client";

import Link from "next/link";
import { useReset } from "./reset-context";

export function HeaderLogo() {
  const { triggerReset } = useReset();

  return (
    <Link
      href="/"
      onClick={triggerReset}
      className="flex items-center gap-2 text-lg font-semibold tracking-tight text-white cursor-pointer hover:opacity-80 transition-opacity"
    >
      <span aria-hidden>🐦</span> Twitcher
    </Link>
  );
}
