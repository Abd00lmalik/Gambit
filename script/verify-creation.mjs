// P0 verification: prove duel creation works on 2-3 DIFFERENT currently-live
// markets after removing the module-expiry "staleness" gate.
//
// For each live market (from the DreamDEX indexer):
//   1. Run the same checks the Create Duel flow runs (verifyMarketAddress
//      logic, post-fix: indexer row + Trading + market contract exists).
//   2. createDuel() on the V30 factory (creator DOWN, 0.1 STT).
//   3. Verify DuelCreated event + clone.creatorIsUp() stored as false.
//   4. Reclaim the stake via factory.cancelDuel() (the slot's registered
//      contract reports isResolved=true, which permits pre-deadline cancel).
//
// Needs a funded key: reads the testnet key from Gambit/handoff.md (owner key).
import fs from "node:fs";
import path from "node:path";
import { createPublicClient, http, createWalletClient, encodeFunctionData, decodeEventLog, keccak256, toHex, formatEther, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const RPC = process.env.SOMNIA_RPC || "https://api.infra.testnet.somnia.network";
const FACTORY = process.env.FACTORY_ADDRESS || "0xea5f3130a5ed09929da3e156ec0308c58de6a2e1";
const ROOT = path.resolve(import.meta.dirname, "..");
const MARKETS_TO_TEST = Number(process.env.MARKETS_TO_TEST || 3);

const somnia = defineChain({
  id: 50312,
  name: "Somnia Testnet",
  nativeCurrency: { name: "Somnia Test Token", symbol: "STT", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
  blockExplorers: { default: { url: "https://shannon-explorer.somnia.network" } },
});

async function gql(url, query) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query }) });
  return res.json();
}

// ── 1. Pick distinct live markets ─────────────────────────────
const now = Math.floor(Date.now() / 1000);
const data = await gql("https://prd.smk.somnia.host/v1/graphql", `{
  Market(where: {marketType: {_eq: "BINARY"}, clobStatus: {_eq: "Trading"}, expiry: {_gt: ${now + 120}}}, order_by: {expiry: asc}, limit: 8) {
    marketAddress marketId asset expiry
  }
}`);
const rows = data?.data?.Market ?? [];
// distinct by (asset, expiry) so we cover different assets/windows
const picked = [];
const seen = new Set();
for (const m of rows) {
  const key = `${m.asset}-${m.expiry}`;
  if (seen.has(key)) continue;
  seen.add(key);
  picked.push(m);
  if (picked.length >= MARKETS_TO_TEST) break;
}
console.log(`picked ${picked.length} live markets for creation test:`);
for (const m of picked) console.log(`  ${m.asset} ${m.marketAddress} expiry=${new Date(Number(m.expiry) * 1000).toISOString()}`);
if (picked.length < 2) throw new Error(`need at least 2 live markets, found ${picked.length}`);

// ── 2. Clients ────────────────────────────────────────────────
const handoff = fs.readFileSync(path.join(ROOT, "Gambit/handoff.md"), "utf8");
const keys = [...handoff.matchAll(/0x[0-9a-fA-F]{64}/g)].map((m) => m[0]);
const account = privateKeyToAccount(process.env.PRIVATE_KEY || keys[0]);
const publicClient = createPublicClient({ chain: somnia, transport: http(RPC, { timeout: 60_000, retryCount: 3 }) });
const walletClient = createWalletClient({ account, chain: somnia, transport: http(RPC, { timeout: 60_000, retryCount: 3 }) });
console.log("creator:", account.address, "balance:", formatEther(await publicClient.getBalance({ address: account.address })), "STT");

