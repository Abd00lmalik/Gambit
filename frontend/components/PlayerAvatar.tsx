"use client";

import { useState, useEffect } from "react";
import { useSupabasePfp } from "@/hooks/useSupabaseProfile";
import { usePfpImage } from "@/hooks/usePfpImage";

interface PlayerAvatarProps {
  address: string;
  label?: string;
  size?: "sm" | "md";
  pfpVersion?: number;
}

export default function PlayerAvatar({ address, label, size = "sm", pfpVersion }: PlayerAvatarProps) {
  const { displayName } = useSupabasePfp(address);
  const initial = address?.charAt(2).toUpperCase() || "?";
  const dims = size === "sm" ? "h-5 w-5 text-[10px]" : "h-7 w-7 text-xs";

  // P1 fix: the image source is ADDRESS-derived via the per-address proxy —
  // the blob store is the source of truth, not the DB row. If this wallet has
  // no PFP (proxy 404s), fall back to the initial. Each wallet still only ever
  // sees its own blob (per-address key).
  const { src: imgSrc, onError } = usePfpImage(address);

  if (imgSrc) {
    return (
      <img
        key={imgSrc + (pfpVersion ? `?v=${pfpVersion}` : "")}
        src={imgSrc + (pfpVersion ? `?v=${pfpVersion}` : "")}
        onError={onError}
        alt={displayName || label || address.slice(0, 6)}
        className={`${dims} rounded-full object-cover`}
      />
    );
  }

  return (
    <div className={`${dims} rounded-full bg-teal/15 flex items-center justify-center font-bold text-teal`}>
      {displayName?.charAt(0)?.toUpperCase() || label || initial}
    </div>
  );
}
