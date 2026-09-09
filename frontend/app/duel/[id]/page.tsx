"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { useAccount } from "wagmi";
import { formatEther, type Address } from "viem";
import AssetIcon from "@/components/AssetIcon";
import CountdownTimer from "@/components/CountdownTimer";
import SettlementLatency from "@/components/SettlementLatency";
import MarketSentimentBar from "@/components/MarketSentimentBar";
import OracleVerification from "@/components/OracleVerification";
import { useDuelReads, useDuelActions, useMarketStatus, useResolvedMarketAddress } from "@/hooks/useContracts";
import { useEnsureCorrectNetwork } from "@/hooks/useEnsureCorrectNetwork";
import { DuelState, DUEL_STATE_LABELS, DUEL_STATE_COLORS } from "@/lib/contracts";
import { fetchMarketByAddress, DreamDexMarket } from "@/lib/dreamdex";

const LiveChart = dynamic(() => import("@/components/LiveChart"), { ssr: false });

async function fetchMarketExpiry(marketAddress: string): Promise<number | null> {
  const query = `{ Market(where: {marketAddress: {_eq: "${marketAddress}"}}, limit: 1) { expiry } }`;
  try {
    const res = await fetch("https://dev.smk.somnia.host/v1/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const data = await res.json();
    return data?.data?.Market?.[0]?.expiry ?? null;
  } catch {
    return null;
  }
}

// P1: Auto-trigger settle() for older-impl markets when market resolves
// This is permissionless - anyone can call settle() once the market is resolved
function useAutoSettle({
  duelAddress,
  state,
  marketAddress,
  marketIsResolved,
  settleDuel,
  isSettling,
}: {
  duelAddress: Address | undefined;
  state: number | undefined;
  marketAddress: Address | undefined;
  marketIsResolved: boolean;
  settleDuel: () => Promise<any>;
  isSettling: boolean;
}) {
  const settlingRef = useRef(false);
  const hasAutoSettledRef = useRef(false);

  const triggerSettle = useCallback(async () => {
    if (settlingRef.current || hasAutoSettledRef.current || !duelAddress || !marketAddress) return;
    if (state !== DuelState.LOCKED || !marketIsResolved) return;

    settlingRef.current = true;
    try {
      await settleDuel();
      hasAutoSettledRef.current = true;
    } catch (e) {
      // Ignore errors - another caller may have succeeded
      console.debug("Auto-settle failed (may have been called by another):", e);
    } finally {
      settlingRef.current = false;
    }
  }, [duelAddress, marketAddress, state, marketIsResolved, settleDuel]);

  // Trigger on mount and when conditions change
  useEffect(() => {
    if (state === DuelState.LOCKED && marketIsResolved && !isSettling) {
      triggerSettle();
    }
  }, [state, marketIsResolved, isSettling, triggerSettle]);

  // Also expose a manual trigger for the UI
  return { triggerSettle, isAutoSettling: settlingRef.current };
}

export default function DuelPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const duelAddress = id as Address;
  const { address: connectedAddress } = useAccount();
  const [marketExpiry, setMarketExpiry] = useState<number | null>(null);
  const [marketData, setMarketData] = useState<DreamDexMarket | null>(null);
  const [marketLoading, setMarketLoading] = useState(true);

  const duel = useDuelReads(duelAddress);
  const { resolvedMarketAddress } = useResolvedMarketAddress(duel.marketId);
  // Use resolved Market contract for on-chain IBinaryMarket reads (isResolved, status, etc.)
  // NOT the raw CLOB listing address from duel.marketAddress, which may have no EVM code
  const market = useMarketStatus(resolvedMarketAddress);
  const actions = useDuelActions(duelAddress);
  const { isCorrectNetwork, ensureCorrectNetwork, isChecking } = useEnsureCorrectNetwork();

  // Refetch duel data after join completes
  useEffect(() => {
    if (actions.joinStep === "done") {
      duel.refetch();
    }
  }, [actions.joinStep, duel.refetch]);

  // P1: Auto-trigger settle() for older-impl markets when market resolves
  // This is permissionless - anyone visiting the page can trigger it
  // MUST be called before any early returns (Rules of Hooks)
  const autoSettle = useAutoSettle({
    duelAddress,
    state: duel.state,
    marketAddress: resolvedMarketAddress,
    marketIsResolved: market.isResolved ?? false,
    settleDuel: actions.settleDuel,
    isSettling: actions.isPending,
  });

  // Fetch market data from DreamDEX indexer (reuses Create Duel logic)
  useEffect(() => {
    if (!duel.marketAddress) return;
    let cancelled = false;
    setMarketLoading(true);
    fetchMarketByAddress(duel.marketAddress)
      .then((data) => {
        if (!cancelled) {
          setMarketData(data);
          setMarketLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setMarketLoading(false);
      });
    return () => { cancelled = true; };
  }, [duel.marketAddress]);

  // Keep fetchMarketExpiry for SettlementLatency component
  useEffect(() => {
    if (duel.marketAddress) {
      fetchMarketExpiry(duel.marketAddress).then(setMarketExpiry);
    }
  }, [duel.marketAddress]);

  if (duel.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 border-2 border-teal border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="font-body text-sm text-gray-400">Loading duel...</p>
        </div>
      </div>
    );
  }

  if (!duel.playerA || duel.playerA === "0x0000000000000000000000000000000000000000") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-display text-2xl font-bold text-foam mb-2">Duel not found</h1>
          <a href="/arena" className="font-body text-sm text-teal hover:underline">Back to Arena</a>
        </div>
      </div>
    );
  }

  const state = duel.state ?? DuelState.CREATED;
  const isCreator = connectedAddress?.toLowerCase() === duel.playerA?.toLowerCase();
  const isJoiner = connectedAddress?.toLowerCase() === duel.playerB?.toLowerCase();
  const hasJoined = !!duel.playerB && duel.playerB !== "0x0000000000000000000000000000000000000000";

  // P1: Detect stuck duels — CREATED state, deadline passed, market resolved
  // The reactive auto-refund should have fired but didn't (subscription missing or callback reverted)
  const deadlinePassed = !!duel.joinDeadline && Math.floor(Date.now() / 1000) > duel.joinDeadline;
  const isStuck = state === DuelState.CREATED && deadlinePassed && market.isResolved;

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="mx-auto max-w-4xl">
        {/* Status badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <span className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 font-body text-xs ${
            isStuck ? "border-down/20 bg-down/5 text-down" :
            state === DuelState.CREATED ? "border-teal/20 bg-teal/5 text-teal" :
            state === DuelState.LOCKED ? "border-yellow-400/20 bg-yellow-400/5 text-yellow-400" :
            state === DuelState.SETTLED ? "border-up/20 bg-up/5 text-up" :
            "border-white/10 bg-white/5 text-gray-400"
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${
              isStuck ? "bg-down animate-glow-pulse" :
              state === DuelState.CREATED ? "bg-teal animate-glow-pulse" :
              state === DuelState.LOCKED ? "bg-yellow-400 animate-glow-pulse" :
              state === DuelState.SETTLED ? "bg-up" : "bg-gray-400"
            }`} />
            {isStuck ? "Stuck — Recovery Needed" : 
             autoSettle.isAutoSettling ? "Auto-Settling..." : 
             DUEL_STATE_LABELS[state]}
            {autoSettle.isAutoSettling && (
              <span className="ml-1.5 h-3 w-3 border-2 border-teal border-t-transparent rounded-full animate-spin" />
            )}
          </span>
        </motion.div>

        {/* VS Header with Market Question */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", damping: 15, stiffness: 80 }}
          className="flex items-center justify-center gap-4 md:gap-8 mb-8"
        >
          <PlayerCard
            label="A"
            address={duel.playerA!}
            side="UP"
            stake={duel.stakeAmount || "0"}
            isCreator
            isActive={state === DuelState.LOCKED}
          />
          <div className="flex flex-col items-center max-w-md md:max-w-lg">
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", damping: 10, stiffness: 150, delay: 0.3 }}
              className="font-display text-4xl md:text-5xl font-bold text-gradient"
            >
              VS
            </motion.span>
            {duel.pot && (
              <span className="font-body text-xs text-gray-400 mt-1">
                Pot: {duel.pot} STT
              </span>
            )}
            {/* Market Question */}
            {marketData && (
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="mt-3 text-center font-body text-sm text-foam max-w-xs md:max-w-md"
              >
                {marketData.displayQuestion || marketData.question}
              </motion.p>
            )}
            {!marketData && !marketLoading && (
              <span className="font-body text-xs text-gray-500 mt-2">Market details unavailable</span>
            )}
          </div>
          {hasJoined ? (
            <PlayerCard
              label="B"
              address={duel.playerB!}
              side="DOWN"
              stake={duel.stakeAmount || "0"}
              isActive={state === DuelState.LOCKED}
            />
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-white/10 p-4 md:p-6 min-w-[140px] md:min-w-[180px]">
              <div className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-white/5 flex items-center justify-center text-gray-500 text-lg">
                ?
              </div>
              <span className="font-body text-xs text-gray-500 text-center">Waiting for opponent</span>
            </div>
          )}
        </motion.div>

        {/* Chart with actual strike price */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-6"
        >
          <LiveChart asset={marketData?.asset ?? "BTC"} strike={marketData?.openingPrice ?? 0} />
        </motion.div>

        {/* Strike Price Display */}
        {marketData && marketData.openingPrice && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="flex items-center justify-center gap-3 mb-6 p-3 glass rounded-xl text-center"
          >
            <AssetIcon asset={marketData?.asset ?? "BTC"} className="h-5 w-5" />
            <span className="font-display text-lg font-bold text-foam">
              Strike: ${marketData.openingPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            {marketData.priceIsApproximate && (
              <span className="font-body text-[10px] text-gray-400 bg-white/5 px-2 py-0.5 rounded">~approx</span>
            )}
          </motion.div>
        )}

        {/* Market Sentiment */}
        {duel.marketAddress && state === DuelState.LOCKED && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-6"
          >
            <MarketSentimentBar marketAddress={duel.marketAddress} />
          </motion.div>
        )}

        {/* Countdown - Join deadline (CREATED) or Resolution countdown (LOCKED) */}
        {state === DuelState.CREATED && duel.joinDeadline && duel.joinDeadlineRemaining !== undefined && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="flex flex-col items-center gap-2 glass rounded-xl p-4 mb-6"
          >
            <span className="font-body text-xs text-gray-400">
              {deadlinePassed ? "Deadline passed" : "Join deadline in"}
            </span>
            {!deadlinePassed && (
              <CountdownTimer targetTimestamp={duel.joinDeadline} size="lg" variant="join" />
            )}
            {deadlinePassed && (
              <span className="font-body text-sm text-down">Deadline passed</span>
            )}
          </motion.div>
        )}

        {/* Resolution Countdown for LOCKED duels */}
        {state === DuelState.LOCKED && marketData && marketData.expiry && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="flex flex-col items-center gap-2 glass rounded-xl p-4 mb-6"
          >
            <span className="font-body text-xs text-gray-400">Resolves in</span>
            <CountdownTimer targetTimestamp={marketData.expiry} size="lg" variant="resolve" />
            {market.isResolved && (
              <span className="font-body text-sm text-up">Market resolved — settling...</span>
            )}
          </motion.div>
        )}

        {/* Expiry notice if passed but not yet resolved */}
        {state === DuelState.LOCKED && marketData && marketData.expiry && Math.floor(Date.now() / 1000) > marketData.expiry && !market.isResolved && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="flex flex-col items-center gap-2 glass rounded-xl p-4 mb-6 border border-down/20 bg-down/5"
          >
            <span className="font-body text-xs text-down">Market expiry passed, awaiting resolution...</span>
          </motion.div>
        )}

        {/* Action buttons */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="space-y-3"
        >
          {/* Join button (if not joined and not creator and deadline not passed) */}
          {!hasJoined && !isCreator && state === DuelState.CREATED && (
            <button
              disabled={actions.isPending || isChecking}
              onClick={async () => {
                try {
                  if (!isCorrectNetwork) {
                    await ensureCorrectNetwork();
                    return;
                  }
                  await actions.depositAndJoin(duel.stakeAmount || "0.5");
                } catch {}
              }}
              className="min-h-[52px] w-full rounded-xl bg-foam py-3 font-display text-base font-bold text-carbon transition-all hover:bg-foam-dark hover:shadow-lg hover:shadow-foam/20 active:scale-[0.97]"
            >
              {actions.isPending
                ? actions.joinStep === "deposit"
                  ? "Depositing STT..."
                  : "Joining..."
                : isChecking
                  ? "Switching Network..."
                  : !isCorrectNetwork
                    ? "Switch to Somnia Testnet"
                    : "Accept Challenge →"}
            </button>
          )}

          {/* Settle button (if both joined and market resolved) - includes auto-settle for older-impl */}
          {hasJoined && state === DuelState.LOCKED && market.isResolved && (
            <button
              disabled={actions.isPending || isChecking || autoSettle.isAutoSettling}
              onClick={async () => {
                try {
                  if (!isCorrectNetwork) {
                    await ensureCorrectNetwork();
                    return;
                  }
                  await actions.settleDuel();
                } catch {}
              }}
              className="min-h-[52px] w-full rounded-xl bg-teal py-3 font-display text-base font-bold text-carbon transition-all hover:bg-teal-light hover:shadow-lg hover:shadow-teal/20 active:scale-[0.97] disabled:opacity-70"
            >
              {autoSettle.isAutoSettling
                ? "Auto-settling..."
                : actions.isPending
                ? "Settling..."
                : isChecking
                  ? "Switching Network..."
                  : !isCorrectNetwork
                    ? "Switch to Somnia Testnet"
                    : "Settle Duel →"}
            </button>
          )}

          {/* Cancel button (only creator, only in CREATED state) */}
          {isCreator && state === DuelState.CREATED && !deadlinePassed && (
            <button
              disabled={actions.isPending || isChecking}
              onClick={async () => {
                try {
                  if (!isCorrectNetwork) {
                    await ensureCorrectNetwork();
                    return;
                  }
                  await actions.cancelDuel();
                } catch {}
              }}
              className="min-h-[52px] w-full rounded-xl border border-down/30 bg-down/5 py-3 font-display text-base font-bold text-down transition-all hover:bg-down/10 active:scale-[0.97]"
            >
              {actions.isPending
                ? "Cancelling..."
                : isChecking
                  ? "Switching Network..."
                  : !isCorrectNetwork
                    ? "Switch to Somnia Testnet"
                    : "Cancel Duel"}
            </button>
          )}

          {/* P1: Stuck duel recovery — market resolved but reactive auto-refund didn't fire */}
          {isStuck && isCreator && (
            <div className="rounded-xl border border-down/30 bg-down/5 p-4">
              <p className="font-body text-sm text-down font-medium mb-3">
                Auto-refund failed. The market has resolved but your stake was not returned automatically.
                Click below to recover your funds.
              </p>
              <button
                disabled={actions.isPending || isChecking}
                onClick={async () => {
                  try {
                    if (!isCorrectNetwork) {
                      await ensureCorrectNetwork();
                      return;
                    }
                    await actions.cancelDuel();
                  } catch {}
                }}
                className="min-h-[52px] w-full rounded-xl bg-down py-3 font-display text-base font-bold text-white transition-all hover:bg-down/80 active:scale-[0.97]"
              >
                {actions.isPending
                  ? "Recovering..."
                  : isChecking
                    ? "Switching Network..."
                    : !isCorrectNetwork
                      ? "Switch to Somnia Testnet"
                      : "Recover Funds →"}
              </button>
            </div>
          )}

          {/* Stuck duel — not the creator */}
          {isStuck && !isCreator && (
            <div className="rounded-xl border border-down/30 bg-down/5 p-4 text-center">
              <p className="font-body text-sm text-down">
                This duel is stuck. The creator needs to recover the funds.
              </p>
            </div>
          )}

          {/* Status messages */}
          {state === DuelState.SETTLED && (
            <div className="rounded-xl border border-up/20 bg-up/5 p-4 text-center">
              <p className="font-display text-lg font-bold text-up">Duel Settled</p>
              <p className="font-body text-sm text-gray-400 mt-1">Check your portfolio for results.</p>
              {duel.isReactiveSettlement && duel.settlementTriggeredAt && marketExpiry && (
                <div className="mt-3">
                  <SettlementLatency
                    settlementTriggeredAt={duel.settlementTriggeredAt}
                    marketExpiry={marketExpiry}
                  />
                </div>
              )}
              {duel.marketAddress && (
                <div className="mt-3">
                  <OracleVerification marketAddress={duel.marketAddress} />
                </div>
              )}
            </div>
          )}

          {state === DuelState.CANCELLED && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
              <p className="font-display text-lg font-bold text-gray-400">Duel Cancelled</p>
            </div>
          )}

          {state === DuelState.REFUNDED && (
            <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/5 p-4 text-center">
              <p className="font-display text-lg font-bold text-yellow-400">Refunded</p>
            </div>
          )}

          {/* Waiting for resolution */}
          {hasJoined && state === DuelState.LOCKED && !market.isResolved && (
            <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/5 p-4 text-center">
              <p className="font-body text-sm text-yellow-400">Waiting for DreamDEX market to resolve...</p>
            </div>
          )}

          {/* Tx hash display */}
          {actions.txHash && (
            <div className="text-center">
              <a
                href={`https://shannon-explorer.somnia.network/tx/${actions.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[11px] text-teal hover:underline"
              >
                View tx →
              </a>
            </div>
          )}
        </motion.div>

        {/* Duel info */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-8 glass rounded-2xl p-5"
        >
          <h3 className="font-display text-sm font-bold text-foam mb-3">Duel Details</h3>
          <div className="grid grid-cols-2 gap-3">
            <InfoRow label="Contract" value={`${duelAddress.slice(0, 8)}...`} />
            <InfoRow label="Market" value={duel.marketAddress ? `${duel.marketAddress.slice(0, 8)}...` : "—"} />
            <InfoRow label="Stake" value={`${duel.stakeAmount || "0"} STT`} />
            <InfoRow label="Pot" value={`${duel.pot || "0"} STT`} />
            <InfoRow label="Fee" value={duel.owner ? "2.5%" : "—"} />
            <InfoRow label="Chain" value="Somnia Testnet" />
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function PlayerCard({ label, address, side, stake, isCreator, isActive }: {
  label: string;
  address: string;
  side: string;
  stake: string;
  isCreator?: boolean;
  isActive: boolean;
}) {
  const isUp = side === "UP";
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className={`flex flex-col items-center gap-2 rounded-2xl border p-4 md:p-6 min-w-[140px] md:min-w-[180px] ${
        isActive
          ? isUp
            ? "border-up/30 bg-up/5 shadow-lg shadow-up/10"
            : "border-down/30 bg-down/5 shadow-lg shadow-down/10"
          : "border-white/10 bg-white/[0.03]"
      }`}
    >
      <div className={`h-10 w-10 md:h-12 md:w-12 rounded-full flex items-center justify-center font-display text-lg font-bold ${
        isUp ? "bg-up/15 text-up" : "bg-down/15 text-down"
      }`}>
        {label}
      </div>
      <span className="font-mono text-[11px] text-gray-400 text-center">
        {address.slice(0, 6)}...{address.slice(-4)}
      </span>
      <span className={`font-display text-xs font-semibold ${isUp ? "text-up" : "text-down"}`}>
        {isUp ? "▲ Up" : "▼ Down"} · {stake} STT
      </span>
    </motion.div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="font-body text-xs text-gray-400">{label}</span>
      <span className="font-mono text-xs text-foam">{value}</span>
    </div>
  );
}
