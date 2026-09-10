"use client";

import { useState, useEffect, useRef, Suspense, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount } from "wagmi";
import { useSearchParams } from "next/navigation";
import { useDuelCreatedEvents } from "@/hooks/useDuelEvents";
import { usePublicClient } from "wagmi";
import { useSupabasePfp } from "@/hooks/useSupabaseProfile";
import { somnia } from "@/lib/config";
import { FACTORY_ADDRESS, FACTORY_ABI } from "@/lib/contracts";
import { decodeEventLog } from "viem";
import { DuelState } from "@/lib/contracts";
import { deriveDuelView, type DuelView } from "@/lib/duelViewState";
import { fetchMarketTerminalInfo, type MarketTerminalInfo } from "@/lib/dreamdex";
import AssetIcon from "@/components/AssetIcon";
import PlayerAvatar from "@/components/PlayerAvatar";
import CountdownTimer from "@/components/CountdownTimer";

const FILTERS = ["All", "BTC", "ETH", "Open", "Live", "Settled"] as const;

async function resolveHighlightToClone(
  client: any,
  highlight: string
): Promise<string | null> {
  if (!highlight.startsWith("0x") || highlight.length < 66) return null;
  try {
    const receipt = await client.getTransactionReceipt({
      hash: highlight as `0x${string}`,
    });
    if (!receipt) return null;
    // Decode with the factory ABI — the DuelCreated topic hash changed when
    // `creatorIsUp` was added to the event, so a hardcoded constant silently
    // stopped matching and the ?highlight=… fallback never resolved.
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== FACTORY_ADDRESS.toLowerCase()) continue;
      try {
        const decoded = decodeEventLog({
          abi: FACTORY_ABI,
          data: log.data,
          topics: log.topics,
        });
        if (decoded.eventName === "DuelCreated") {
          const clone = decoded.args.clone as string | undefined;
          if (clone) return clone;
        }
      } catch {
        // Not a factory event we know — skip.
      }
    }
  } catch {}
  return null;
}

export default function ArenaPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen py-8 px-4">
          <div className="mx-auto max-w-6xl">
            <div className="mb-8">
              <div className="h-10 bg-white/5 rounded w-32 mb-2" />
              <div className="h-4 bg-white/5 rounded w-64" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 animate-pulse"
                >
                  <div className="h-4 bg-white/5 rounded w-1/3 mb-4" />
                  <div className="h-6 bg-white/5 rounded w-1/2 mb-3" />
                  <div className="h-3 bg-white/5 rounded w-2/3" />
                </div>
              ))}
            </div>
          </div>
        </div>
      }
    >
      <ArenaContent />
    </Suspense>
  );
}