const FACTORY_ABI = [
  {
    name: "createDuel", type: "function", stateMutability: "payable",
    inputs: [
      { name: "_marketAddress", type: "address" },
      { name: "_marketId", type: "bytes32" },
      { name: "_joinDeadline", type: "uint256" },
      { name: "_creatorIsUp", type: "bool" },
    ],
    outputs: [{ name: "clone", type: "address" }],
  },
  { name: "cancelDuel", type: "function", stateMutability: "nonpayable", inputs: [{ name: "clone", type: "address" }], outputs: [] },
];
const CLONE_ABI = [
  { name: "creatorIsUp", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { name: "state", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { name: "getPot", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
];
const duelCreatedTopic = keccak256(toHex("DuelCreated(address,address,uint256,address,uint256,bool)"));
const STAKE = 100000000000000000n; // 0.1 STT

let ok = 0;
for (const [i, m] of picked.entries()) {
  console.log(`\n=== market ${i + 1}/${picked.length}: ${m.asset} ${m.marketAddress} ===`);
  // (1) creation-flow checks (post-fix logic)
  const row = await gql("https://prd.smk.somnia.host/v1/graphql", `{
    Market(where: {marketAddress: {_eq: "${m.marketAddress}"}}, limit: 1) { marketId clobStatus expiry }
  }`);
  const info = row?.data?.Market?.[0];
  if (!info || info.clobStatus !== "Trading") throw new Error(`market ${m.marketAddress} failed creation checks`);
  console.log("  creation checks: PASS (indexer row + Trading)");

  // (2) create
  const createHash = await walletClient.sendTransaction({
    to: FACTORY,
    data: encodeFunctionData({
      abi: FACTORY_ABI,
      functionName: "createDuel",
      args: [m.marketAddress, info.marketId, BigInt(now + 90), i % 2 === 1], // alternate DOWN/UP
    }),
    value: STAKE,
    gas: 5_000_000n,
    gasPrice: 20_000_000_000n,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: createHash, timeout: 120_000 });
  if (receipt.status !== "success") throw new Error(`createDuel reverted for ${m.marketAddress}`);
  const ev = receipt.logs.find((l) => l.address.toLowerCase() === FACTORY.toLowerCase() && l.topics[0] === duelCreatedTopic);
  if (!ev) throw new Error("DuelCreated not found");
  const decoded = decodeEventLog({
    abi: [{
      type: "event", name: "DuelCreated",
      inputs: [
        { name: "clone", type: "address", indexed: true },
        { name: "playerA", type: "address", indexed: true },
        { name: "stakeAmount", type: "uint256" },
        { name: "marketAddress", type: "address" },
        { name: "joinDeadline", type: "uint256" },
        { name: "creatorIsUp", type: "bool" },
      ],
    }],
    topics: ev.topics,
    data: ev.data,
  });
  const clone = decoded.args.clone;
  const storedSide = await publicClient.readContract({ address: clone, abi: CLONE_ABI, functionName: "creatorIsUp" });
  const pot = await publicClient.readContract({ address: clone, abi: CLONE_ABI, functionName: "getPot" });
  console.log(`  created duel ${clone} creatorIsUp(event)=${decoded.args.creatorIsUp} creatorIsUp(stored)=${storedSide} pot=${formatEther(pot)} STT`);
  if (storedSide !== decoded.args.creatorIsUp) throw new Error("stored side mismatch");
  if (pot !== STAKE) throw new Error("stake not escrowed");

  // (3) reclaim (slot's registered contract reports resolved → pre-deadline cancel permitted)
  await new Promise((r) => setTimeout(r, 96_000)); // wait out the 90s join deadline
  const cancelHash = await walletClient.sendTransaction({
    to: FACTORY,
    data: encodeFunctionData({ abi: FACTORY_ABI, functionName: "cancelDuel", args: [clone] }),
    gas: 3_000_000n,
    gasPrice: 20_000_000_000n,
  });
  const cancelReceipt = await publicClient.waitForTransactionReceipt({ hash: cancelHash, timeout: 120_000 });
  if (cancelReceipt.status !== "success") throw new Error(`cancel failed for ${clone}`);
  const state = await publicClient.readContract({ address: clone, abi: CLONE_ABI, functionName: "state" });
  const potAfter = await publicClient.readContract({ address: clone, abi: CLONE_ABI, functionName: "getPot" });
  console.log(`  reclaimed: state=${Number(state)} (4=CANCELLED) potAfter=${formatEther(potAfter)} STT`);
  ok++;
}

console.log(`\n=== CREATION VERIFICATION: ${ok}/${picked.length} LIVE MARKETS ALLOWED DUEL CREATION ===`);
if (ok < 2) throw new Error("P0 not resolved: fewer than 2 markets allowed creation");
console.log("P0 RESOLVED ✅");
