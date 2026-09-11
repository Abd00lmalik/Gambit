import { NextResponse } from "next/server";
import {
  createPublicClient,
  http,
  keccak256,
  encodeAbiParameters,
  getAddress,
  isAddress,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { WAGER_ABI } from "@/lib/contracts";
import { fetchOracleResolutionData } from "@/lib/dreamdex";

// Oracle attestation endpoint for Wager.settleByOracle().
//
// WHY THIS EXISTS (proven on-chain 2026-09-10): DreamDEX recycles market slot
// ids across time windows while the BinaryMarketsModule holds a ONE-TIME
// registration from the slot's first window (every later window's market/pool
// contracts are self-destructed, 0 code). Wager.settle()'s "stale market
// record" guard therefore permanently blocks on-chain settlement for duels on
// recycled slots. settleByOracle() is the additive payout path for those
// duels: the winner's own claim click submits the tx (pays its gas — manual
// claim, no background process), with this endpoint's signature as the
// outcome attestation.
//
// WINNER DETERMINATION IS NOT CHANGED: the upWon value below is derived from
// the SAME DreamDEX oracle data the UI already uses (fetchOracleResolutionData
// → final vs opening cents — the rule DreamDEX's own settlement uses). The
// server independently re-verifies: duel LOCKED, opponent joined, window
// closed (block.timestamp > joinDeadline), indexer finalized, expiry passed,
// oracle answers present and not voided. No trust in client input beyond the
// duel address.
//
// The signature binds (clone, chainId, upWon, windowEnd) — it cannot be
// replayed against another duel or chain, nor flipped to the other side.

const RPC = process.env.SOMNIA_RPC || "https://api.infra.testnet.somnia.network";

export const dynamic = "force-dynamic";

function signerAccount() {
  const key = process.env.ORACLE_SIGNER_KEY;
  if (!key) return null;
  try {
    return privateKeyToAccount(key.startsWith("0x") ? (key as `0x${string}`) : (`0x${key}` as `0x${string}`));
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  // Late env check so a missing Vercel var never crashes cold boots of other flows
  const account = signerAccount();
  if (!account) {
    return NextResponse.json(
      { error: "Attestation service not configured (missing ORACLE_SIGNER_KEY)." },
      { status: 503 }
    );
  }

  let body: { address?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const raw = body?.address;
  if (!raw || !isAddress(raw)) {
    return NextResponse.json({ error: "Missing or invalid duel address." }, { status: 400 });
  }
  let duelAddress: `0x${string}`;
  try {
    duelAddress = getAddress(raw) as `0x${string}`;
  } catch {
    return NextResponse.json({ error: "Invalid duel address." }, { status: 400 });
  }

  const publicClient = createPublicClient({ transport: http(RPC, { timeout: 30_000, retryCount: 2 }) });

  // ── 1. On-chain duel state: LOCKED, opponent joined, window closed ──
  let state: number;
  let playerB: string;
  let joinDeadline: bigint;
  let marketAddress: string;
  try {
    [state, playerB, joinDeadline, marketAddress] = await Promise.all([
      publicClient.readContract({ address: duelAddress, abi: WAGER_ABI, functionName: "state" }),
      publicClient.readContract({ address: duelAddress, abi: WAGER_ABI, functionName: "playerB" }),
      publicClient.readContract({ address: duelAddress, abi: WAGER_ABI, functionName: "joinDeadline" }),
      publicClient.readContract({ address: duelAddress, abi: WAGER_ABI, functionName: "marketAddress" }),
    ]);
  } catch {
    return NextResponse.json({ error: "Could not read the duel from the chain." }, { status: 502 });
  }

  if (Number(state) !== 1) {
    return NextResponse.json({ error: "Duel is not in the live (locked) state." }, { status: 409 });
  }
  if (playerB === "0x0000000000000000000000000000000000000000") {
    return NextResponse.json({ error: "Duel has no opponent." }, { status: 409 });
  }

  const block = await publicClient.getBlock({ blockTag: "latest" });
  const nowSec = Number(block.timestamp);
  const chainId = await publicClient.getChainId();
  const windowEnd = Number(joinDeadline);

  if (nowSec <= windowEnd) {
    return NextResponse.json({ error: "The contest window is still open." }, { status: 409 });
  }

  // ── 2. Outcome from the SAME DreamDEX oracle data the UI's (unchanged)
  //       winner determination uses. Re-verified server-side. ──
  let oracle;
  try {
    oracle = await fetchOracleResolutionData(marketAddress as `0x${string}`);
  } catch {
    return NextResponse.json({ error: "Could not fetch DreamDEX resolution data." }, { status: 502 });
  }

  if (!oracle || !oracle.indexerFinalized) {
    return NextResponse.json({ error: "DreamDEX has not finalized this market yet." }, { status: 409 });
  }
  if (oracle.expiry != null && nowSec < oracle.expiry) {
    return NextResponse.json({ error: "Market window has not expired yet." }, { status: 409 });
  }
  if (oracle.oracleVoided) {
    return NextResponse.json({ error: "Market was voided — use the refund path." }, { status: 409 });
  }
  if (oracle.finalCents == null || oracle.openingCents == null) {
    return NextResponse.json({ error: "Oracle answers are not available yet." }, { status: 409 });
  }

  // Same rule DreamDEX's own settlement uses: closes at or above opening → UP
  const upWon = oracle.finalCents >= oracle.openingCents;

  // ── 3. Sign the attestation: (clone, chainId, upWon, windowEnd) ──
  const digest = keccak256(
    encodeAbiParameters(
      [{ type: "address" }, { type: "uint256" }, { type: "bool" }, { type: "uint256" }],
      [duelAddress, BigInt(chainId), upWon, BigInt(windowEnd)]
    )
  );
  const signature = await account.signMessage({ message: { raw: digest } });

  return NextResponse.json({
    upWon,
    windowEnd,
    signature,
    outcome: { openingCents: oracle.openingCents, finalCents: oracle.finalCents },
  });
}
