"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useAccount, usePublicClient } from "wagmi";
import { encodeFunctionData, type Address } from "viem";
import { config } from "@/lib/config";
import AssetIcon from "@/components/AssetIcon";
import PlayerAvatar from "@/components/PlayerAvatar";
import CountdownTimer from "@/components/CountdownTimer";
import MarketSentimentBar from "@/components/MarketSentimentBar";
import OracleVerification from "@/components/OracleVerification";
import { useDuelReads, useDuelActions, useMarketStatus, useResolvedMarketAddress } from "@/hooks/useContracts";
import { useOracleResolution } from "@/hooks/useOracleResolution";
import { deriveDuelView, duelEndedMessage } from "@/lib/duelViewState";
import { useEnsureCorrectNetwork } from "@/hooks/useEnsureCorrectNetwork";
import { useSupabasePfp } from "@/hooks/useSupabaseProfile";
import { useLivePrices } from "@/hooks/useLivePrices";
import { DuelState, WAGER_ABI, FACTORY_ABI, FACTORY_ADDRESS } from "@/lib/contracts";
import { fetchMarketByAddress, DreamDexMarket } from "@/lib/dreamdex";
import ResultPopup, { type ResultKind } from "@/components/ResultPopup";
import { useSettlementGate } from "@/hooks/useSettlementGate";
import { revertReasonFromError } from "@/lib/revertReason";

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
  const { resolvedMarketAddress, poolAddress, moduleExpiry } = useResolvedMarketAddress(duel.marketId);
  // Use resolved Market contract for on-chain IBinaryMarket reads (isResolved, status, etc.)
  // NOT the raw CLOB listing address from duel.marketAddress, which may have no EVM code
  const market = useMarketStatus(resolvedMarketAddress);
  // Fallback: if market address has no code (Era 3), also check pool address
  const poolMarket = useMarketStatus(!market.isResolved && !market.isVoided ? poolAddress : undefined);
  // P1: genuine, final resolution — oracle answer + confirmed resolution tx +
  // expiry passed. Never trusts isResolved()/payouts alone (placeholders).
  const resolution = useOracleResolution(duel.marketAddress, moduleExpiry);
  const actions = useDuelActions(duelAddress);
  const { isCorrectNetwork, ensureCorrectNetwork, isChecking } = useEnsureCorrectNetwork();
  const publicClient = usePublicClient();
  const router = useRouter();

  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

  // ── Result popup state (restored feature) ───────────────────────────
  // Shows once per duel per browser session (sessionStorage guard), after a
  // short delay so resolution data has a beat to land.
  const popupKey = `gambit-result-shown-${(duelAddress ?? "").toLowerCase()}`;
  const [popupDismissed, setPopupDismissed] = useState(true);
  const [popupReady, setPopupReady] = useState(false);
  useEffect(() => {
    setPopupReady(false);
    let seen = false;
    try { seen = !!sessionStorage.getItem(popupKey); } catch {}
    setPopupDismissed(seen);
    const t = setTimeout(() => setPopupReady(true), 800);
    return () => clearTimeout(t);
  }, [popupKey]);
  const dismissResultPopup = useCallback(() => {
    setPopupDismissed(true);
    try { sessionStorage.setItem(popupKey, "1"); } catch {}
  }, [popupKey]);

  // ── Settlement gate: simulate settle() before asking the wallet to sign ──
  // Root cause of the failed cashout tx 0x8c5ac5ba…b954 (decoded revert:
  // "stale market record") is contract-level — DreamDEX recycles slot ids and
  // the module registration is one-time. That cannot be fixed client-side,
  // but we can stop submitting doomed txs and explain exactly why.
  const [settleNotice, setSettleNotice] = useState<string | null>(null);
  const [reclaimNotice, setReclaimNotice] = useState<string | null>(null);
  // Simulates settle() while the duel is LOCKED — blocks doomed txs before the
  // wallet is ever asked to sign, and exposes the contract's revert reason.
  const settlementGate = useSettlementGate(duelAddress, { whenChainState: DuelState.LOCKED });

  // Oracle-attested settlement for recycled slots: fetch the server attestation
  // (outcome derived from the SAME DreamDEX oracle data as the winner display —
  // winner determination itself is unchanged) and submit settleByOracle().
  // The winner's own click sends the tx and pays its gas — manual claim only.
  const settleByOraclePath = useCallback(async () => {
    if (!duelAddress) return;
    const res = await fetch("/api/attest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: duelAddress }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j?.error || "Attestation service unavailable.");
    }
    const att = await res.json();
    const { writeContract } = await import("wagmi/actions");
    await writeContract(config, {
      address: duelAddress,
      abi: WAGER_ABI,
      functionName: "settleByOracle",
      args: [att.upWon, BigInt(att.windowEnd), att.signature as `0x${string}`],
      gas: BigInt(500000),
    });
  }, [duelAddress]);

  const settleWithSimulation = useCallback(async () => {
    setSettleNotice(null);
    try {
      if (!isCorrectNetwork) {
        await ensureCorrectNetwork();
        return;
      }
      let staleRecord = false;
      if (publicClient && duelAddress) {
        // Simulate first: if the contract will revert, surface the real reason
        // instead of popping the wallet for a doomed transaction. The known
        // recycled-slot block ("stale market record") routes to the
        // oracle-attested payout path instead of failing.
        const data = encodeFunctionData({ abi: WAGER_ABI, functionName: "settle", args: [] });
        try {
          await publicClient.call({ to: duelAddress, data });
        } catch (simErr) {
          if (revertReasonFromError(simErr) !== "stale market record") throw simErr;
          staleRecord = true;
        }
      }
      if (staleRecord) {
        await settleByOraclePath();
        return;
      }
      await actions.settleDuel();
    } catch (e) {
      const message = e instanceof Error ? e.message : null;
      const reason = revertReasonFromError(e);
      setSettleNotice(
        reason
          ? `Settlement refused by the contract: "${reason}". Your funds stay safely escrowed.`
          : message
            ? `Cashout could not be completed: ${message}`
            : "Cashout could not be completed. Please try again."
      );
    }
  }, [publicClient, duelAddress, isCorrectNetwork, ensureCorrectNetwork, actions, settleByOraclePath]);

  const reclaimStake = useCallback(async () => {
    setReclaimNotice(null);
    try {
      if (!isCorrectNetwork) {
        await ensureCorrectNetwork();
        return;
      }
      // Use the duel's OWN factory cancelDuel() — permissionless and works
      // before deadline if the market resolved. Legacy duels were created by
      // the previous factory; reading factory() from the clone routes the
      // call correctly for both old and new duels.
      const { writeContract } = await import("wagmi/actions");
      const targetFactory = (duel.duelFactory && duel.duelFactory !== ZERO_ADDRESS
        ? duel.duelFactory
        : FACTORY_ADDRESS) as Address;
      await writeContract(config, {
        address: targetFactory,
        abi: FACTORY_ABI,
        functionName: "cancelDuel",
        args: [duelAddress],
        gas: BigInt(5000000),
      });
    } catch (e) {
      const reason = revertReasonFromError(e);
      setReclaimNotice(
        reason
          ? `Reclaim refused by the contract: "${reason}".`
          : "Reclaim could not be completed. Please try again."
      );
    }
  }, [isCorrectNetwork, ensureCorrectNetwork, duel.duelFactory, duelAddress]);

  // Refetch duel data after join completes
  useEffect(() => {
    if (actions.joinStep === "done") {
      duel.refetch();
    }
  }, [actions.joinStep, duel.refetch]);

  // ── Resolution gate (P1 fix — premature winner popup) ──────────────────
  // Root cause found on-chain (2026-09-10):
  //  1. DreamDEX Market contracts report isResolved() === true with PLACEHOLDER
  //     payouts ([10000000, 0]) while the market is still trading.
  //  2. WORSE: recurring DreamDEX series reuse marketIds and the
  //     BinaryMarketsModule record can point at a PAST window's Market contract
  //     (module expiry 2026-08-11 for a duel whose market expired 2026-09-10),
  //     freezing payouts at that old outcome — every duel on such a market
  //     showed the OLD outcome's winner, often prematurely and wrongly.
  //
  // The winner is now shown ONLY when the oracle's final answer exists, its
  // resolution tx is confirmed on-chain, the market's expiry has passed and the
  // indexer marks the market finalized (see useOracleResolution).
  const resolvedFromMarket = market.isResolved === true;
  const resolvedFromPool = !resolvedFromMarket && poolMarket.isResolved === true;
  const resolvedContractReportsResolved = resolvedFromMarket || resolvedFromPool;

  const nowSec = Math.floor(Date.now() / 1000);
  const expiryPassed = resolution?.expiryPassed ?? false;
  const effectiveIsResolved = resolution?.finalized ?? false;

  // Which side actually won, per the ORACLE (final price vs opening price).
  const oracleWinningSide = resolution?.winningSide ?? null;

  // Which side the on-chain contract claims won (placeholder-prone — used only
  // as a consistency check, never as the winner source).
  const contractWinningSide: "UP" | "DOWN" | null = (() => {
    if (!resolvedContractReportsResolved) return null;
    const payouts = resolvedFromMarket ? market.payoutNumerators : poolMarket.payoutNumerators;
    if (!payouts || payouts.length < 2) return null;
    const up = Number(payouts[0]) > 0;
    const down = Number(payouts[1]) > 0;
    if (up === down) return null; // split/void — no directional winner
    return up ? "UP" : "DOWN";
  })();

  // On-chain market record is stale (points at a different window) — a known
  // DreamDEX marketId-reuse bug. Settlement on-chain will (and must) refuse.
  const marketRecordStale = !!resolution?.moduleStale;
  const oracleVsContractMismatch =
    oracleWinningSide != null &&
    contractWinningSide != null &&
    oracleWinningSide !== contractWinningSide;


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

  // ── Sides (P2 fix) ──────────────────────────────────────────────────────
  // The creator's side is stored on the clone (creatorIsUp). Legacy clones
  // (pre creatorIsUp) revert the read → undefined → default true (old contract
  // implicitly assumed playerA = Up).
  const creatorUp = duel.creatorIsUp ?? true;
  const creatorSide = creatorUp ? "UP" : "DOWN";
  const joinerSide = creatorUp ? "DOWN" : "UP";

  // Winner: the ORACLE's winning side compared against the STORED sides.
  // (payoutNumerators are placeholder-prone — never the winner source.)
  const isWinner = (() => {
    if (!effectiveIsResolved || !oracleWinningSide) return false;
    if (isCreator) return creatorSide === oracleWinningSide;
    if (isJoiner) return joinerSide === oracleWinningSide;
    return false;
  })();

  // P1: Detect stuck duels — CREATED state, deadline passed, market resolved
  // The reactive auto-refund should have fired but didn't (subscription missing or callback reverted)
  const deadlinePassed = !!duel.joinDeadline && Math.floor(Date.now() / 1000) > duel.joinDeadline;
  const isStuck = state === DuelState.CREATED && deadlinePassed && market.isResolved;

  // Creator refund: nobody joined and the duel is finished for the creator —
  // either the join deadline passed or the market resolved before it (nobody
  // would join a resolved market). Uses factory.cancelDuel(), permissionless.
  const canCreatorRefund =
    state === DuelState.CREATED && !hasJoined && isCreator &&
    (deadlinePassed || effectiveIsResolved);

  // ── Result popup wiring ─────────────────────────────────────────────────
  const isParticipant = isCreator || isJoiner;
  const refundPopupFlow = canCreatorRefund && !isStuck;
  const winLossPopupFlow = hasJoined && state === DuelState.LOCKED && effectiveIsResolved && isParticipant;
  const resultKind: ResultKind = refundPopupFlow ? "refund" : isWinner ? "won" : "lost";
  const resultPopupShow = !popupDismissed && popupReady && (refundPopupFlow || winLossPopupFlow);
  // Plain function, NOT a hook: this code sits after the early returns above,
  // so a conditional useCallback here violated the Rules of Hooks (hook count
  // grew when duel data arrived → React error #310 crashed every duel page on
  // load). ResultPopup takes onDismiss as a plain prop — identity stability
  // is not required.
  const handlePopupDismiss = () => {
    dismissResultPopup();
    // The loser's flow ends the duel-card interaction: OK closes the popup and
    // exits the duel page. Winner/refund keep the page open (they may act).
    if (resultKind === "lost") router.push("/arena");
  };

  const settlementReasonText =
    settlementGate.state === "blocked" && settlementGate.staleMarketRecord
      ? "DreamDEX rotated this market slot: the on-chain market record belongs to an older window, so the contract refuses classic settlement to protect the funds. Use the Cashout button — it settles via the oracle-attested path signed from DreamDEX's verified outcome."
      : settlementGate.reason
        ? `The contract refused this settlement: "${settlementGate.reason}". Your funds stay safely escrowed.`
        : "The contract refused this settlement. Your funds stay safely escrowed.";

  // ── Shared derived view state ────────────────────────────────────────────
  // The on-chain Wager.state stays LOCKED until someone pushes settlement, so
  // raw chain state alone made ended duels render as "Live" forever. The
  // market/oracle pipeline is the authoritative terminal signal.
  const duelView = deriveDuelView({
    chainState: state,
    hasJoined,
    joinDeadline: duel.joinDeadline ?? undefined,
    marketExpiry: marketData?.expiry ?? resolution?.expiry ?? undefined,
    indexerFinalized: resolution?.indexerFinalized ?? false,
    hasFinalAnswer: resolution?.hasOracleAnswer ?? false,
    hasOpeningAnswer: resolution?.hasOracleAnswer ?? false,
    nowSec,
  });
  const phase = duelView.phase;

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
            phase === "live" ? "border-yellow-400/20 bg-yellow-400/5 text-yellow-400" :
            phase === "waiting" ? "border-teal/20 bg-teal/5 text-teal" :
            phase === "settled" || phase === "ended-resolved" ? "border-up/20 bg-up/5 text-up" :
            phase === "open-expired" ? "border-down/20 bg-down/5 text-down" :
            "border-white/10 bg-white/5 text-gray-400"
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${
              isStuck ? "bg-down animate-glow-pulse" :
              phase === "live" ? "bg-yellow-400 animate-glow-pulse" :
              phase === "waiting" ? "bg-teal animate-glow-pulse" :
              phase === "settled" || phase === "ended-resolved" ? "bg-up" :
              phase === "open-expired" ? "bg-down" : "bg-gray-400"
            }`} />
            {isStuck ? "Stuck — Recovery Needed" : duelView.label}
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
            side={creatorSide}
            stake={duel.stakeAmount || "0"}
            isCreator
            isActive={phase === "live"}
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
              side={joinerSide}
              stake={duel.stakeAmount || "0"}
              isActive={phase === "live"}
            />
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-white/10 p-4 md:p-6 min-w-[140px] md:min-w-[180px]">
              <div className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-white/5 flex items-center justify-center text-gray-500 text-lg">
                ?
              </div>
              <span className="font-body text-xs text-gray-500 text-center">
                {phase === "open-expired" ? "No opponent — expired" : "Waiting for opponent"}
              </span>
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
        {state === DuelState.LOCKED && marketData && marketData.expiry && phase === "live" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="flex flex-col items-center gap-2 glass rounded-xl p-4 mb-6"
          >
            <span className="font-body text-xs text-gray-400">Resolves in</span>
            <CountdownTimer targetTimestamp={marketData.expiry} size="lg" variant="resolve" />
          </motion.div>
        )}        {/* Terminal state banner — the contest is over (market window passed).
            Deterministic from the market/oracle pipeline, not the on-chain
            wager state (which stays LOCKED until someone pushes settlement). */}
        {(() => {
          const endedMessage = duelEndedMessage(duelView, {
            hasJoined,
            winnerSide: oracleWinningSide,
            viewerSide: isCreator ? creatorSide : isJoiner ? joinerSide : null,
          });
          if (!endedMessage) return null;
          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className={`flex flex-col items-center gap-2 glass rounded-xl p-4 mb-6 border ${
                phase === "ended-pending" ? "border-yellow-400/20 bg-yellow-400/5" :
                phase === "ended-resolved" ? "border-up/20 bg-up/5" :
                "border-down/20 bg-down/5"
              }`}>
              {/* P1: market contract may claim "resolved" with placeholder payouts
                  before the oracle finalizes — never show a winner in that window */}
              <span className={`font-body text-sm text-center ${
                phase === "ended-resolved" ? "text-up" : "text-gray-300"
              }`}>
                {endedMessage}
              </span>
            </motion.div>
          );
        })()}

        {/* Action buttons */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="space-y-3"
        >
          {/* P1: shown once the oracle outcome is final but on-chain settlement
              isn't safe. DreamDEX marketIds are recycled slot ids and the
              on-chain module record is a one-time slot registration (by design
              it points at an older window), so settling on-chain could pay the
              OLD window's outcome. Funds stay safely escrowed instead. */}
          {state === DuelState.LOCKED && effectiveIsResolved && (marketRecordStale || oracleVsContractMismatch) && (
            <div className="rounded-xl border border-yellow-400/30 bg-yellow-400/5 p-4 text-center">
              <p className="font-display text-base font-bold text-yellow-400 mb-1">Result verified — escrowed pending settlement path</p>
              <p className="font-body text-xs text-gray-400 leading-relaxed">
                DreamDEX rotated this market slot: the on-chain market record still belongs to an older
                window, so classic on-chain settlement is refused. The verified outcome
                {oracleWinningSide ? ` (${oracleWinningSide} won)` : ""} is shown above — the winner can
                cash out via the oracle-attested settlement path (signed from the same DreamDEX oracle data).
              </p>
            </div>
          )}

          {/* Live settlement gate: the simulation says settle() will revert —
              surface the CONTRACT's own reason instead of a doomed tx. */}
          {hasJoined && state === DuelState.LOCKED && effectiveIsResolved && settlementGate.state === "blocked" && (
            <div className="rounded-xl border border-yellow-400/30 bg-yellow-400/5 p-4 text-center">
              <p className="font-display text-base font-bold text-yellow-400 mb-1">Cashout blocked by the duel contract</p>
              <p className="font-body text-xs text-gray-400 leading-relaxed">{settlementReasonText}</p>
            </div>
          )}

          {/* Transient settlement error (revert reason caught at claim time) */}
          {settleNotice && (
            <div className="rounded-xl border border-down/30 bg-down/5 p-4 text-center">
              <p className="font-body text-xs text-down leading-relaxed">{settleNotice}</p>
            </div>
          )}

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

          {/* Claim button — only visible to the winner when the market has
              GENUINELY and FINALLY resolved (oracle-verified) and the on-chain
              market record is consistent (settle() can actually pay) */}
          {hasJoined && state === DuelState.LOCKED && effectiveIsResolved && isWinner && !oracleVsContractMismatch && (settlementGate.state !== "blocked" || settlementGate.staleMarketRecord) && (
            <div className="rounded-xl border border-up/30 bg-up/5 p-5 mb-3">
              <div className="text-center mb-4">
                <p className="font-display text-2xl font-bold text-up mb-1">You Won!</p>
                <p className="font-body text-sm text-gray-400">
                  Pot: {duel.pot || "0"} STT · After 2.5% fee: {duel.pot ? (parseFloat(duel.pot) * 0.975).toFixed(3) : "0"} STT
                </p>
              </div>
              <button
                disabled={actions.isPending || isChecking || settlementGate.state === "checking"}
                onClick={settleWithSimulation}
                className="min-h-[52px] w-full rounded-xl bg-up py-3 font-display text-base font-bold text-carbon transition-all hover:bg-up/80 hover:shadow-lg hover:shadow-up/20 active:scale-[0.97] disabled:opacity-70"
              >
                {actions.isPending
                  ? "Claiming..."
                  : isChecking
                    ? "Switching Network..."
                    : !isCorrectNetwork
                      ? "Switch to Somnia Testnet"
                      : settlementGate.state === "checking"
                        ? "Verifying settlement..."
                        : "Cashout →"}
              </button>
            </div>
          )}

          {/* Market genuinely resolved but connected wallet is not the winner —
              settle is permissionless, anyone can push the payout through */}
          {hasJoined && state === DuelState.LOCKED && effectiveIsResolved && !isWinner && !marketRecordStale && !oracleVsContractMismatch && settlementGate.state !== "blocked" && (
            <button
              disabled={actions.isPending || isChecking || settlementGate.state === "checking"}
              onClick={settleWithSimulation}
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

          {/* Creator refund — nobody joined, deadline passed or market resolved */}
          {canCreatorRefund && !isStuck && (
            <div className="rounded-xl border border-yellow-400/30 bg-yellow-400/5 p-4">
              <p className="font-body text-sm text-yellow-400 font-medium mb-3">
                {deadlinePassed
                  ? "Nobody joined before the deadline. Reclaim your stake."
                  : "Nobody joined this duel and the market has resolved. Reclaim your stake."}
              </p>
              <button
                disabled={actions.isPending || isChecking}
                onClick={reclaimStake}
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
              {reclaimNotice && (
                <p className="font-body text-xs text-down mt-3">{reclaimNotice}</p>
              )}
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

          {/* Contest in progress (market window still open) */}
          {hasJoined && state === DuelState.LOCKED && phase === "live" && (
            <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/5 p-4 text-center">
              <p className="font-body text-sm text-yellow-400">Contest live — the result is decided when the market closes.</p>
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

        {/* Result popup — restored feature: fires once per duel per session the
            moment genuine resolution (or reclaim eligibility) is detected.
            Loser: OK dismisses and exits the duel card. Winner: Cashout runs the
            settlement-gated claim. Creator (no joiner): Reclaim Stake. */}
        <ResultPopup
          show={resultPopupShow}
          kind={resultKind}
          pot={duel.pot}
          onDismiss={handlePopupDismiss}
          onClaim={
            resultKind === "won"
              ? settleWithSimulation
              : resultKind === "refund"
                ? reclaimStake
                : undefined
          }
          claiming={actions.isPending || settlementGate.state === "checking"}
        />
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
