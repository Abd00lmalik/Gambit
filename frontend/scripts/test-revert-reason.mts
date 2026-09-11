// Regression tests for revert-reason decoding (cashout tx failure surfacing).
// The fixture is the EXACT revert data returned by eth_call for the real
// failed cashout tx 0x8c5ac5ba034c34658e22ba2e6d1c14b04db0874faf14de17c3932d87c1d9b954
// (duel 0x998ea0c7…, revert reason "stale market record").
//
// Run: npx tsx scripts/test-revert-reason.mts
import assert from "node:assert/strict";
import { decodeRevertReason, revertReasonFromError } from "../lib/revertReason";

let passed = 0;
function ok(label: string) {
  passed++;
  console.log(`  ✓ ${label}`);
}

// 1. Real revert data from the failed production tx
const REAL_REVERT_DATA =
  "0x08c379a0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000137374616c65206d61726b6574207265636f726400000000000000000000000000";
assert.equal(decodeRevertReason(REAL_REVERT_DATA), "stale market record");
ok("decodes the real failed-cashout revert data to 'stale market record'");

// 2. Generic Error(string) decoding ("wrong state", 11 bytes, len=0x0b)
const generic =
  "0x08c379a00000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000b77726f6e67207374617465000000000000000000000000000000000000000000";
assert.equal(decodeRevertReason(generic), "wrong state");
ok("decodes a generic Error(string) payload");

// 3. Non-revert data → null
assert.equal(decodeRevertReason("0x"), null);
assert.equal(decodeRevertReason(undefined), null);
assert.equal(decodeRevertReason(42), null);
assert.equal(decodeRevertReason("0x1234"), null);
ok("returns null for empty/undefined/non-string/non-Error data");

// 4. Absurd length is rejected (no OOB / DoS)
const badLen =
  "0x08c379a0" + "0".repeat(64) + "f".repeat(64);
assert.equal(decodeRevertReason(badLen), null);
ok("rejects payload with absurd string length");

// 5. viem-style error shapes
const viemErr = {
  data: REAL_REVERT_DATA,
  message: "Call reverted",
};
assert.equal(revertReasonFromError(viemErr), "stale market record");
ok("extracts reason from viem .data error shape");

const nestedErr = {
  cause: { data: REAL_REVERT_DATA },
};
assert.equal(revertReasonFromError(nestedErr), "stale market record");
ok("extracts reason from nested .cause.data error shape");

const rpcErr = new Error("execution reverted: stale market record");
assert.equal(revertReasonFromError(rpcErr), "stale market record");
ok("extracts reason from raw RPC 'reverted:' message");

assert.equal(revertReasonFromError(new Error("network down")), null);
assert.equal(revertReasonFromError(null), null);
ok("returns null for unrelated errors");

console.log(`\n${passed} revert-reason checks passed`);
