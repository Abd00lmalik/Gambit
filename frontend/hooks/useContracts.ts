"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import {
  useBlock,
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
  useBalance,
  usePublicClient,
} from "wagmi";
import { parseEther, formatEther, type Address } from "viem";
import {
  FACTORY_ADDRESS,
  FACTORY_ABI,
  WAGER_ABI,
  DREAMDEX_ABI,
  BINARY_MARKETS_MODULE_ADDRESS,
  BINARY_MARKETS_MODULE_ABI,
  DuelState,
} from "@/lib/contracts";
import { useEnsureCorrectNetwork } from "@/hooks/useEnsureCorrectNetwork";

export function useDuelFactory() {
  const { address } = useAccount();
  const { writeContractAsync, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash: txHash });
  const { ensureCorrectNetwork } = useEnsureCorrectNetwork();

  const createDuel = useCallback(
    async (marketAddress: Address, marketId: string, joinDeadlineSeconds: number, stakeEth: string) => {
      if (!address) throw new Error("Wallet not connected");
      const ok = await ensureCorrectNetwork();
      if (!ok) throw new Error("Wrong network");
      const deadline = Math.floor(Date.now() / 1000) + joinDeadlineSeconds;
      const hash = await writeContractAsync({
        address: FACTORY_ADDRESS,
        abi: FACTORY_ABI,
        functionName: "createDuel",
        args: [marketAddress, marketId as `0x${string}`, BigInt(deadline)],
        value: parseEther(stakeEth),
        gas: BigInt(5000000),
      });
      return hash;
    },
    [address, writeContractAsync, ensureCorrectNetwork]
  );

  return { createDuel, txHash, isPending: isPending || isConfirming, ensureCorrectNetwork };
}

