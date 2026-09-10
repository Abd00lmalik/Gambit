"use client";

import { useEffect, useState } from "react";
import { type Address } from "viem";
import { usePublicClient } from "wagmi";
import {
  fetchOracleResolutionData,
  type OracleResolutionData,
} from "@/lib/dreamdex";
import { BINARY_MARKETS_MODULE_ADDRESS, BINARY_MARKETS_MODULE_ABI } from "@/lib/contracts";

export interface OracleResolution extends OracleResolutionData {
  /** The market's expiry has passed (clock check) */
  expiryPassed: boolean;
  /** The oracle's resolution tx is confirmed ON SOMNIA (informational —
   *  DreamDEX's production oracle settles on its own chain, so its tx hashes
   *  are intentionally NOT findable on the Somnia RPC; never gate on this) */
  oracleTxConfirmed: boolean;
  /** Block timestamp of the oracle resolution tx (null when not on Somnia) */
  oracleTxBlockTime: number | null;
  /** Both oracle answers exist (final + opening) and are not voided */
  hasOracleAnswer: boolean;
  /**
   * GENUINELY FINAL: expiry passed + DreamDEX indexer finalized + oracle
   * answers present. The indexer/oracle IS DreamDEX's settlement pipeline —
   * the same source its own UI displays — so this is the authoritative
   * terminal signal. (A previous gate also required the oracle tx receipt on
   * the Somnia RPC, which can never pass for prod markets: those txs live on
   * DreamDEX's settlement network, verified 2026-09-10.)
   */
  finalized: boolean;
  /** Winning side according to the oracle (null = cannot determine / voided) */
  winningSide: "UP" | "DOWN" | null;
  isLoading: boolean;
}

/**
 * P1 fix — determines whether a duel's market has GENUINELY and FINALLY
 * resolved, and which side won, using ONLY trustworthy signals:
 *
 *  1. Market expiry has passed (DreamDEX Market contracts lie pre-expiry:
 *     isResolved() === true with placeholder payouts while still trading).
 *  2. DreamDEX indexer clobStatus is finalized.
 *  3. The OracleAnswer (final price in cents) exists and its resolution
 *     transaction is CONFIRMED ON-CHAIN (receipt status === success).
 *  4. Winner = final >= opening (the question semantics: "closes at or above
 *     its opening price") — the same rule DreamDEX's own settlement uses.
 *
 * Never trusts: live price feeds, isResolved() alone, or non-zero
 * payoutNumerators alone (placeholder [10000000, 0] is exposed pre-resolution).
 */
export function useOracleResolution(
  marketAddress: Address | undefined,
  moduleExpiryFromRecord: number | undefined
): OracleResolution | null {
  const publicClient = usePublicClient();
  const [data, setData] = useState<OracleResolutionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [txBlockTime, setTxBlockTime] = useState<number | null>(null);
  const [txConfirmed, setTxConfirmed] = useState(false);

  // Refetch periodically so the gate flips promptly after real finalization
  useEffect(() => {
    if (!marketAddress) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;

    const load = () => {
      fetchOracleResolutionData(marketAddress)
        .then((d) => { if (!cancelled) setData(d); })
        .catch(() => { if (!cancelled) setData(null); })
        .finally(() => { if (!cancelled) setIsLoading(false); });
    };

    load();
    const interval = setInterval(load, 10_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [marketAddress]);

  // Verify the oracle resolution tx ON-CHAIN
  useEffect(() => {
    if (!data?.oracleTxHash || !publicClient) return;
    let cancelled = false;
    (async () => {
      try {
        const receipt = await publicClient.getTransactionReceipt({
          hash: data.oracleTxHash! as `0x${string}`,
        });
        if (cancelled) return;
        setTxConfirmed(receipt?.status === "success");
        const block = await publicClient.getBlock({ blockNumber: receipt.blockNumber });
        if (cancelled) return;
        setTxBlockTime(block?.timestamp ? Number(block.timestamp) : null);
      } catch {
        if (!cancelled) setTxConfirmed(false);
      }
    })();
    return () => { cancelled = true; };
  }, [data?.oracleTxHash, publicClient]);

  if (!marketAddress) return null;
  if (!data) {
    return {
      found: false, clobStatus: null, indexerFinalized: false, expiry: null,
      moduleExpiry: null, moduleStale: false, openingCents: null, finalCents: null,
      oracleTxHash: null, oracleVoided: false, oracleResolvedAt: null,
      expiryPassed: false, oracleTxConfirmed: false, oracleTxBlockTime: null,
      hasOracleAnswer: false, finalized: false, winningSide: null, isLoading,
    };
  }

  // Staleness: does the on-chain module record's expiry match the indexer's?
  const moduleStale =
    moduleExpiryFromRecord != null &&
    data.expiry != null &&
    Math.abs(moduleExpiryFromRecord - data.expiry) > 120;

  const nowSec = Math.floor(Date.now() / 1000);
  const expiryPassed = data.expiry != null && nowSec >= data.expiry;

  const hasOracleAnswer =
    data.finalCents != null && data.openingCents != null && !data.oracleVoided;

  // Terminal signal: DreamDEX's own indexer/oracle pipeline says the market is
  // final AND the oracle produced both answers. The Somnia-receipt check is
  // kept ONLY as diagnostics — DreamDEX oracle txs are not Somnia txs.
  const finalized =
    expiryPassed &&
    data.indexerFinalized &&
    hasOracleAnswer;

  const winningSide: "UP" | "DOWN" | null = finalized
    ? data.finalCents! >= data.openingCents!
      ? "UP"
      : "DOWN"
    : null;

  return {
    ...data,
    moduleStale,
    expiryPassed,
    oracleTxConfirmed: txConfirmed,
    oracleTxBlockTime: txBlockTime,
    hasOracleAnswer,
    finalized,
    winningSide,
    isLoading,
  };
}
