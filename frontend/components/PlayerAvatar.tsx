"use client";

import { useSupabasePfp } from "@/hooks/useSupabaseProfile";

interface PlayerAvatarProps {
  address: string;
  label?: string;
  size?: "sm" | "md";
}

export default function PlayerAvatar({ address, label, size = "sm" }: PlayerAvatarProps) {
  const { pfpUrl, displayName } = useSupabasePfp(address);
  const initial = address?.charAt(2).toUpperCase() || "?";
  const dims = size === "sm" ? "h-5 w-5 text-[10px]" : "h-7 w-7 text-xs";

  // Use stored blob URL directly — proxy endpoint doesn't work for private blobs
  const imgSrc = pfpUrl || null;

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
