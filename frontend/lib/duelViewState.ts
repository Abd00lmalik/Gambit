// Derived duel view state — the single interpretation of "what state is this
// duel in RIGHT NOW" shared by the Arena listing and the duel detail page.
//
// Why this exists: the on-chain Wager state (CREATED/LOCKED/SETTLED/…) only
// changes when someone sends a transaction. A LOCKED duel whose market window
// has ended stays LOCKED=1 on-chain until settlement is pushed, so rendering
// the raw chain state made ended duels look LIVE forever. The authoritative
// terminal signal for "the contest is over" is the MARKET (DreamDEX oracle:
// indexer clobStatus + OracleAnswer), not the wager contract.
//
// Inputs are intentionally primitive so this stays pure and unit-testable:
// no hooks, no Date.now() inside — callers pass `nowSec`.

import { DuelState } from "@/lib/contracts";

export interface DuelViewInput {
  /** On-chain Wager.state (undefined while loading) */
  chainState: DuelState | undefined;
  /** PlayerB joined? (false = waiting for opponent) */
  hasJoined: boolean;
  /** Wager join deadline (UTC seconds) — the join window boundary */
  joinDeadline?: number;
  /** DreamDEX market expiry (UTC seconds) — the contest boundary */
  marketExpiry?: number;
  /** DreamDEX indexer finalization (clobStatus Finalized/Settled/Resolved) */
  indexerFinalized: boolean;
  /** OracleAnswer for the market question exists and is not voided */
  hasFinalAnswer: boolean;
  /** OracleAnswer for the reference (opening) question exists */
  hasOpeningAnswer: boolean;
  nowSec: number;
}

export type DuelViewPhase =
  | "loading"          // chain state not read yet
  | "waiting"          // CREATED, join window still open
  | "open-expired"     // CREATED but nobody joined before the deadline (terminal)
  | "live"             // LOCKED, market window still open
  | "ended-pending"    // contest over; oracle finalization not yet verifiable
  | "ended-resolved"   // contest over; oracle outcome final (winner shown)
  | "settled"          // on-chain payout done
  | "refunded"         // on-chain refund done
  | "cancelled";       // on-chain cancel done

export interface DuelView {
  phase: DuelViewPhase;
  /** true once the contest can never become live/waiting again */
  isTerminal: boolean;
  /** true while the duel should be presented as "no longer live" */
  isEnded: boolean;
  /** Oracle winner once resolved: "UP" | "DOWN" (null otherwise) — caller supplies */
  winnerSide?: "UP" | "DOWN" | null;
  /** Human label for badges */
  label: string;
  /** Diagnostics: which boundary produced the phase */
  deadlinePassed: boolean;
  marketExpired: boolean;
}

export function deriveDuelView(input: DuelViewInput): DuelView {
  const {
    chainState,
    hasJoined,
    joinDeadline,
    marketExpiry,
    indexerFinalized,
    hasFinalAnswer,
    hasOpeningAnswer,
    nowSec,
  } = input;

  if (chainState === undefined) {
    return { phase: "loading", isTerminal: false, isEnded: false, label: "Loading", deadlinePassed: false, marketExpired: false };
  }

  // Terminal on-chain states never change again — chain is authoritative.
  if (chainState === DuelState.SETTLED) {
    return { phase: "settled", isTerminal: true, isEnded: true, label: "Settled", deadlinePassed: true, marketExpired: true };
  }
  if (chainState === DuelState.REFUNDED) {
    return { phase: "refunded", isTerminal: true, isEnded: true, label: "Refunded", deadlinePassed: true, marketExpired: true };
  }
  if (chainState === DuelState.CANCELLED) {
    return { phase: "cancelled", isTerminal: true, isEnded: true, label: "Cancelled", deadlinePassed: true, marketExpired: true };
  }

  const joinBoundary = joinDeadline ?? marketExpiry;
  const deadlinePassed = joinBoundary != null && nowSec >= joinBoundary;

  // When the indexer's expiry is unavailable, joinDeadline + 60s is a PROVABLE
  // upper bound on the market end: creation enforces joinDeadline <= expiry - 60
  // (frontend create flow caps the deadline 60s before market expiry), so once
  // joinDeadline + 60 has passed the market window is certainly over too.
  const marketExpired =
    marketExpiry != null
      ? nowSec >= marketExpiry
      : joinDeadline != null
        ? nowSec >= joinDeadline + 60
        : false;

  // CREATED: waiting, or expired-with-no-opponent (terminal — nobody can join
  // a passed deadline; funds reclaimable by the creator via cancel/refund).
  if (chainState === DuelState.CREATED) {
    if (!deadlinePassed) {
      return { phase: "waiting", isTerminal: false, isEnded: false, label: "Open", deadlinePassed, marketExpired };
    }
    return { phase: "open-expired", isTerminal: true, isEnded: true, label: "Expired", deadlinePassed: true, marketExpired };
  }

  // LOCKED: the contest window governs liveness — NOT the wager state.
  if (chainState === DuelState.LOCKED) {
    if (!marketExpired) {
      return { phase: "live", isTerminal: false, isEnded: false, label: "Live", deadlinePassed, marketExpired };
    }
    // Contest over. Determine whether the oracle outcome is final.
    const resolved = indexerFinalized && hasFinalAnswer && hasOpeningAnswer;
    if (resolved) {
      return {
        phase: "ended-resolved",
        isTerminal: false, // settle/reclaim txs can still transition the chain state
        isEnded: true,
        label: "Ended",
        deadlinePassed,
        marketExpired,
      };
    }
    return {
      phase: "ended-pending",
      isTerminal: false,
      isEnded: true,
      label: "Ended",
      deadlinePassed,
      marketExpired,
    };
  }

  // Unknown numeric state — treat conservatively as ended (never "live").
  return { phase: "ended-pending", isTerminal: true, isEnded: true, label: "Ended", deadlinePassed, marketExpired };
}

/** Deterministic terminal message for the duel page / cards. */
export function duelEndedMessage(view: DuelView, opts: { hasJoined: boolean; winnerSide?: "UP" | "DOWN" | null; viewerSide?: "UP" | "DOWN" | null }): string {
  switch (view.phase) {
    case "open-expired":
      return "This duel expired with no opponent — the contest did not happen.";
    case "ended-resolved":
      if (!opts.hasJoined) return "The contest has ended.";
      if (!opts.winnerSide) return "The contest has ended.";
      if (!opts.viewerSide) return `Contest ended — ${opts.winnerSide} won.`;
      return opts.viewerSide === opts.winnerSide
        ? `The contest has ended — you won (${opts.winnerSide}).`
        : `The contest has ended — ${opts.winnerSide} won.`;
    case "ended-pending":
      return "The contest window has closed — waiting for the DreamDEX oracle to finalize the result.";
    default:
      return "";
  }
}
