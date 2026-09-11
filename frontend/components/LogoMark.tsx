"use client";

import { useState } from "react";

/**
 * Gambit logo mark: the real logo asset (public/logo.png, transparent PNG)
 * with a letter-mark fallback if the asset is missing. Renders directly on
 * the dark theme — no background box.
 */
export default function LogoMark({ className }: { className?: string }) {
  const [ok, setOk] = useState(true);
  const size = className ?? "h-9 w-9";

  if (ok) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src="/logo.png"
        alt="Gambit logo"
        onError={() => setOk(false)}
        className={`${size} object-contain`}
      />
    );
  }
  return (
    <div className={`${size} flex items-center justify-center rounded-lg bg-teal font-display font-bold text-carbon`}>
      G
    </div>
  );
}
