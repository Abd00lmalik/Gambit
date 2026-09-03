"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useAccount } from "wagmi";
import { formatEther, type Address } from "viem";
import { useDuelCreatedEvents } from "@/hooks/useDuelEvents";
import CountdownTimer from "@/components/CountdownTimer";
import { DuelState, DUEL_STATE_LABELS } from "@/lib/contracts";
import AssetIcon from "@/components/AssetIcon";

const TABS = ["Active", "Pending", "Past"] as const;

export default function PortfolioPage() {
  const { address: connectedAddress } = useAccount();
  const { duels, isLoading } = useDuelCreatedEvents();

  const [tab, setTab] = useState<(typeof TABS)[number]>("Active");

  const userDuels = useMemo(() => {
    if (!connectedAddress) return [];
    return duels.filter(
      (d) =>
        d.playerA.toLowerCase() === connectedAddress.toLowerCase() ||
        d.playerB.toLowerCase() === connectedAddress.toLowerCase()
    );
  }, [duels, connectedAddress]);

  const activeDuels = useMemo(
    () => userDuels.filter((d) => d.state === DuelState.LOCKED),
    [userDuels]
  );
  const pendingDuels = useMemo(
    () => userDuels.filter((d) => d.state === DuelState.CREATED),
    [userDuels]
  );
  const pastDuels = useMemo(
    () =>
      userDuels.filter(
        (d) =>
          d.state === DuelState.SETTLED ||
          d.state === DuelState.CANCELLED ||
          d.state === DuelState.REFUNDED
      ),
    [userDuels]
  );

  const current =
    tab === "Active" ? activeDuels : tab === "Pending" ? pendingDuels : pastDuels;

  if (!connectedAddress) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-display text-2xl font-bold text-foam mb-2">
            Connect your wallet
          </h1>
          <p className="font-body text-sm text-gray-400">
            Connect your wallet to see your duels.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", damping: 20, stiffness: 80 }}
          className="mb-8"
        >
          <h1 className="font-display text-3xl md:text-4xl font-bold text-foam mb-2">
            My Duels
          </h1>
          <p className="font-body text-gray-400">
            Your active, pending, and past duels.
          </p>
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex rounded-xl border border-white/10 bg-white/[0.03] p-1 mb-6 w-fit"
        >
          {TABS.map((t) => {
            const count =
              t === "Active"
                ? activeDuels.length
                : t === "Pending"
                ? pendingDuels.length
                : pastDuels.length;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`min-h-[40px] rounded-lg px-5 py-2 font-body text-sm font-medium transition-all duration-200 flex items-center gap-2 cursor-pointer ${
                  tab === t
                    ? "bg-teal text-carbon"
                    : "text-gray-400 hover:text-foam"
                }`}
              >
                {t}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    tab === t
                      ? "bg-carbon/20 text-carbon"
                      : "bg-white/10 text-gray-500"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </motion.div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-xl border border-white/5 bg-white/[0.02] p-4 animate-pulse"
              >
                <div className="h-4 bg-white/5 rounded w-1/3 mb-2" />
                <div className="h-3 bg-white/5 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : current.length > 0 ? (
          <div className="space-y-3">
            {current.map((duel, i) => (
              <motion.div
                key={duel.address}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <DuelRow
                  duel={duel}
                  userAddress={connectedAddress}
                />
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="font-body text-gray-500">
              {tab === "Active" && "No active duels. Join one from the Arena."}
              {tab === "Pending" && "No pending duels. Create one to get started."}
              {tab === "Past" && "No past duels yet."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function DuelRow({
  duel,
  userAddress,
}: {
  duel: {
    address: Address;
    playerA: Address;
    playerB: Address;
    stakeAmount: string;
    state: number;
    joinDeadline: number;
  };
  userAddress: string;
}) {
  const state = duel.state as DuelState;
  const isActive = state === DuelState.LOCKED;
  const isOpen = state === DuelState.CREATED;
  const isSettled = state === DuelState.SETTLED;
  const isCancelled = state === DuelState.CANCELLED;
  const isRefunded = state === DuelState.REFUNDED;
  const isCreator =
    duel.playerA.toLowerCase() === userAddress.toLowerCase();
  const hasJoined =
    duel.playerB !== "0x0000000000000000000000000000000000000000";

  const opponent = isCreator ? duel.playerB : duel.playerA;
  const opponentShort =
    opponent !== "0x0000000000000000000000000000000000000000"
      ? `${opponent.slice(0, 6)}...${opponent.slice(-4)}`
      : "Waiting...";

  return (
    <a
      href={`/duel/${duel.address}`}
      className={`flex items-center gap-4 rounded-xl border p-4 transition-all duration-200 group cursor-pointer ${
        isActive
          ? "border-teal/30 bg-teal/5 hover:border-teal/50"
          : isSettled
          ? "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
          : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
      }`}
    >
      {/* Asset badge */}
      <div
        className={`h-10 w-10 rounded-lg flex items-center justify-center font-display text-sm font-bold flex-shrink-0 bg-orange-500/15 text-orange-400`}
      >
        <AssetIcon asset="BTC" className="h-5 w-5" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span
            className={`font-display text-sm font-bold ${
              isActive ? "text-teal" : isSettled ? "text-gray-400" : "text-foam"
            }`}
          >
            {isCreator ? "You created" : "You joined"}
          </span>
          <span className="font-body text-xs text-gray-500">·</span>
          <span className="font-body text-xs text-gray-400">
            vs {opponentShort}
          </span>
        </div>
        <span className="font-body text-xs text-gray-500">
          {DUEL_STATE_LABELS[state] || "Unknown"}
        </span>
      </div>

      {/* Stake */}
      <div className="text-right flex-shrink-0">
        <p className="font-display text-sm font-bold text-foam">
          {duel.stakeAmount} STT
        </p>
        {isSettled && (
          <p className="font-body text-[10px] font-medium text-gray-400">
            Settled
          </p>
        )}
        {isCancelled && (
          <p className="font-body text-[10px] font-medium text-gray-500">
            Cancelled
          </p>
        )}
        {isRefunded && (
          <p className="font-body text-[10px] font-medium text-yellow-400">
            Refunded
          </p>
        )}
      </div>

      {/* Countdown / Status */}
      <div className="flex-shrink-0 w-20">
        {isActive && (
          <CountdownTimer
            targetTimestamp={duel.joinDeadline}
            size="sm"
            variant="resolve"
          />
        )}
        {isOpen && (
          <CountdownTimer
            targetTimestamp={duel.joinDeadline}
            size="sm"
            variant="join"
          />
        )}
        {isSettled && (
          <span className="rounded-full bg-white/5 border border-white/10 px-2.5 py-0.5 font-body text-[10px] text-gray-400 block text-center">
            Settled
          </span>
        )}
        {(isCancelled || isRefunded) && (
          <span className="rounded-full bg-white/5 border border-white/10 px-2.5 py-0.5 font-body text-[10px] text-gray-500 block text-center">
            {DUEL_STATE_LABELS[state]}
          </span>
        )}
      </div>
    </a>
  );
}
