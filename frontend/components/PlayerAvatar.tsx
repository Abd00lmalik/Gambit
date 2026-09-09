"use client";

import { useSupabasePfp } from "@/hooks/useSupabaseProfile";

interface PlayerAvatarProps {
  address: string;
  label?: string;
  size?: "sm" | "md";
}

export default function PlayerAvatar({ address, label, size = "sm" }: PlayerAvatarProps) {
  const pfpUrl = useSupabasePfp(address);
  const initial = address?.charAt(2).toUpperCase() || "?";
  const dims = size === "sm" ? "h-5 w-5 text-[10px]" : "h-7 w-7 text-xs";

  if (pfpUrl) {
    return (
      <img
        src={pfpUrl}
        alt={label || address.slice(0, 6)}
        className={`${dims} rounded-full object-cover`}
      />
    );
  }

  return (
    <div className={`${dims} rounded-full bg-teal/15 flex items-center justify-center font-bold text-teal`}>
      {label || initial}
    </div>
  );
}
