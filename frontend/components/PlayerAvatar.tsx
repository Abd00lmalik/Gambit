"use client";

import { useState, useEffect } from "react";
import { useSupabasePfp } from "@/hooks/useSupabaseProfile";

interface PlayerAvatarProps {
  address: string;
  label?: string;
  size?: "sm" | "md";
  pfpVersion?: number;
}

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1200;

export default function PlayerAvatar({ address, label, size = "sm", pfpVersion }: PlayerAvatarProps) {
  const { pfpUrl, displayName } = useSupabasePfp(address);
  const initial = address?.charAt(2).toUpperCase() || "?";
  const dims = size === "sm" ? "h-5 w-5 text-[10px]" : "h-7 w-7 text-xs";

  // Always use the server proxy endpoint — private blob URLs aren't accessible from the client.
  // Add pfpVersion as cache-buster when PFP is updated.
  const baseSrc = pfpUrl ? `/api/pfp/${address.toLowerCase()}${pfpVersion ? `?v=${pfpVersion}` : ""}` : null;

  // If the proxy 404s transiently (e.g. a blob still propagating right after
  // an upload), retry a couple of times with a fresh cache-buster before
  // giving up — prevents flicker-to-placeholder right after someone updates
  // their PFP elsewhere.
  const [src, setSrc] = useState<string | null>(baseSrc);
  const [retriesLeft, setRetriesLeft] = useState(MAX_RETRIES);
  useEffect(() => {
    setSrc(baseSrc);
    setRetriesLeft(MAX_RETRIES);
  }, [baseSrc]);
  useEffect(() => {
    if (!baseSrc || retriesLeft === MAX_RETRIES) return;
    const t = setTimeout(() => {
      setSrc(`${baseSrc}${baseSrc.includes("?") ? "&" : "?"}r=${Date.now()}`);
    }, RETRY_DELAY_MS * (MAX_RETRIES - retriesLeft));
    return () => clearTimeout(t);
  }, [baseSrc, retriesLeft]);

  if (src) {
    return (
      <img
        src={src}
        alt={displayName || label || address.slice(0, 6)}
        className={`${dims} rounded-full object-cover`}
        onError={() => {
          if (retriesLeft > 0) setRetriesLeft((r) => r - 1);
          else setSrc(null);
        }}
      />
    );
  }

  return (
    <div className={`${dims} rounded-full bg-teal/15 flex items-center justify-center font-bold text-teal`}>
      {displayName?.charAt(0)?.toUpperCase() || label || initial}
    </div>
  );
}
