"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import AssetIcon from "@/components/AssetIcon";

export interface SquadPoolData {
  address: string;
  squadName: string;
  asset: string;
  interval: string;
  openingPrice: number;
  expiry: number;
  creator: string;
  totalUp: number;
  totalDown: number;
  participantCount: number;
}

export function getRoomCode(poolAddress: string): string {
  return poolAddress.slice(2, 8).toLowerCase();
}

export function SquadPoolCard({ pool }: { pool: SquadPoolData }) {
  const router = useRouter();
  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState(false);
  const roomCode = getRoomCode(pool.address);
  const totalPool = pool.totalUp + pool.totalDown;
  const upPct = totalPool > 0 ? Math.round((pool.totalUp / totalPool) * 100) : 50;
  const downPct = 100 - upPct;
  const isExpired = pool.expiry <= Math.floor(Date.now() / 1000);

  const handleCodeSubmit = useCallback(() => {
    if (codeInput.toLowerCase() === roomCode) {
      router.push(`/pool/${pool.address}`);
    } else {
      setCodeError(true);
      setTimeout(() => setCodeError(false), 1500);
    }
  }, [codeInput, roomCode, pool.address, router]);

  return (
    <div className="block rounded-2xl border border-purple-500/20 bg-purple-500/[0.04] p-4 transition-all duration-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/15 text-purple-400 text-xs font-bold">
            <AssetIcon asset={pool.asset} className="h-4 w-4" />
          </div>
          <span className="font-body text-xs text-gray-400">Squad Pool</span>
        </div>
        <span className="rounded-full border border-purple-500/20 bg-purple-500/10 px-2.5 py-0.5 font-body text-[10px] font-medium uppercase tracking-wider text-purple-400">
          🔒 Invite Only
        </span>
      </div>

      {/* Squad name */}
      <div className="mb-3">
        <span className="font-display text-sm font-bold text-foam">
          {pool.squadName || "Unnamed Squad"}
        </span>
      </div>

      {/* Market info */}
      <div className="mb-3">
        <p className="font-body text-[11px] text-gray-400">
          Will {pool.asset} close above ${pool.openingPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })}?
        </p>
        <p className="font-body text-[10px] text-gray-500 mt-0.5">
          {pool.interval} · {isExpired ? "Expired" : `Expires ${new Date(pool.expiry * 1000).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "UTC", hour12: false })} UTC`}
        </p>
      </div>

      {/* Pool split bar */}
      <div className="mb-3">
        <div className="h-2 rounded-full overflow-hidden flex bg-white/5">
          <div className="bg-up/50 transition-all duration-500" style={{ width: `${upPct}%` }} />
          <div className="bg-down/50 transition-all duration-500" style={{ width: `${downPct}%` }} />
        </div>
        <div className="flex justify-between mt-1">
          <span className="font-body text-[10px] text-up">▲ {upPct}%</span>
          <span className="font-body text-[10px] text-gray-500">{totalPool.toFixed(2)} STT</span>
          <span className="font-body text-[10px] text-down">▼ {downPct}%</span>
        </div>
      </div>

      {/* Participants */}
      <div className="flex items-center gap-1.5 mb-3">
        <span className="font-body text-[10px] text-gray-500">
          {pool.participantCount} {pool.participantCount === 1 ? "member" : "members"}
        </span>
      </div>

      {/* Room code entry */}
      <div className="pt-3 border-t border-white/5">
        <p className="font-body text-[10px] text-gray-500 mb-2">
          Have a room code? Enter it to join:
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={codeInput}
            onChange={(e) => { setCodeInput(e.target.value); setCodeError(false); }}
            placeholder={roomCode}
            maxLength={6}
            className={`flex-1 min-h-[36px] rounded-lg border bg-white/[0.03] px-3 py-1.5 font-mono text-xs text-foam outline-none transition-colors placeholder:text-gray-600 ${
              codeError ? "border-down/50 focus:border-down" : "border-white/10 focus:border-purple-500/50"
            }`}
            onKeyDown={(e) => e.key === "Enter" && handleCodeSubmit()}
          />
          <button
            onClick={handleCodeSubmit}
            disabled={!codeInput}
            className={`min-h-[36px] rounded-lg px-3 font-body text-[11px] font-medium transition-all cursor-pointer ${
              codeInput
                ? "bg-purple-500/20 text-purple-400 hover:bg-purple-500/30"
                : "bg-white/5 text-gray-600 cursor-not-allowed"
            }`}
          >
            Join
          </button>
        </div>
        {codeError && (
          <p className="font-body text-[10px] text-down mt-1">Invalid code. Ask the creator for the correct one.</p>
        )}
      </div>
    </div>
  );
}