export function useDuelActions(duelAddress: Address) {
  const { writeContractAsync, data: joinTxHash, isPending: isJoinPending } = useWriteContract();
  const { isLoading: isJoinConfirming } = useWaitForTransactionReceipt({ hash: joinTxHash });
  const { ensureCorrectNetwork } = useEnsureCorrectNetwork();

  const settleDuel = useCallback(async () => {
    const ok = await ensureCorrectNetwork();
    if (!ok) throw new Error("Wrong network");
    const hash = await writeContractAsync({
      address: duelAddress,
      abi: WAGER_ABI,
      functionName: "settle",
      gas: BigInt(2000000),
    });
    return hash;
  }, [duelAddress, writeContractAsync, ensureCorrectNetwork]);

  const refundDuel = useCallback(async () => {
    const ok = await ensureCorrectNetwork();
    if (!ok) throw new Error("Wrong network");
    const hash = await writeContractAsync({
      address: duelAddress,
      abi: WAGER_ABI,
      functionName: "refund",
      gas: BigInt(2000000),
    });
    return hash;
  }, [duelAddress, writeContractAsync, ensureCorrectNetwork]);

  const cancelDuel = useCallback(async () => {
    const ok = await ensureCorrectNetwork();
    if (!ok) throw new Error("Wrong network");
    const hash = await writeContractAsync({
      address: duelAddress,
      abi: WAGER_ABI,
      functionName: "cancel",
      gas: BigInt(2000000),
    });
    return hash;
  }, [duelAddress, writeContractAsync, ensureCorrectNetwork]);

  // ── Two-step deposit+join ──────────────────────────────
  // Somnia reverts writeContract with value. Player B must:
  //   1. sendTransaction (plain STT transfer) → triggers receive() → records deposit
  //   2. writeContract → calls join() → state transitions to LOCKED
  const [depositHash, setDepositHash] = useState<`0x${string}` | undefined>();
  const [joinStep, setJoinStep] = useState<"idle" | "deposit" | "join" | "done">("idle");
  const joinDuelRef = useRef<() => Promise<void>>();

  const publicClient = usePublicClient();

  // Watch deposit tx → when confirmed, auto-call join()
  useEffect(() => {
    if (joinStep !== "deposit" || !depositHash || !publicClient) return;

    let cancelled = false;
    const poll = setInterval(async () => {
      if (cancelled) return;
      try {
        const receipt = await publicClient.getTransactionReceipt({ hash: depositHash });
        if (cancelled || !receipt) return;
        clearInterval(poll);
        setJoinStep("join");
        joinDuelRef.current?.();
      } catch {}
    }, 2000);

    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [joinStep, depositHash, publicClient]);

  const depositAndJoin = useCallback(
    async (amountEth: string) => {
      if (!publicClient) throw new Error("No public client");
      const ok = await ensureCorrectNetwork();
      if (!ok) throw new Error("Wrong network");
      const walletClient = await (window as any).ethereum;
      const accounts = await (window as any).ethereum.request({ method: "eth_accounts" });
      if (!accounts?.[0]) throw new Error("Wallet not connected");

      // Step 1: Plain STT transfer to clone → triggers receive() → records deposit
      setJoinStep("deposit");
      const hash = await new Promise<`0x${string}`>((resolve, reject) => {
        (window as any).ethereum.request({
          method: "eth_sendTransaction",
          params: [{
            from: accounts[0],
            to: duelAddress,
            value: "0x" + BigInt(parseEther(amountEth).toString()).toString(16),
            gas: "0x" + (2500000).toString(16),
          }],
        }).then(resolve).catch(reject);
      });
      setDepositHash(hash);

      // Step 2 will be triggered by the watchTransactionReceipt effect above
      // Store the join callback so the watcher can call it
      joinDuelRef.current = async () => {
        try {
          await writeContractAsync({
            address: duelAddress,
            abi: WAGER_ABI,
            functionName: "join",
            gas: BigInt(2000000),
          });
          setJoinStep("done");
        } catch (e) {
          setJoinStep("idle");
          throw e;
        }
      };

      return hash;
    },
    [duelAddress, writeContractAsync, publicClient, ensureCorrectNetwork]
  );

  // Wait for join() tx confirmation
  const joinStepIsPending = joinStep === "deposit"
    ? true // waiting for deposit to confirm
    : joinStep === "join"
    ? isJoinPending || isJoinConfirming
    : false;

  return {
    settleDuel,
    refundDuel,
    cancelDuel,
    depositAndJoin,
    txHash: joinStep === "join" ? joinTxHash : depositHash,
    isPending: joinStepIsPending,
    joinStep,
  };
}

export function useDuelReads(duelAddress: Address | undefined) {
  const playerA = useReadContract({
    address: duelAddress,
    abi: WAGER_ABI,
    functionName: "playerA",
    query: { enabled: !!duelAddress },
  });

  const playerB = useReadContract({
    address: duelAddress,
    abi: WAGER_ABI,
    functionName: "playerB",
    query: { enabled: !!duelAddress },
  });

  const stakeAmount = useReadContract({
    address: duelAddress,
    abi: WAGER_ABI,
    functionName: "stakeAmount",
    query: { enabled: !!duelAddress },
  });

  const marketAddress = useReadContract({
    address: duelAddress,
    abi: WAGER_ABI,
    functionName: "marketAddress",
    query: { enabled: !!duelAddress },
  });

  const marketId = useReadContract({
    address: duelAddress,
    abi: WAGER_ABI,
    functionName: "marketId",
    query: { enabled: !!duelAddress },
  });

  const state = useReadContract({
    address: duelAddress,
    abi: WAGER_ABI,
    functionName: "state",
    query: { enabled: !!duelAddress, refetchInterval: 2000 },
  });

  const getPot = useReadContract({
    address: duelAddress,
    abi: WAGER_ABI,
    functionName: "getPot",
    query: { enabled: !!duelAddress, refetchInterval: 2000 },
  });

  const joinDeadline = useReadContract({
    address: duelAddress,
    abi: WAGER_ABI,
    functionName: "joinDeadline",
    query: { enabled: !!duelAddress },
  });

  const joinDeadlineRemaining = useReadContract({
    address: duelAddress,
    abi: WAGER_ABI,
    functionName: "joinDeadlineRemaining",
    query: { enabled: !!duelAddress, refetchInterval: 1000 },
  });

  const owner = useReadContract({
    address: duelAddress,
    abi: WAGER_ABI,
    functionName: "owner",
    query: { enabled: !!duelAddress },
  });

  const duelState = state.data !== undefined ? Number(state.data) as DuelState : undefined;

  return {
    playerA: playerA.data as Address | undefined,
    playerB: playerB.data as Address | undefined,
    stakeAmount: stakeAmount.data ? formatEther(stakeAmount.data) : undefined,
    marketAddress: marketAddress.data as Address | undefined,
    marketId: (marketId.data as `0x${string}`) || undefined,
    state: duelState,
    pot: getPot.data ? formatEther(getPot.data) : undefined,
    joinDeadline: joinDeadline.data ? Number(joinDeadline.data) : undefined,
    joinDeadlineRemaining: joinDeadlineRemaining.data ? Number(joinDeadlineRemaining.data) : undefined,
    owner: owner.data as Address | undefined,
    isLoading: playerA.isLoading || state.isLoading,
    refetch: () => {
      playerA.refetch();
      playerB.refetch();
      state.refetch();
      getPot.refetch();
      joinDeadlineRemaining.refetch();
    },
  };
}

export function useFactoryReads() {
  const feeRecipient = useReadContract({
    address: FACTORY_ADDRESS,
    abi: FACTORY_ABI,
    functionName: "feeRecipient",
  });

  const minStake = useReadContract({
    address: FACTORY_ADDRESS,
    abi: FACTORY_ABI,
    functionName: "minStake",
  });

  const maxStake = useReadContract({
    address: FACTORY_ADDRESS,
    abi: FACTORY_ABI,
    functionName: "maxStake",
  });

  return {
    feeRecipient: feeRecipient.data as Address | undefined,
    minStake: minStake.data ? formatEther(minStake.data) : undefined,
    maxStake: maxStake.data ? formatEther(maxStake.data) : undefined,
  };
}

/**
 * Resolves the canonical Market contract address from a Wager's marketId.
 * Returns BOTH the market (index 8) and pool (index 9) addresses from the
 * BinaryMarketsModule record, plus the raw record for diagnostics.
 * Polls every 10s so a page left open notices resolution without refresh.
 */
export function useResolvedMarketAddress(
  marketId: `0x${string}` | undefined,
  refetchMs = 10_000,
) {
  const record = useReadContract({
    address: BINARY_MARKETS_MODULE_ADDRESS,
    abi: BINARY_MARKETS_MODULE_ABI,
    functionName: "markets",
    args: marketId ? [marketId] : undefined,
    query: { enabled: !!marketId, refetchInterval: refetchMs },
  });

  const resolved = record.data as readonly unknown[] | undefined;
  const isZeroAddr = (a: unknown): a is Address =>
    typeof a === "string" && a !== "0x0000000000000000000000000000000000000000" && /^0x[0-9a-fA-F]{40}$/.test(a);

  const marketAddress = isZeroAddr(resolved?.[8]) ? (resolved[8] as Address) : undefined;
  const poolAddress = isZeroAddr(resolved?.[9]) ? (resolved[9] as Address) : undefined;

  return {
    resolvedMarketAddress: marketAddress,
    poolAddress,
    error: record.error ?? null,
    isLoading: record.isLoading,
  };
}

export function useMarketStatus(marketAddress: Address | undefined, refetchMs = 10_000) {
  const status = useReadContract({
    address: marketAddress,
    abi: DREAMDEX_ABI,
    functionName: "status",
    query: { enabled: !!marketAddress, refetchInterval: refetchMs },
  });

  const isResolved = useReadContract({
    address: marketAddress,
    abi: DREAMDEX_ABI,
    functionName: "isResolved",
    query: { enabled: !!marketAddress, refetchInterval: refetchMs },
  });

  const isVoided = useReadContract({
    address: marketAddress,
    abi: DREAMDEX_ABI,
    functionName: "isVoided",
    query: { enabled: !!marketAddress, refetchInterval: refetchMs },
  });

  // Always query payoutNumerators when address is available — don't gate on isResolved.
  // payoutNumerators is empty until resolved, so it doubles as a resolution signal for
  // contracts where isResolved() itself reverts (selector missing).
  const payoutNumerators = useReadContract({
    address: marketAddress,
    abi: DREAMDEX_ABI,
    functionName: "payoutNumerators",
    query: { enabled: !!marketAddress, refetchInterval: refetchMs },
  });

  // "Alive" means the address actually speaks the market interface: at least one
  // of isResolved()/payoutNumerators() answered (true OR false). A contract that
  // merely has some unrelated status() (e.g. a collateral pool) is NOT treated
  // as a market — it must answer the exact functions Wager.settle() requires.
  const alive =
    !!marketAddress && (isResolved.data !== undefined || payoutNumerators.data !== undefined);

  return {
    status: status.data !== undefined ? Number(status.data) : undefined,
    isResolved: isResolved.data ?? false,
    isVoided: isVoided.data ?? false,
    payoutNumerators: payoutNumerators.data as readonly bigint[] | undefined,
    readError: isResolved.error ?? payoutNumerators.error ?? null,
    addressAlive: alive,
  };
}

/**
 * Full on-chain resolution for a duel, mirroring Wager.settle()'s OWN logic so
 * the UI and the contract can never disagree:
 *
 *   1. `resolvedMarketContract()` — the canonical IBinaryMarket address the Wager
 *      stored at initialize() (exactly what settle() reads first).
 *   2. BinaryMarketsModule `markets(marketId)[8]` (market).
 *   3. BinaryMarketsModule `markets(marketId)[9]` (pool fallback — the "Era 3"
 *      path where index 8 had no code; matches Wager._resolveMarketContract).
 *
 * Only the FIRST candidate that actually answers `isResolved()`/`payoutNumerators()`
 * is the effective market — same pick settle() makes (`stored`, else module market,
 * else pool when the market slot had no code). A candidate reverting those reads
 * is skipped. A non-zero payout vector is NOT treated as resolution: markets
 * expose live payout vectors while trading (that heuristic is what declared a
 * winner before the market ever resolved).
 */
export function useDuelResolution(
  duelAddress: Address | undefined,
  marketId: `0x${string}` | undefined,
  /** Market expiry (unix secs) from DreamDEX. Terminality is only ACCEPTED at
   *  or after this instant — the settlement rule: gambit waits for the
   *  countdown to hit zero, then immediately reads the market's resolution
   *  from DreamDEX and declares the winner. Before expiry, nothing counts —
   *  even if some candidate contract answers isResolved()==true (the wager
   *  stores its market address at initialize(), so garbage answers can arrive
   *  the moment player B joins). */
  expirySec?: number,
) {
  // Coarse clock so the expiry gate re-evaluates without a manual refresh.
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 2000);
    return () => clearInterval(id);
  }, []);
  // Prefer the CHAIN clock (block timestamp) over the browser clock — a user's
  // skewed-forward clock must never open the settlement window early.
  const chainBlock = useBlock({
    watch: false,
    query: { enabled: !!expirySec, refetchInterval: 4_000 },
  });
  const clockSec =
    chainBlock.data?.timestamp !== undefined
      ? Number(chainBlock.data.timestamp)
      : expirySec
        ? undefined // expiry known but chain clock not yet → HOLD, don't trust local clock
        : nowSec;
  const nearOrPastExpiry = expirySec && clockSec !== undefined ? clockSec >= expirySec - 300 : !!expirySec;
  const pollMs = nearOrPastExpiry ? 3_000 : 10_000;
  // Terminality requires (a) the market's expiry is KNOWN (never open the gate
  // while the indexer row is still loading — that leak is what flashed a wrong
  // "You Won" pre-resolution), (b) the CHAIN clock is past it (5s skew grace).
  const terminalWindowOpen =
    !!expirySec && clockSec !== undefined && clockSec >= expirySec - 5;

  const stored = useReadContract({
    address: duelAddress,
    abi: WAGER_ABI,
    functionName: "resolvedMarketContract",
    query: { enabled: !!duelAddress, refetchInterval: pollMs },
  });
  const { resolvedMarketAddress: moduleMarket, poolAddress: modulePool, error: moduleError } =
    useResolvedMarketAddress(marketId, pollMs);

  const isUsable = (a: unknown): a is Address =>
    typeof a === "string" && /^0x[0-9a-fA-F]{40}$/.test(a) &&
    a !== "0x0000000000000000000000000000000000000000";

  // De-dupe candidates (stored addr is usually identical to moduleMarket).
  const storedAddr = isUsable(stored.data) ? (stored.data as Address) : undefined;
  const seen = new Set<string>();
  const candidates: { label: string; addr: Address }[] = [];
  for (const c of [
    { label: "wager.resolvedMarketContract", addr: storedAddr },
    { label: "module.markets()[market]", addr: moduleMarket },
    { label: "module.markets()[pool]", addr: modulePool },
  ] as const) {
    if (c.addr && isUsable(c.addr) && !seen.has(c.addr.toLowerCase())) {
      seen.add(c.addr.toLowerCase());
      candidates.push({ label: c.label, addr: c.addr });
    }
  }

  // Fixed hook slots (hooks can't be called in a loop).
  const s0 = useMarketStatus(candidates[0]?.addr, pollMs);
  const s1 = useMarketStatus(candidates[1]?.addr, pollMs);
  const s2 = useMarketStatus(candidates[2]?.addr, pollMs);
  const statuses = [s0, s1, s2].slice(0, candidates.length);

  // The EFFECTIVE market is the first candidate that speaks the market
  // interface — exactly the pick Wager.settle() makes: stored address if it has
  // code, else module markets()[8], else the [9] pool (Era-3 layout). Later
  // candidates are never consulted once one answers; and "resolved" is ONLY
  // what that market's own isResolved()/isVoided() say.
  let effectiveStatus: null | (typeof statuses)[number] = null;
  let effectiveLabel: string | null = null;
  for (let i = 0; i < statuses.length; i++) {
    if (statuses[i].addressAlive) {
      effectiveStatus = statuses[i];
      effectiveLabel = candidates[i].label;
      break;
    }
  }

  const marketResolved = effectiveStatus?.isResolved === true;
  const marketVoided = effectiveStatus?.isVoided === true;
  // Second layer of defense: a winner needs more than the market's bool —
  // an actual finalized payout vector (oracle sets p[0]/p[1] at settlement).
  // Some market builds report isResolved() from the payout DENOMINATOR, which
  // can be non-zero during trading; requiring decided numerators makes the
  // declaration safe against that too.
  // A FINALIZED binary settlement pays exactly one side: [D,0] or [0,D]
  // (void/tie = both equal, which settle() refunds). While a market is still
  // OPEN it can expose a LIVE odds vector like [57…, 43…] — both sides non-zero
  // and unequal. That must NEVER be able to declare a winner.
  const payoutsRaw = effectiveStatus?.payoutNumerators;
  const p0 = payoutsRaw?.[0] ?? BigInt(0);
  const p1 = payoutsRaw?.[1] ?? BigInt(0);
  const hasFinalizedPayouts =
    !!payoutsRaw && payoutsRaw.length >= 2 &&
    ((p0 > BigInt(0) && p1 === BigInt(0)) ||
      (p1 > BigInt(0) && p0 === BigInt(0)) ||
      (p0 > BigInt(0) && p0 === p1));
  // Both sides live & unequal → the market is quoting, not settling.
  const ambiguousPayoutVector =
    !!payoutsRaw && payoutsRaw.length >= 2 &&
    p0 > BigInt(0) && p1 > BigInt(0) && p0 !== p1;
  // A contract answering resolved BEFORE the market's expiry is ignored — the
  // duel settles on DreamDEX's resolution at the deadline, nothing else.
  const isVoided = marketVoided && terminalWindowOpen;
  const isTerminal =
    ((marketResolved && hasFinalizedPayouts && !ambiguousPayoutVector) || marketVoided) &&
    terminalWindowOpen;
  // Diagnostic: true when a candidate claimed terminal but we suppressed it
  // because the duel countdown hasn't finished (proves the gate is holding).
  const claimsResolvedPrematurely = (marketResolved || marketVoided) && !terminalWindowOpen;

  // Winner per the contract's own line in settle(): after requiring
  // market.isResolved() and !isVoided(), payouts equal → refund (tie),
  // p[0] > 0 → player A (creator/up), else player B (joiner/down).
  let winnerSide: "up" | "down" | "tie" | null = null;
  const payouts = isTerminal ? effectiveStatus?.payoutNumerators : undefined;
  if (isTerminal && !isVoided && payouts && payouts.length >= 2) {
    const v0 = payouts[0] ?? BigInt(0);
    const v1 = payouts[1] ?? BigInt(0);
    if (v0 > BigInt(0) || v1 > BigInt(0)) winnerSide = v0 === v1 ? "tie" : v0 > BigInt(0) ? "up" : "down";
  }

  return {
    // terminal = market reached a final state AND the duel's countdown has
    // actually finished (the settlement rule).
    isTerminal,
    terminalWindowOpen,
    claimsResolvedPrematurely,
    // isResolved() answered true but the payout vector isn't finalized yet —
    // we keep waiting instead of declaring. (Dev-visible diagnostic.)
    resolvedPayoutsPending: marketResolved && !hasFinalizedPayouts && terminalWindowOpen,
    // Live-odds payout vector (both sides non-zero, unequal) → market is
    // quoting, NOT settling. Exposed so the UI can say so explicitly.
    ambiguousPayoutVector,
    isResolved: marketResolved && hasFinalizedPayouts && !ambiguousPayoutVector && !marketVoided && terminalWindowOpen,
    isVoided,
    winnerSide,
    payoutNumerators: payouts,
    candidates,
    // Which candidate is the effective market (null = none alive yet). Surfaced for debugging.
    resolvedVia: effectiveLabel,
    effectiveMarketAddress: effectiveStatus ? candidates.find((c) => c.label === effectiveLabel)?.addr : undefined,
    moduleError: moduleError ?? null,
    storedReadError: stored.error ?? null,
    anyCandidateAlive: statuses.some((s) => s.addressAlive),
  };
}
