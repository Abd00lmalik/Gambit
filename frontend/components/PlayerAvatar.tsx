"use client";

import { useState, useEffect } from "react";
import { useSupabasePfp } from "@/hooks/useSupabaseProfile";

interface PlayerAvatarProps {
  address: string;
  label?: string;
  size?: "sm" | "md";
  pfpVersion?: number;
}

export default function PlayerAvatar({ address, label, size = "sm", pfpVersion }: PlayerAvatarProps) {
  const { pfpUrl, displayName } = useSupabasePfp(address);
  const initial = address?.charAt(2).toUpperCase() || "?";
  const dims = size === "sm" ? "h-5 w-5 text-[10px]" : "h-7 w-7 text-xs";

  // Always use the server proxy endpoint — private blob URLs aren't accessible from the client
  // Add pfpVersion as cache-buster when PFP is updated
  const imgSrc = pfpUrl ? `/api/pfp/${address.toLowerCase()}${pfpVersion ? `?v=${pfpVersion}` : ""}` : null;

  if (imgSrc) {
    return (
      <img
        src={imgSrc}
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
