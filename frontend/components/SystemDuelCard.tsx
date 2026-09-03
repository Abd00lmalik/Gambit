"use client";

import type { SystemChallenge } from "@/lib/autoPopulate";
import AssetIcon from "@/components/AssetIcon";

interface SystemDuelCardProps {
  challenge: SystemChallenge;
}

export default function SystemDuelCard({ challenge }: SystemDuelCardProps) {
  const timeUntilExpiry = challenge.expiry - Math.floor(Date.now() / 1000);
  const minutes = Math.floor(timeUntilExpiry / 60);
  const seconds = timeUntilExpiry % 60;
  const timeLeft = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  const isExpiringSoon = timeUntilExpiry <= 120;
  const badgeLabel = isExpiringSoon ? "Closing Soon" : "Live";
  const badgeColor = isExpiringSoon
    ? "border-yellow-400/20 bg-yellow-400/10 text-yellow-400"
    : "border-teal/20 bg-teal/10 text-teal";

  return (
    <a
      href={`/create?asset=${challenge.asset}&interval=${challenge.interval}`}
      className="block rounded-2xl border border-dashed border-teal/30 bg-teal/[0.03] p-4 transition-all duration-200 group cursor-pointer hover:border-teal/50 hover:bg-teal/[0.06]"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal/15 text-teal text-xs font-bold">
            <AssetIcon asset={challenge.asset === "BTC" ? "BTC" : "ETH"} className="h-4 w-4" />
          </div>
          <span className="font-body text-xs text-gray-400">
            {challenge.asset} {challenge.interval}
          </span>
        </div>
        <span className={`rounded-full border px-2.5 py-0.5 font-body text-[10px] font-medium uppercase tracking-wider ${badgeColor}`}>
          {badgeLabel}
        </span>
      </div>

      <div className="flex items-center justify-between mb-3">
        <span className="font-display text-lg font-bold text-foam">
          {challenge.suggestedStake} STT
        </span>
        <span className="font-body text-xs text-gray-400">
          ${challenge.openingPrice.toLocaleString()}
        </span>
      </div>

      <div className="space-y-1.5 mb-3">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded-full bg-teal/15 flex items-center justify-center text-[10px] font-bold text-teal">
            ?
          </div>
          <span className="font-body text-[11px] text-gray-500">
            Pick a side when you accept
          </span>
        </div>
      </div>

      <div className="pt-3 border-t border-white/5 flex items-center justify-between">
        <span className="font-body text-[10px] text-gray-500">
          Closes in {timeLeft}
        </span>
        <span className="text-teal text-xs group-hover:translate-x-1 transition-transform">
          →
        </span>
      </div>
    </a>
  );
}