function ArenaContent() {
  const { address: connectedAddress, isConnected } = useAccount();
  const { duels, isLoading, refetch } = useDuelCreatedEvents();
  const [filter, setFilter] = useState<string>("All");
  const [sort, setSort] = useState<"newest" | "stake">("newest");
  const searchParams = useSearchParams();
  const highlight = searchParams.get("highlight");
  const highlightRef = useRef<string | null>(null);
  const highlightedRef = useRef(false);

  // P3: Refetch duels when user returns to tab (e.g., after joining in another tab)
  // Force full resync to pick up state changes (settlements, joins) that happened while away
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") refetch(true); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refetch]);
  const client = usePublicClient({ chainId: somnia.id });

  // Batched market terminal info (expiry + oracle finalization) for all loaded
  // duels — the input the shared state model needs to end LOCKED duels whose
  // market window has closed.
  const [terminalInfo, setTerminalInfo] = useState<Map<string, MarketTerminalInfo>>(new Map());
  useEffect(() => {
    if (duels.length === 0) return;
    let cancelled = false;
    fetchMarketTerminalInfo(duels.map((d) => d.address))
      .then((m) => { if (!cancelled) setTerminalInfo(m); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [duels]);

  // Highlight effect
  useEffect(() => {
    if (!highlight || highlightedRef.current || !client || duels.length === 0)
      return;

    const tryHighlight = async () => {
      let targetAddress: string | null = null;

      const isDuelAddress =
        highlight.startsWith("0x") && highlight.length === 42;
      if (isDuelAddress) {
        targetAddress = highlight.toLowerCase();
      } else {
        targetAddress = await resolveHighlightToClone(client, highlight);
      }

      if (!targetAddress) return;

      highlightRef.current = targetAddress;
      highlightedRef.current = true;

      const el = window.document.getElementById(
        `duel-${targetAddress}`
      );
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    };

    tryHighlight();
  }, [highlight, client, duels]);

  const filtered = duels
    .filter((d) => {
      if (filter === "All") return true;
      // Asset filter
      if (filter === "BTC" || filter === "ETH") return d.asset === filter;
      // Status filter — derived view state, so ended duels (expired market,
      // LOCKED on-chain) do not keep matching the "Live" filter.
      const view = terminalInfo.get(d.address.toLowerCase());
      const derived = deriveDuelView({
        chainState: d.state as DuelState,
        hasJoined: d.playerB !== "0x0000000000000000000000000000000000000000",
        joinDeadline: d.joinDeadline,
        marketExpiry: view?.expiry ?? undefined,
        indexerFinalized: view?.indexerFinalized ?? false,
        hasFinalAnswer: view?.hasFinalAnswer ?? false,
        hasOpeningAnswer: view?.hasOpeningAnswer ?? false,
        nowSec: Math.floor(Date.now() / 1000),
      });
      if (filter === "Open") return derived.phase === "waiting";
      if (filter === "Live") return derived.phase === "live";
      if (filter === "Settled")
        return derived.phase === "settled" || derived.phase === "ended-resolved" || derived.phase === "ended-pending";
      return true;
    })
    .sort((a, b) => {
      if (sort === "newest") return 0;
      return parseFloat(b.stakeAmount) - parseFloat(a.stakeAmount);
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
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence mode="popLayout">
              {filtered.map((duel, i) => (
                <motion.div
                  key={duel.address}
                  id={`duel-${duel.address.toLowerCase()}`}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ type: "spring", damping: 20, stiffness: 100, delay: i * 0.05 }}
                  layout
                >
                  <DuelCardOnChain
                    duel={duel}
                    terminal={terminalInfo.get(duel.address.toLowerCase())}
                    isHighlighted={
                      highlightRef.current === duel.address.toLowerCase()
                    }
                  />
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

function PlayerName({ address }: { address: string }) {
  const { displayName } = useSupabasePfp(address);
  if (displayName) {
    return <span className="font-body text-[11px] text-gray-300 truncate">{displayName}</span>;
  }
  return (
    <span className="font-mono text-[11px] text-gray-400 truncate">
      {address.slice(0, 6)}...{address.slice(-4)}
    </span>
  );
}

function DuelCardOnChain({
  duel,
  terminal,
  isHighlighted,
}: {
  duel: any;
  terminal?: MarketTerminalInfo;
  isHighlighted?: boolean;
}) {
  const nowSec = Math.floor(Date.now() / 1000);
  const view = deriveDuelView({
    chainState: duel.state as DuelState,
    hasJoined: duel.playerB !== "0x0000000000000000000000000000000000000000",
    joinDeadline: duel.joinDeadline,
    marketExpiry: terminal?.expiry ?? undefined,
    indexerFinalized: terminal?.indexerFinalized ?? false,
    hasFinalAnswer: terminal?.hasFinalAnswer ?? false,
    hasOpeningAnswer: terminal?.hasOpeningAnswer ?? false,
    nowSec,
  });
  const { phase } = view;
  const isOpen = phase === "waiting";
  const isExpired = phase === "open-expired";
  const isLive = phase === "live";
  const isEnded = view.isEnded && !isExpired; // ended contest (pending or resolved)
  const isSettled = phase === "settled";

  const stateColors: Record<string, string> = {
    waiting: "border-down/30 bg-down/5 hover:border-down/50",
    "open-expired": "border-down/20 bg-down/5",
    live: "border-yellow-400/30 bg-yellow-400/5",
    "ended-pending": "border-white/10 bg-white/[0.03]",
    "ended-resolved": "border-up/20 bg-up/5",
    settled: "border-up/30 bg-up/5",
    refunded: "border-white/5 bg-white/[0.02]",
    cancelled: "border-white/5 bg-white/[0.02]",
  };

  const badgeClass: Record<string, string> = {
    waiting: "bg-down/10 text-down border-down/20",
    "open-expired": "bg-orange-400/10 text-orange-400 border-orange-400/20",
    live: "bg-yellow-400/10 text-yellow-400 border-yellow-400/20",
    "ended-pending": "bg-white/5 text-gray-400 border-white/10",
    "ended-resolved": "bg-up/10 text-up border-up/20",
    settled: "bg-up/10 text-up border-up/20",
    refunded: "bg-white/5 text-gray-500 border-white/10",
    cancelled: "bg-white/5 text-gray-500 border-white/10",
  };

  return (
    <a
      href={`/duel/${duel.address}`}
      className={`block rounded-2xl border p-4 transition-all duration-200 group cursor-pointer ${
        stateColors[phase] || "border-white/10 bg-white/[0.03]"
      } ${isHighlighted ? "ring-2 ring-teal shadow-lg shadow-teal/20" : ""}`}
    >
      <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${duel.asset === "ETH" ? "bg-blue-500/15 text-blue-400" : "bg-orange-500/15 text-orange-400"}`}>
              <AssetIcon asset={duel.asset || "BTC"} className="h-4 w-4" />
            </div>
            <span className="font-body text-xs text-gray-400">{duel.asset || "BTC"} · Somnia</span>
        </div>
        <span className={`rounded-full border px-2.5 py-0.5 font-body text-[10px] font-medium uppercase tracking-wider ${
          badgeClass[phase] || "bg-white/5 text-gray-500 border-white/10"
        }`}>
          {view.label}
        </span>
      </div>

      <div className="flex items-center justify-between mb-3">
        <span className="font-display text-lg font-bold text-foam">{duel.stakeAmount} STT</span>
        {isLive && (
          <span className="text-xs text-yellow-400 font-medium">Live</span>
        )}
      </div>

      <div className="space-y-1.5 mb-3">
        <div className="flex items-center gap-2">
          <PlayerAvatar address={duel.playerA} label="A" />
          <PlayerName address={duel.playerA} />
        </div>
        {duel.playerB !== "0x0000000000000000000000000000000000000000" ? (
          <div className="flex items-center gap-2">
            <PlayerAvatar address={duel.playerB} label="B" />
            <PlayerName address={duel.playerB} />
          </div>
        ) : (
          <div className="flex items-center gap-2 opacity-40">
            <div className="h-5 w-5 rounded-full bg-white/5 flex items-center justify-center text-[10px] text-gray-500">?</div>
            <span className="font-body text-[11px] text-gray-500">Waiting for opponent...</span>
          </div>
        )}
      </div>

      <div className="pt-3 border-t border-white/5 flex items-center justify-between">
        {isExpired ? (
          <span className="font-body text-[10px] text-down">Deadline passed</span>
        ) : isOpen && duel.joinDeadline ? (
          <CountdownTimer targetTimestamp={duel.joinDeadline} size="sm" variant="join" />
        ) : isEnded ? (
          <span className="font-body text-[10px] text-gray-400">
            {phase === "ended-resolved" ? "Result final" : "Awaiting oracle"}
          </span>
        ) : (
          <span className="font-body text-[10px] text-gray-500">{view.label}</span>
        )}
        {isOpen && (
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
