// Read-only verification: derive the view state of the reported duel using the
// SAME inputs the app will fetch in production (on-chain Wager reads + DreamDEX
// indexer terminal info) and the SHARED deriveDuelView model.
// Run: npx tsx scripts/verify-supplied-duel.mts
import { createPublicClient, http, formatEther } from "viem";
import { deriveDuelView } from "../lib/duelViewState";
import { DuelState, WAGER_ABI } from "../lib/contracts";
import { fetchMarketTerminalInfo } from "../lib/dreamdex";

const DUEL = "0x86a48dE556C4A09A7c7FE2E0Aa826F1F85812E96" as const;
const RPC = process.env.SOMNIA_RPC_URL || "https://dream-rpc.somnia.network";

const client = createPublicClient({ transport: http(RPC) });

const [stateRaw, playerBRaw, joinDeadlineRaw, stakeRaw, marketAddrRaw] = await Promise.all([
  client.readContract({ address: DUEL, abi: WAGER_ABI, functionName: "state" }),
  client.readContract({ address: DUEL, abi: WAGER_ABI, functionName: "playerB" }),
  client.readContract({ address: DUEL, abi: WAGER_ABI, functionName: "joinDeadline" }),
  client.readContract({ address: DUEL, abi: WAGER_ABI, functionName: "stakeAmount" }),
  client.readContract({ address: DUEL, abi: WAGER_ABI, functionName: "marketAddress" }),
]);

const state = Number(stateRaw) as DuelState;
const hasJoined = playerBRaw !== "0x0000000000000000000000000000000000000000";
const joinDeadline = Number(joinDeadlineRaw);
const terminal = (await fetchMarketTerminalInfo([DUEL === DUEL ? (marketAddrRaw as string) : ""])).get(
  (marketAddrRaw as string).toLowerCase()
);

const nowSec = Math.floor(Date.now() / 1000);
const view = deriveDuelView({
  chainState: state,
  hasJoined,
  joinDeadline,
  marketExpiry: terminal?.expiry ?? undefined,
  indexerFinalized: terminal?.indexerFinalized ?? false,
  hasFinalAnswer: terminal?.hasFinalAnswer ?? false,
  hasOpeningAnswer: terminal?.hasOpeningAnswer ?? false,
  nowSec,
});

console.log("=== Supplied duel verification (read-only, live data) ===");
console.log(`duel:        ${DUEL}`);
console.log(`chain state: ${state} (1=LOCKED, 2=SETTLED)`);
console.log(`hasJoined:   ${hasJoined}`);
console.log(`joinDeadline: ${joinDeadline} (${new Date(joinDeadline * 1000).toISOString()})`);
console.log(`market:      ${marketAddrRaw}`);
console.log(`terminal info: expiry=${terminal?.expiry} (${terminal?.expiry ? new Date(terminal.expiry * 1000).toISOString() : "n/a"}) finalized=${terminal?.indexerFinalized} finalAnswer=${terminal?.hasFinalAnswer} openingAnswer=${terminal?.hasOpeningAnswer}`);
console.log("");
console.log("=== Derived view state ===");
console.log(`phase:         ${view.phase}`);
console.log(`label:         ${view.label}`);
console.log(`isEnded:       ${view.isEnded}`);
console.log(`isTerminal:    ${view.isTerminal}`);
console.log(`marketExpired: ${view.marketExpired}`);

if (view.phase === "live" || !view.isEnded) {
  console.error("\nFAIL: duel still derives as LIVE — the fix does not cover this case");
  process.exit(1);
}
console.log("\nPASS: the supplied duel now derives as ENDED (not LIVE) with the same live data that previously rendered 'Live'");
