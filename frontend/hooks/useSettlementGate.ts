"use client";

// Settlement gate: simulates the duel's settle() (or the factory-refund path's
// cancel()) against the chain BEFORE asking the wallet to sign.
//
// Root cause this addresses (verified on-chain 2026-09-10 via failed tx
// 0x8c5ac5ba…b954, decoded revert "stale market record"): DreamDEX marketIds
// are recycled slot ids; the BinaryMarketsModule registration is a one-time
// record from the slot's FIRST window, and every later window's market/pool
// contracts are self-destructed (0 code). Wager.settle()'s anti-wrong-payout
// guard then reverts deterministically — unfixable client-side; funds are
// intentionally held escrowed by the contract.
//
// This hook does NOT change winner determination (oracle answer + expiry, in
// useOracleResolution). It only prevents doomed txs and explains the block.

import { useCallback, useEffect, useState } from "react";
import { usePublicClient, useReadContract } from "wagmi";
import { encodeFunctionData, type Address } from "viem";
import { WAGER_ABI } from "@/lib/contracts";
import { revertReasonFromError } from "@/lib/revertReason";

export interface SettlementGate {
  /** unknown = nothing to simulate (wrong chain state), checking, allowed, blocked */
  state: "unknown" | "checking" | "allowed" | "blocked";
  /** contract revert reason when blocked (e.g. "stale market record") */
  reason: string | null;
  /** true when the block is the known recycled-slot stale-record case */
  staleMarketRecord: boolean;
  recheck: () => void;
}

export function useSettlementGate(
  duelAddress: Address | undefined,
  opts: {
    /** only simulate while the duel is in this on-chain Wager state (settle → 1, cancel → 0) */
    whenChainState: number;
  }
) {
  const publicClient = usePublicClient();
  const [attempt, setAttempt] = useState(0);
  const recheck = useCallback(() => setAttempt((n) => n + 1), []);

  const { data: chainState } = useReadContract({
    address: duelAddress,
    abi: WAGER_ABI,
    functionName: "state",
    query: { enabled: !!duelAddress, refetchInterval: 5000 },
  });

  const shouldSimulate =
    !!duelAddress && !!publicClient && chainState !== undefined && Number(chainState) === opts.whenChainState;

  const [gate, setGate] = useState<Omit<SettlementGate, "recheck">>({
    state: "unknown",
    reason: null,
    staleMarketRecord: false,
  });

  useEffect(() => {
    if (!shouldSimulate || !publicClient || !duelAddress) {
      setGate({ state: "unknown", reason: null, staleMarketRecord: false });
      return;
    }
    let cancelled = false;
    setGate((g) => ({ ...g, state: "checking" }));
    (async () => {
      try {
        const data = encodeFunctionData({ abi: WAGER_ABI, functionName: "settle", args: [] });
        await publicClient.call({ to: duelAddress, data });
        if (!cancelled) setGate({ state: "allowed", reason: null, staleMarketRecord: false });
      } catch (e) {
        if (cancelled) return;
        const reason = revertReasonFromError(e);
        setGate({
          state: "blocked",
          reason: reason ?? "settlement reverted on-chain",
          staleMarketRecord: reason === "stale market record",
        });
      }
    })();
    // re-simulate periodically: block timestamp advances, records can change
    const t = setInterval(() => setAttempt((n) => n + 1), 30000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duelAddress, shouldSimulate, publicClient, attempt]);

  return { ...gate, recheck };
}
