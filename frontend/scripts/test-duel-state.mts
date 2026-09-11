// Regression tests for the shared derived duel view state model
// (lib/duelViewState.ts) — the single interpretation of "what state is this
// duel in RIGHT NOW" used by both the Arena listing and the duel detail page.
// Run: npx tsx scripts/test-duel-state.mts
import assert from "node:assert/strict";
import { deriveDuelView, duelEndedMessage, type DuelViewInput } from "../lib/duelViewState";
import { DuelState } from "../lib/contracts";

let passed = 0;
function ok(label: string) {
  passed++;
  console.log(`  ✓ ${label}`);
}

function baseInput(overrides: Partial<DuelViewInput> = {}): DuelViewInput {
  return {
    chainState: DuelState.LOCKED,
    hasJoined: true,
    joinDeadline: 1000,
    marketExpiry: 2000,
    indexerFinalized: false,
    hasFinalAnswer: false,
    hasOpeningAnswer: false,
    nowSec: 1500,
    ...overrides,
  };
}

// ── 1. Waiting duel remains waiting ──
{
  const v = deriveDuelView(baseInput({ chainState: DuelState.CREATED, hasJoined: false, joinDeadline: 1800, nowSec: 1500 }));
  assert.equal(v.phase, "waiting");
  assert.equal(v.isEnded, false);
  assert.equal(v.label, "Open");
  ok("CREATED + join window open → waiting (label 'Open')");
}

// ── 2. Active duel remains active before the market deadline ──
{
  const v = deriveDuelView(baseInput({ nowSec: 1999 }));
  assert.equal(v.phase, "live");
  assert.equal(v.isEnded, false);
  assert.equal(v.label, "Live");
  ok("LOCKED + market window open → live (label 'Live')");
}

// ── 3. Deadline transition is detected exactly at the boundary ──
{
  const before = deriveDuelView(baseInput({ nowSec: 1999 }));
  const at = deriveDuelView(baseInput({ nowSec: 2000 }));
  const after = deriveDuelView(baseInput({ nowSec: 2001 }));
  assert.equal(before.phase, "live");
  assert.equal(at.phase, "ended-pending");
  assert.equal(after.phase, "ended-pending");
  ok("LOCKED: market expiry boundary flips live → ended");
}

// ── 4. Resolved market never stays visually LIVE ──
{
  const v = deriveDuelView(baseInput({
    nowSec: 3000,
    indexerFinalized: true,
    hasFinalAnswer: true,
    hasOpeningAnswer: true,
  }));
  assert.equal(v.phase, "ended-resolved");
  assert.equal(v.isEnded, true);
  assert.notEqual(v.phase, "live");
  ok("LOCKED + expiry passed + oracle finalized → ended-resolved (never LIVE)");
}

// ── 5. No-opponent expired duel is distinguishable from a live duel ──
{
  const expiredNoOpponent = deriveDuelView(baseInput({
    chainState: DuelState.CREATED,
    hasJoined: false,
    nowSec: 3000,
  }));
  const live = deriveDuelView(baseInput({ nowSec: 1999 }));
  assert.equal(expiredNoOpponent.phase, "open-expired");
  assert.equal(expiredNoOpponent.isTerminal, true);
  assert.equal(expiredNoOpponent.isEnded, true);
  assert.notEqual(expiredNoOpponent.phase, live.phase);
  ok("CREATED + deadline passed → open-expired (terminal, distinct from live)");
}

// ── 6. Refreshing the page produces the same authoritative state ──
{
  const input = baseInput({ nowSec: 3000, indexerFinalized: true, hasFinalAnswer: true, hasOpeningAnswer: true });
  const a = deriveDuelView(input);
  const b = deriveDuelView(input);
  assert.deepEqual(a, b);
  ok("Pure function: same inputs → same state (refresh-stable)");
}

// ── 7. Arena and duel-detail interpret identical inputs identically ──
// (both call deriveDuelView — this pins the shared-source contract)
{
  const arena = deriveDuelView(baseInput({ nowSec: 3000 }));
  const detail = deriveDuelView(baseInput({ nowSec: 3000 }));
  assert.equal(arena.phase, detail.phase);
  assert.equal(arena.label, detail.label);
  ok("Shared model: Arena and duel page derive the same phase from the same inputs");
}

// ── 8. Terminal chain states are final regardless of market/oracle input ──
{
  for (const [state, phase] of [
    [DuelState.SETTLED, "settled"],
    [DuelState.REFUNDED, "refunded"],
    [DuelState.CANCELLED, "cancelled"],
  ] as const) {
    const v = deriveDuelView(baseInput({ chainState: state, nowSec: 500, indexerFinalized: false }));
    assert.equal(v.phase, phase);
    assert.equal(v.isTerminal, true);
    assert.equal(v.isEnded, true);
  }
  ok("SETTLED/REFUNDED/CANCELLED are terminal regardless of clock");
}

// ── 9. Stale/cached inputs cannot keep a duel in LIVE ──
// Even if everything else is unknown (market/oracle fetch failed), a passed
// market expiry derived from the chain-visible join boundary still ends it.
{
  const v = deriveDuelView(baseInput({ marketExpiry: undefined, nowSec: 3000 }));
  assert.equal(v.isEnded, true);
  ok("Unknown oracle state + passed boundary → still ended (never stuck LIVE)");
}

// ── 10. Loading stays loading; unknown states never render as live ──
{
  const loading = deriveDuelView(baseInput({ chainState: undefined as any }));
  assert.equal(loading.phase, "loading");
  const unknown = deriveDuelView(baseInput({ chainState: 99 as any }));
  assert.equal(unknown.phase, "ended-pending");
  assert.equal(unknown.isEnded, true);
  ok("loading/unknown states never render as live");
}

// ── 11. Terminal messages distinguish the no-opponent case ──
{
  const expired = deriveDuelView(baseInput({ chainState: DuelState.CREATED, hasJoined: false, nowSec: 3000 }));
  const msg = duelEndedMessage(expired, { hasJoined: false });
  assert.match(msg, /expired with no opponent/);
  ok("open-expired message communicates the duel ended without an opponent");
}

// ── 12. Winner-aware resolved message for a joined viewer ──
{
  const resolved = deriveDuelView(baseInput({ nowSec: 3000, indexerFinalized: true, hasFinalAnswer: true, hasOpeningAnswer: true }));
  const won = duelEndedMessage(resolved, { hasJoined: true, winnerSide: "UP", viewerSide: "UP" });
  const lost = duelEndedMessage(resolved, { hasJoined: true, winnerSide: "UP", viewerSide: "DOWN" });
  const spectator = duelEndedMessage(resolved, { hasJoined: true, winnerSide: "UP", viewerSide: null });
  assert.match(won, /You won/);
  assert.match(lost, /UP won/);
  assert.match(spectator, /UP won/);
  assert.equal(duelEndedMessage(resolved, { hasJoined: true, winnerSide: null, viewerSide: "UP" }), "The contest has ended.");
  ok("ended-resolved messages reflect winner/viewer relationship");
}

// ── 13. ended-pending message names the pending condition ──
{
  const pending = deriveDuelView(baseInput({ nowSec: 3000 }));
  const msg = duelEndedMessage(pending, { hasJoined: true });
  assert.match(msg, /Waiting for the DreamDEX oracle/);
  ok("ended-pending message communicates oracle finalization is pending");
}

console.log(`\n${passed} duel-state regression checks passed`);
