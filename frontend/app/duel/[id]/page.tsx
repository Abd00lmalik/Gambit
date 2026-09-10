"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { useAccount } from "wagmi";
import { type Address } from "viem";
import { config } from "@/lib/config";
import AssetIcon from "@/components/AssetIcon";
import PlayerAvatar from "@/components/PlayerAvatar";
import CountdownTimer from "@/components/CountdownTimer";
import MarketSentimentBar from "@/components/MarketSentimentBar";
import OracleVerification from "@/components/OracleVerification";
import ResultPopup, { type ResultKind } from "@/components/ResultPopup";
import { useDuelReads, useDuelActions, useDuelResolution } from "@/hooks/useContracts";
import { useEnsureCorrectNetwork } from "@/hooks/useEnsureCorrectNetwork";
import { useSupabasePfp } from "@/hooks/useSupabaseProfile";
import { useLivePrices } from "@/hooks/useLivePrices";
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

export default function DuelPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const duelAddress = id as Address;
  const { address: connectedAddress } = useAccount();
  const [marketExpiry, setMarketExpiry] = useState<number | null>(null);
  const [marketData, setMarketData] = useState<DreamDexMarket | null>(null);
  const [marketLoading, setMarketLoading] = useState(true);

  const duel = useDuelReads(duelAddress);
  const prices = useLivePrices();
  // On-chain resolution mirrors Wager.settle()'s own market resolution:
  // wager.resolvedMarketContract() → module markets(marketId)[8] → [9] (pool).
  // The old code only tried the module re-derivation, so any mismatch between
  // what the frontend guessed and what the contract stored silently pinned the
  // page to "Waiting for DreamDEX market to resolve…" forever.
  const resolution = useDuelResolution(duelAddress, duel.marketId, marketData?.expiry);
  // Terminal = market resolved OR voided (either unlocks a contract action).
  const effectiveIsResolved = resolution.isTerminal;
  const isVoided = resolution.isVoided;
  const actions = useDuelActions(duelAddress);
  const { isCorrectNetwork, ensureCorrectNetwork, isChecking } = useEnsureCorrectNetwork();

  // Winner popup — fires once (per duel, per browser session) the moment the
  // on-chain market resolution is detected while the duel is still LOCKED.
  // Kept before the loading/not-found early returns so hook order is stable.
  const popupKey = `gambit-result-shown-${duelAddress.toLowerCase()}`;
  const [popupDismissed, setPopupDismissed] = useState(true);
  useEffect(() => {
    const ZERO = "0x0000000000000000000000000000000000000000";
    const joined = !!duel.playerB && duel.playerB !== ZERO;
    const mine =
      !!connectedAddress &&
      (duel.playerA?.toLowerCase() === connectedAddress.toLowerCase() ||
        duel.playerB?.toLowerCase() === connectedAddress.toLowerCase());
    const locked = (duel.state ?? -1) === DuelState.LOCKED;
    if (!(joined && mine && locked && resolution.isTerminal)) return;
    try {
      if (sessionStorage.getItem(popupKey)) return;
    } catch {}
    setPopupDismissed(false);
  }, [duel.playerA, duel.playerB, duel.state, connectedAddress, resolution.isTerminal, popupKey]);

  const dismissPopup = () => {
    try { sessionStorage.setItem(popupKey, "1"); } catch {}
    setPopupDismissed(true);
  };

  // Refetch duel data after join completes
  useEffect(() => {
    if (actions.joinStep === "done") {
      duel.refetch();
    }
  }, [actions.joinStep, duel.refetch]);

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

  // Winner = argmax(payoutNumerators) — settlement v3 stores a payout vector on the
  // market (no single winnerOutcome getter); [0]=Up/YES → player A, [1]=Down/NO → player B.
  // "tie" (both numerators equal & non-zero) → the contract auto-refunds on settle().
  const winnerSide = resolution.winnerSide; // "up" | "down" | "tie" | null
  const isWinner = effectiveIsResolved && ((winnerSide === "up" && isCreator) || (winnerSide === "down" && isJoiner));
  const isLoser = effectiveIsResolved && hasJoined && !isVoided && !isWinner &&
    (winnerSide === "up" ? isJoiner : winnerSide === "down" ? isCreator : false);
  const isParticipant = hasJoined && (isCreator || isJoiner);
  const resultKind: ResultKind = isVoided || winnerSide === "tie" ? "void" : isWinner ? "won" : "lost";
  // Funds-safety: market truth (derived from the market's own yesId slots) vs
  // what the DEPLOYED settle() will pay (hardcoded payouts[0]=Up). When they
  // differ, every claim UI is disabled and the mismatch banner explains — the
  // contract would transfer the pot to the wrong player.
  const payoutMismatch =
    effectiveIsResolved &&
    resolution.slotsKnown &&
    !!resolution.winnerSide &&
    !!resolution.contractWinnerSide &&
    resolution.winnerSide !== resolution.contractWinnerSide;

  // P1: Detect stuck duels — CREATED state, deadline passed, market resolved
  // The reactive auto-refund should have fired but didn't (subscription missing or callback reverted)
  const deadlinePassed = !!duel.joinDeadline && Math.floor(Date.now() / 1000) > duel.joinDeadline;
  const isStuck = state === DuelState.CREATED && deadlinePassed && effectiveIsResolved;

  // Creator refund: nobody joined, market resolved (even before deadline)
  // Uses factory.cancelDuel() which is permissionless and works before deadline if market resolved
  // Contract truth: after joinDeadline, factoryCancel() refunds the creator with NO
  // market dependency; before it, only if the market already resolved.
  const canCreatorRefund = state === DuelState.CREATED && !hasJoined && isCreator && (deadlinePassed || effectiveIsResolved);

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
            {isStuck ? "Stuck — Recovery Needed" : DUEL_STATE_LABELS[state]}
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
          <LiveChart
            asset={marketData?.asset ?? "BTC"}
            strike={marketData?.openingPrice ?? 0}
            currentPrice={prices.find(p => p.asset === (marketData?.asset ?? "BTC"))?.price}
            intervalMinutes={marketData?.intervalSec ? Math.round(marketData.intervalSec / 60) : undefined}
          />
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
            {effectiveIsResolved && (
              <span className={`font-body text-sm ${isVoided ? "text-yellow-400" : "text-up"}`}>
                {isVoided ? "Market voided — refund below" : "Market resolved — claim below"}
              </span>
            )}
          </motion.div>
        )}

        {/* Expiry notice if passed but not yet resolved */}
        {state === DuelState.LOCKED && marketData && marketData.expiry && Math.floor(Date.now() / 1000) > marketData.expiry && !effectiveIsResolved && (
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
          {/* Join button — only while the join window is open */}
          {!hasJoined && !isCreator && state === DuelState.CREATED && !deadlinePassed && (
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

          {/* Deployed-contract payout-slot mismatch: the market result says one side
              won, the on-chain settle() (which reads payouts[0] as “Up”) would
              pay the other. Claiming is disabled until the contract is fixed —
              the pot would otherwise go to the wrong player. */}
          {payoutMismatch && (
            <div className="rounded-xl border border-down/40 bg-down/10 p-4">
              <p className="font-body text-sm text-down font-medium">
                ⚠ DreamDEX market result: <span className="font-bold uppercase">{resolution.winnerSide}</span> won.
                The deployed escrow would pay <span className="font-bold uppercase">{resolution.contractWinnerSide}</span> (its winner rule
                assumes payouts[0] = Up, but this market’s payout vector is slot-inverted).
                Claim is disabled — fix: redeploy <span className="font-mono">Wager.settle()</span> deriving the slot from
                <span className="font-mono"> market.yesId()</span>, or settle via manual transfer by the counterparty.
              </p>
            </div>
          )}

          {/* Claim button — only visible to the winner when market resolved */}
          {hasJoined && state === DuelState.LOCKED && effectiveIsResolved && isWinner && !payoutMismatch && (
            <div className="rounded-xl border border-up/30 bg-up/5 p-5 mb-3">
              <div className="text-center mb-4">
                <p className="font-display text-2xl font-bold text-up mb-1">You Won!</p>
                <p className="font-body text-sm text-gray-400">
                  Pot: {duel.pot || "0"} STT · After 2.5% fee: {duel.pot ? (parseFloat(duel.pot) * 0.975).toFixed(3) : "0"} STT
                </p>
              </div>
              <button
                disabled={actions.isPending || isChecking}
                onClick={async () => {
                  try {
                    if (!isCorrectNetwork) {
                      await ensureCorrectNetwork();
                      return;
                    }
                    await actions.settleDuel();
                  } catch {}
                }}
                className="min-h-[52px] w-full rounded-xl bg-up py-3 font-display text-base font-bold text-carbon transition-all hover:bg-up/80 hover:shadow-lg hover:shadow-up/20 active:scale-[0.97] disabled:opacity-70"
              >
                {actions.isPending
                  ? "Claiming..."
                  : isChecking
                    ? "Switching Network..."
                    : !isCorrectNetwork
                      ? "Switch to Somnia Testnet"
                      : "Cashout →"}
              </button>
            </div>
          )}

          {/* Market voided (refund()) OR settled as a tie (settle() refunds
              both when p[0]==p[1]) — both stakes come back. */}
          {hasJoined && state === DuelState.LOCKED && (isVoided || winnerSide === "tie") && (
            <button
              disabled={actions.isPending || isChecking}
              onClick={async () => {
                try {
                  if (!isCorrectNetwork) {
                    await ensureCorrectNetwork();
                    return;
                  }
                  if (isVoided) await actions.refundDuel();
                  else await actions.settleDuel(); // contract auto-refunds on p0==p1
                } catch {}
              }}
              className="min-h-[52px] w-full rounded-xl bg-yellow-400 py-3 font-display text-base font-bold text-carbon transition-all hover:bg-yellow-400/80 active:scale-[0.97] disabled:opacity-70"
            >
              {actions.isPending ? "Refunding..." : "Refund Stakes →"}
            </button>
          )}

          {/* Market resolved but not the winner or can't determine winner — show settle for anyone (permissionless) */}
          {hasJoined && state === DuelState.LOCKED && effectiveIsResolved && !isVoided && winnerSide !== "tie" && !isWinner && !payoutMismatch && (
            <button
              disabled={actions.isPending || isChecking}
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
              {actions.isPending
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

          {/* Expired with no opponent — closed for everyone; creator reclaims below */}
          {state === DuelState.CREATED && !hasJoined && deadlinePassed && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
              <p className="font-display text-lg font-bold text-gray-400">Duel Expired</p>
              <p className="font-body text-sm text-gray-400 mt-1">
                {isCreator
                  ? "Nobody joined before the deadline — your stake can be reclaimed below."
                  : "Nobody joined and the join window closed. This duel is no longer accepting stakes."}
              </p>
            </div>
          )}

          {/* Creator refund — nobody joined (deadline passed or market resolved) */}
          {canCreatorRefund && !isStuck && (
            <div className="rounded-xl border border-yellow-400/30 bg-yellow-400/5 p-4">
              <p className="font-body text-sm text-yellow-400 font-medium mb-3">
                Nobody joined this duel — the join window closed. Reclaim your stake.
              </p>
              <button
                disabled={actions.isPending || isChecking}
                onClick={async () => {
                  try {
                    if (!isCorrectNetwork) {
                      await ensureCorrectNetwork();
                      return;
                    }
                    // Use factory.cancelDuel() — permissionless, works before deadline if market resolved
                    const { writeContract } = await import("wagmi/actions");
                    const { FACTORY_ADDRESS } = await import("@/lib/contracts");
                    const { FACTORY_ABI } = await import("@/lib/contracts");
                    await writeContract(config, {
                      address: FACTORY_ADDRESS,
                      abi: FACTORY_ABI,
                      functionName: "cancelDuel",
                      args: [duelAddress],
                      gas: BigInt(5000000),
                    });
                  } catch {}
                }}
                className="min-h-[52px] w-full rounded-xl bg-yellow-400 py-3 font-display text-base font-bold text-carbon transition-all hover:bg-yellow-400/80 active:scale-[0.97]"
              >
                {actions.isPending
                  ? "Reclaiming..."
                  : isChecking
                    ? "Switching Network..."
                    : !isCorrectNetwork
                      ? "Switch to Somnia Testnet"
                      : "Reclaim Stake →"}
              </button>
            </div>
          )}

          {/* Stuck duel — not the creator */}
          {isStuck && !isCreator && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
              <p className="font-body text-sm text-gray-400">
                This duel expired without an opponent. The creator can reclaim the stake.
              </p>
            </div>
          )}

          {/* Status messages */}
          {state === DuelState.SETTLED && (
            <div className="rounded-xl border border-up/20 bg-up/5 p-4 text-center">
              <p className="font-display text-lg font-bold text-up">Duel Settled</p>
              <p className="font-body text-sm text-gray-400 mt-1">Check your portfolio for results.</p>
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
          {hasJoined && state === DuelState.LOCKED && !effectiveIsResolved && (() => {
            if (resolution.claimsResolvedPrematurely && typeof window !== "undefined") {
              // Kept for forensics only — see the payout-slot note above; a
              // candidate answering isResolved() before expiry is ignored.
              console.debug("[gambit] suppressed premature resolution claim via", resolution.resolvedVia);
            }
            return null;
          })()}
          {hasJoined && state === DuelState.LOCKED && !effectiveIsResolved && (
            <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/5 p-4 text-center">
              <p className="font-body text-sm text-yellow-400">
                {resolution.candidates.length === 0
                  ? "Locating market contract on-chain…"
                  : resolution.ambiguousPayoutVector
                    ? "Market is still quoting (live payout vector — no side finalized) — waiting for DreamDEX settlement…"
                    : resolution.resolvedPayoutsPending
                    ? "Market reports resolved; waiting for the settlement payout vector…"
                    : resolution.anyCandidateAlive
                      ? "Waiting for DreamDEX market to resolve…"
                      : "Market contract unreachable — no readable address found for this market yet."}
              </p>
              {process.env.NODE_ENV !== "production" && (
                <p className="font-mono text-[10px] text-gray-500 mt-2">
                  candidates: {resolution.candidates.map((c) => `${c.label}${c.addr === resolution.effectiveMarketAddress ? " (effective)" : ""}`).join(" | ") || "none"}
                  eff: {resolution.effectiveMarketAddress ? `${resolution.effectiveMarketAddress.slice(0, 10)}…` : "—"}
                  {resolution.moduleError ? ` · module: ${String((resolution.moduleError as Error)?.message || "").slice(0, 80)}` : ""}
                  {resolution.storedReadError ? ` · stored: ${String((resolution.storedReadError as Error)?.message || "").slice(0, 80)}` : ""}
                </p>
              )}
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

      {/* Result popup — appears once when on-chain resolution is first detected */}
      <ResultPopup
        show={!popupDismissed && isParticipant && state === DuelState.LOCKED && effectiveIsResolved}
        kind={resultKind}
        pot={duel.pot}
        onDismiss={dismissPopup}
        onClaim={resultKind === "won" && !payoutMismatch ? async () => {
          try {
            if (!isCorrectNetwork) {
              await ensureCorrectNetwork();
              return;
            }
            await actions.settleDuel();
            dismissPopup();
          } catch {}
        } : undefined}
        claiming={actions.isPending}
      />
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
  const { displayName } = useSupabasePfp(address);
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
      <PlayerAvatar address={address} label={label} size="md" />
      {displayName ? (
        <span className="font-body text-[11px] text-gray-300 text-center">{displayName}</span>
      ) : (
        <span className="font-mono text-[11px] text-gray-400 text-center">
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
      )}
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
