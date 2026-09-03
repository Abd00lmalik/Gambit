"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { Duel } from "@/lib/types";
import AssetIcon from "@/components/AssetIcon";
function formatAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}
function formatStake(stake: number): string {
  return `${stake} STT`;
}
import CountdownTimer from "./CountdownTimer";

interface DuelCardProps {
  duel: Duel;
  density?: "compact" | "full";
}

export default function DuelCard({ duel, density = "full" }: DuelCardProps) {
  const isUp = duel.side === "UP";
  const isActive = duel.status === "ACTIVE";
  const isOpen = duel.status === "OPEN";
  const isSettled = duel.status === "SETTLED";
  const won = duel.winner === duel.creator.address;

  return (
    <Link href={`/duel/${duel.id}`} className="block group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal rounded-2xl">
      <motion.div
        whileHover={{ y: -4, boxShadow: "0 8px 32px rgba(25, 190, 164, 0.12)" }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", damping: 20, stiffness: 300 }}
        className={`relative overflow-hidden rounded-2xl border transition-colors duration-200 cursor-pointer ${
          isActive
            ? "border-teal/40 bg-teal/5 shadow-lg shadow-teal/10"
            : isOpen
            ? "border-white/10 bg-white/[0.03] hover:border-teal/30"
            : isSettled
            ? "border-white/5 bg-white/[0.02] opacity-75"
            : "border-white/5 bg-white/[0.02]"
        }`}
      >
        {isActive && (
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-teal to-transparent" />
        )}

        <div className={density === "compact" ? "p-3" : "p-4"}>
          {/* Header row */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AssetBadge asset={duel.asset} />
              <span className="font-body text-xs text-gray-400">{duel.interval}</span>
            </div>
            <StatusBadge status={duel.status} />
          </div>

          {/* Side + Stake */}
          <div className="flex items-center justify-between mb-3">
            <div className={`flex items-center gap-1.5 font-display text-sm font-bold ${
              isUp ? "text-up" : "text-down"
            }`}>
              <span>{isUp ? "▲" : "▼"}</span>
              <span>{duel.side}</span>
            </div>
            <div className="font-display text-lg font-bold text-foam">
              {formatStake(duel.stake)}
            </div>
          </div>

          {/* Creator */}
          <div className="flex items-center justify-between">
            <span className="font-body text-xs text-gray-400">
              by {duel.creator.name || formatAddress(duel.creator.address)}
            </span>
            {isSettled && (
              <span className={`font-body text-xs font-medium ${won ? "text-up" : "text-down"}`}>
                {won ? "Won" : "Lost"}
              </span>
            )}
          </div>

          {/* Countdown for open/active */}
          {(isOpen || isActive) && density === "full" && (
            <div className="mt-3 pt-3 border-t border-white/5">
              <CountdownTimer
                targetTimestamp={isOpen ? duel.joinDeadline : duel.marketExpiry}
                size="sm"
                variant={isOpen ? "join" : "resolve"}
              />
            </div>
          )}
        </div>

        {/* Glow effect on active */}
        {isActive && (
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-32 h-16 bg-teal/20 blur-2xl rounded-full" />
        )}
      </motion.div>
    </Link>
  );
}

function AssetBadge({ asset }: { asset: string }) {
  const isBTC = asset === "BTC";
  return (
    <div className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${
      isBTC ? "bg-orange-500/15 text-orange-400" : "bg-blue-500/15 text-blue-400"
    }`}>
      <AssetIcon asset={isBTC ? "BTC" : "ETH"} className="h-4 w-4" />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; cls: string }> = {
    OPEN: { label: "Open", cls: "bg-teal/10 text-teal border-teal/20" },
    ACTIVE: { label: "Live", cls: "bg-down/10 text-down border-down/20 animate-glow-pulse" },
    SETTLED: { label: "Settled", cls: "bg-white/5 text-gray-400 border-white/10" },
    CANCELLED: { label: "Cancelled", cls: "bg-white/5 text-gray-500 border-white/10" },
    REFUNDED: { label: "Refunded", cls: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  };
  const c = config[status] || config.OPEN;
  return (
    <span className={`rounded-full border px-2.5 py-0.5 font-body text-[10px] font-medium uppercase tracking-wider ${c.cls}`}>
      {c.label}
    </span>
  );
}
