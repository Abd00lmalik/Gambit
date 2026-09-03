"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount } from "wagmi";
import { useDuelCreatedEvents } from "@/hooks/useDuelEvents";
import { DuelState, DUEL_STATE_LABELS } from "@/lib/contracts";
import {
  updateSystemChallenges,
  type SystemChallenge,
} from "@/lib/autoPopulate";
import SystemDuelCard from "@/components/SystemDuelCard";
import { SquadPoolCard, type SquadPoolData } from "@/components/SquadPoolCard";
import AssetIcon from "@/components/AssetIcon";

const FILTERS = ["All", "BTC", "ETH", "Open", "Live", "Settled"] as const;

// Mock squad pools for demo — replaced by on-chain reads once pool factory is deployed
const MOCK_SQUAD_POOLS: SquadPoolData[] = [
  {
    address: "0xa3b1f2c4d5e6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
    squadName: "BTC Bulls",
    asset: "BTC",
    interval: "15m",
    openingPrice: 58432.10,
    expiry: Math.floor(Date.now() / 1000) + 900,
    creator: "0x76d73b841d6b086cf98dda0f97588ec9f463472b6f016eae73f51b966be7aed7",
    totalUp: 3.2,
    totalDown: 1.1,
    participantCount: 4,
  },
  {
    address: "0xb4c2e3f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1",
    squadName: "ETH Bears",
    asset: "ETH",
    interval: "1h",
    openingPrice: 3245.80,
    expiry: Math.floor(Date.now() / 1000) + 3600,
    creator: "0x5E2D3BD4ad0aE1CDF49DdB0F0C96d55790199cE6",
    totalUp: 0.8,
    totalDown: 2.4,
    participantCount: 3,
  },
];

export default function ArenaPage() {
  const { isConnected } = useAccount();
  const { duels, isLoading } = useDuelCreatedEvents();
  const [filter, setFilter] = useState<string>("All");
  const [sort, setSort] = useState<"newest" | "stake">("newest");
  const [systemChallenges, setSystemChallenges] = useState<SystemChallenge[]>([]);

  useEffect(() => {
    const loadSystemChallenges = async () => {
      const challenges = await updateSystemChallenges();
      setSystemChallenges(challenges);
    };

    loadSystemChallenges();
    const interval = setInterval(loadSystemChallenges, 30000);
    return () => clearInterval(interval);
  }, []);

  const filtered = duels
    .filter((d) => {
      if (filter === "All") return true;
      if (filter === "Open") return d.state === DuelState.CREATED;
      if (filter === "Live") return d.state === DuelState.LOCKED;
      if (filter === "Settled") return d.state === DuelState.SETTLED;
      return true;
    })
    .sort((a, b) => {
      if (sort === "newest") return 0;
      return parseFloat(b.stakeAmount) - parseFloat(a.stakeAmount);
    });

  const filteredSystemChallenges = systemChallenges.filter((c) => {
    if (filter === "All") return true;
    if (filter === "Open") return true;
    return c.asset === filter;
  });

  const showSystemChallenges =
    filteredSystemChallenges.length > 0 &&
    (filter === "All" || filter === "Open" || filter === "BTC" || filter === "ETH");

  const filteredPools = MOCK_SQUAD_POOLS.filter((p) => {
    if (filter === "All") return true;
    if (filter === "Open") return true;
    return p.asset === filter;
  });

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", damping: 20, stiffness: 80 }}
          className="mb-8"
        >
          <h1 className="font-display text-3xl md:text-4xl font-bold text-foam mb-2">
            Arena
          </h1>
          <p className="font-body text-gray-400">
            Open challenges waiting for an opponent.
          </p>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-wrap items-center gap-3 mb-6"
        >
          <div className="flex rounded-xl border border-white/10 bg-white/[0.03] p-1">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`min-h-[36px] rounded-lg px-4 py-1.5 font-body text-xs font-medium transition-all duration-200 cursor-pointer ${
                  filter === f
                    ? "bg-teal text-carbon"
                    : "text-gray-400 hover:text-foam"
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="flex rounded-xl border border-white/10 bg-white/[0.03] p-1 ml-auto">
            <button
              onClick={() => setSort("newest")}
              className={`min-h-[36px] rounded-lg px-4 py-1.5 font-body text-xs font-medium transition-all duration-200 cursor-pointer ${
                sort === "newest" ? "bg-white/10 text-foam" : "text-gray-400 hover:text-foam"
              }`}
            >
              Newest
            </button>
            <button
              onClick={() => setSort("stake")}
              className={`min-h-[36px] rounded-lg px-4 py-1.5 font-body text-xs font-medium transition-all duration-200 cursor-pointer ${
                sort === "stake" ? "bg-white/10 text-foam" : "text-gray-400 hover:text-foam"
              }`}
            >
              Highest Stake
            </button>
          </div>
        </motion.div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 animate-pulse">
                <div className="h-4 bg-white/5 rounded w-1/3 mb-4" />
                <div className="h-6 bg-white/5 rounded w-1/2 mb-3" />
                <div className="h-3 bg-white/5 rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : filtered.length > 0 || showSystemChallenges || filteredPools.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence mode="popLayout">
              {showSystemChallenges &&
                filteredSystemChallenges.map((challenge, i) => (
                  <motion.div
                    key={challenge.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ type: "spring", damping: 20, stiffness: 100, delay: i * 0.05 }}
                    layout
                  >
                    <SystemDuelCard challenge={challenge} />
                  </motion.div>
                ))}
              {filtered.map((duel, i) => (
                <motion.div
                  key={duel.address}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ type: "spring", damping: 20, stiffness: 100, delay: i * 0.05 }}
                  layout
                >
                  <DuelCardOnChain duel={duel} />
                </motion.div>
              ))}
              {filteredPools.map((pool, i) => (
                <motion.div
                  key={pool.address}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ type: "spring", damping: 20, stiffness: 100, delay: i * 0.05 }}
                  layout
                >
                  <SquadPoolCard pool={pool} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  );
}

function DuelCardOnChain({ duel }: { duel: any }) {
  const state = duel.state as DuelState;
  const isOpen = state === DuelState.CREATED;
  const isLive = state === DuelState.LOCKED;
  const isSettled = state === DuelState.SETTLED;
  const isCancelled = state === DuelState.CANCELLED;
  const isRefunded = state === DuelState.REFUNDED;

  const stateLabel = DUEL_STATE_LABELS[state] || "Unknown";
  const hasJoined = duel.playerB !== "0x0000000000000000000000000000000000000000";

  const stateColors: Record<number, string> = {
    [DuelState.CREATED]: "border-teal/30 bg-teal/5 hover:border-teal/50",
    [DuelState.LOCKED]: "border-yellow-400/30 bg-yellow-400/5",
    [DuelState.SETTLED]: "border-up/30 bg-up/5",
    [DuelState.CANCELLED]: "border-white/5 bg-white/[0.02]",
    [DuelState.REFUNDED]: "border-white/5 bg-white/[0.02]",
  };

  return (
    <a
      href={`/duel/${duel.address}`}
      className={`block rounded-2xl border p-4 transition-all duration-200 group cursor-pointer ${stateColors[state] || "border-white/10 bg-white/[0.03]"}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500/15 text-orange-400 text-xs font-bold">
            <AssetIcon asset="BTC" className="h-4 w-4" />
          </div>
          <span className="font-body text-xs text-gray-400">Somnia</span>
        </div>
        <span className={`rounded-full border px-2.5 py-0.5 font-body text-[10px] font-medium uppercase tracking-wider ${
          isOpen ? "bg-teal/10 text-teal border-teal/20" :
          isLive ? "bg-yellow-400/10 text-yellow-400 border-yellow-400/20" :
          isSettled ? "bg-up/10 text-up border-up/20" :
          "bg-white/5 text-gray-500 border-white/10"
        }`}>
          {stateLabel}
        </span>
      </div>

      {/* Stake */}
      <div className="flex items-center justify-between mb-3">
        <span className="font-display text-lg font-bold text-foam">{duel.stakeAmount} STT</span>
        {hasJoined && !isSettled && (
          <span className="text-xs text-yellow-400 font-medium">Locked</span>
        )}
      </div>

      {/* Players */}
      <div className="space-y-1.5 mb-3">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded-full bg-teal/15 flex items-center justify-center text-[10px] font-bold text-teal">
            A
          </div>
          <span className="font-mono text-[11px] text-gray-400 truncate">
            {duel.playerA.slice(0, 6)}...{duel.playerA.slice(-4)}
          </span>
        </div>
        {hasJoined ? (
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded-full bg-down/15 flex items-center justify-center text-[10px] font-bold text-down">
              B
            </div>
            <span className="font-mono text-[11px] text-gray-400 truncate">
              {duel.playerB.slice(0, 6)}...{duel.playerB.slice(-4)}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 opacity-40">
            <div className="h-5 w-5 rounded-full bg-white/5 flex items-center justify-center text-[10px] text-gray-500">?</div>
            <span className="font-body text-[11px] text-gray-500">Waiting for opponent...</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="pt-3 border-t border-white/5 flex items-center justify-between">
        <span className="font-body text-[10px] text-gray-500">
          {isOpen ? "Join before deadline" : isLive ? "Awaiting resolution" : isSettled ? "Resolved" : stateLabel}
        </span>
        {(isOpen || isLive) && (
          <span className="text-teal text-xs group-hover:translate-x-1 transition-transform">→</span>
        )}
      </div>
    </a>
  );
}

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-24 text-center"
    >
      <div className="relative mb-6">
        <div className="h-20 w-20 rounded-full bg-teal/10 flex items-center justify-center">
          <span className="text-3xl">⚔️</span>
        </div>
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-16 h-4 bg-teal/10 blur-xl rounded-full" />
      </div>
      <h3 className="font-display text-xl font-bold text-foam mb-2">
        No open challenges
      </h3>
      <p className="font-body text-sm text-gray-400 max-w-sm mb-6">
        Be the first to throw down. Create a challenge and share the link.
      </p>
      <a
        href="/create"
        className="min-h-[44px] inline-flex items-center rounded-xl bg-foam px-6 py-2.5 font-display text-sm font-bold text-carbon transition-all duration-200 hover:bg-foam-dark hover:shadow-lg hover:shadow-foam/20 active:scale-[0.97] cursor-pointer"
      >
        Create a Duel
      </a>
    </motion.div>
  );
}
