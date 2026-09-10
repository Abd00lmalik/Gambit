// V30 deployment (creatorIsUp side support + hardened settle) via viem.
// forge script hits -32602 on Somnia's RPC; viem's minimal calls work (proven
// by the investigation scripts). Reads the testnet key from Gambit/handoff.md
// (testnet key the repo owner committed there), never hardcodes it.
import fs from "node:fs";
import path from "node:path";
import { createPublicClient, http, createWalletClient, encodeDeployData, encodeFunctionData, decodeEventLog, keccak256, toHex, formatEther, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import solc from "solc";

const RPC = process.env.SOMNIA_RPC || "https://api.infra.testnet.somnia.network";
const ROOT = path.resolve(import.meta.dirname, "..");

const somnia = defineChain({
  id: 50312,
  name: "Somnia Testnet",
  nativeCurrency: { name: "Somnia Test Token", symbol: "STT", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
  blockExplorers: { default: { url: "https://shannon-explorer.somnia.network" } },
});

// ── Compile GambitFactory (+ inline Wager) with the same remappings ──
function compileFactory() {
  const sources = {};
  const queue = [];
  const addFile = (abs, key) => {
    if (sources[key]) return;
    sources[key] = { content: fs.readFileSync(abs, "utf8") };
    queue.push([key, abs]);
  };
  addFile(path.join(ROOT, "contracts/GambitFactory.sol"), "contracts/GambitFactory.sol");
  while (queue.length) {
    const [file, abs] = queue.shift();
    const re = /import\s+(?:[^;'"]*?"([^"]+)"|'([^']+)')\s*;/g;
    let m;
    while ((m = re.exec(sources[file].content))) {
      const spec = m[1] || m[2];
      let resolved;
      let importKey;
      if (spec.startsWith("@openzeppelin/")) {
        resolved = path.join(ROOT, "node_modules", spec);
        importKey = spec;
      } else if (spec.startsWith(".")) {
        resolved = path.resolve(path.dirname(abs), spec);
        importKey = path.posix.normalize(path.posix.join(path.posix.dirname(file), spec));
      } else throw new Error("unexpected import " + spec);
      if (!sources[importKey]) {
        if (!fs.existsSync(resolved)) throw new Error(`missing ${spec} -> ${resolved}`);
        addFile(resolved, importKey);
      }
    }
  }
  const input = {
    language: "Solidity",
    sources: Object.fromEntries(Object.entries(sources).map(([k, v]) => [k, { content: v.content }])),
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "paris",
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  };
  const out = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (out.errors || []).filter((e) => e.severity === "error");
  if (errors.length) throw new Error(errors.map((e) => e.formattedMessage).join("\n"));
  return out.contracts["contracts/GambitFactory.sol"]["GambitFactory"];
}

const { abi, evm } = compileFactory();
const bytecode = "0x" + evm.bytecode.object;
console.log(`compiled GambitFactory: ${bytecode.length / 2 - 1} bytes of creation code`);

// ── Keys / clients ────────────────────────────────────────────
const handoff = fs.readFileSync(path.join(ROOT, "Gambit/handoff.md"), "utf8");
const keys = [...handoff.matchAll(/0x[0-9a-fA-F]{64}/g)].map((m) => m[0]);
// Key 1 = Player A / Owner (funded: ~45 STT). Key 2 = Player B (near-empty).
const PK = process.env.PRIVATE_KEY || keys[0];
const account = privateKeyToAccount(PK);
console.log("deployer:", account.address);

const publicClient = createPublicClient({ chain: somnia, transport: http(RPC, { timeout: 60_000, retryCount: 3 }) });
const walletClient = createWalletClient({ account, chain: somnia, transport: http(RPC, { timeout: 60_000, retryCount: 3 }) });

const FEE_RECIPIENT = "0x25265b9dBEb6c653b0CA281110Bb0697a9685107";
const constructorArgs = [FEE_RECIPIENT, 250n, 100000000000000000n, 100000000000000000000n, "0x0000000000000000000000000000000000000000"];

const balance = await publicClient.getBalance({ address: account.address });
console.log("deployer balance:", formatEther(balance), "STT");

const data = encodeDeployData({ abi, bytecode, args: constructorArgs });
const gas = 10_000_000n; // constructor deploys the Wager implementation inline
const txHash = await walletClient.sendTransaction({
  data,
  gas,
  gasPrice: 20_000_000_000n, // 20 gwei legacy — Somnia base is ~5.3 gwei
});
console.log("deploy tx:", txHash);

const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 120_000 });
console.log("status:", receipt.status, "block:", receipt.blockNumber, "gasUsed:", receipt.gasUsed);
if (receipt.status !== "success") throw new Error("deploy reverted on-chain");
const factoryAddress = receipt.contractAddress;
console.log("FACTORY_ADDRESS=" + factoryAddress);

// ── On-chain verification ─────────────────────────────────────
const factoryReads = await publicClient.multicall({
  contracts: [
    { address: factoryAddress, abi, functionName: "implementation" },
    { address: factoryAddress, abi, functionName: "feeRecipient" },
    { address: factoryAddress, abi, functionName: "defaultFeeBps" },
    { address: factoryAddress, abi, functionName: "minStake" },
    { address: factoryAddress, abi, functionName: "maxStake" },
  ],
});
const [implementation, feeRecipient, feeBps, minStake, maxStake] = factoryReads.map((r) => r.result);
console.log({
  implementation,
  feeRecipient,
  defaultFeeBps: String(feeBps),
  minStake: String(minStake),
  maxStake: String(maxStake),
});
if (!implementation || implementation === "0x0000000000000000000000000000000000000000") throw new Error("no implementation");

// creatorIsUp selector must exist on the new implementation (returns false pre-init)
const wagerAbi = [{ name: "creatorIsUp", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] }];
const creatorIsUpDefault = await publicClient.readContract({ address: implementation, abi: wagerAbi, functionName: "creatorIsUp" });
console.log("implementation.creatorIsUp() (pre-init):", creatorIsUpDefault);

// ── E2E smoke: create a DOWN-side duel on a real market, verify, cancel ──
// This proves on-chain that createDuel() stores creatorIsUp=false (the entire
// point of Priority 2) — then reclaims the stake via factory.cancelDuel.
const now = Math.floor(Date.now() / 1000);
const mkt = await fetch("https://prd.smk.somnia.host/v1/graphql", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ query: `{ Market(where: {marketType: {_eq: "BINARY"}, clobStatus: {_eq: "Trading"}, expiry: {_gt: ${now}}}, order_by: {expiry: asc}, limit: 1) { marketAddress marketId } }` }),
}).then((r) => r.json());
const market = mkt?.data?.Market?.[0];
if (!market) throw new Error("no live market for smoke test");
console.log("smoke market:", market.marketAddress, market.marketId);

const STAKE = 100000000000000000n; // 0.1 STT
const createData = encodeFunctionData({
  abi: [
    {
      name: "createDuel",
      type: "function",
      stateMutability: "payable",
      inputs: [
        { name: "_marketAddress", type: "address" },
        { name: "_marketId", type: "bytes32" },
        { name: "_joinDeadline", type: "uint256" },
        { name: "_creatorIsUp", type: "bool" },
      ],
      outputs: [{ name: "clone", type: "address" }],
    },
  ],
  functionName: "createDuel",
  args: [market.marketAddress, market.marketId, BigInt(now + 90), false], // creator DOWN
});
const createHash = await walletClient.sendTransaction({
  to: factoryAddress,
  data: createData,
  value: STAKE,
  gas: 5_000_000n,
  gasPrice: 20_000_000_000n,
});
console.log("createDuel(DOWN) tx:", createHash);
const createReceipt = await publicClient.waitForTransactionReceipt({ hash: createHash, timeout: 120_000 });
console.log("create status:", createReceipt.status, "gasUsed:", createReceipt.gasUsed);
if (createReceipt.status !== "success") throw new Error("createDuel reverted on-chain");

// DuelCreated(clone, playerA, ..., creatorIsUp) — decode clone + side from logs
const duelCreatedTopic = keccak256(toHex("DuelCreated(address,address,uint256,address,uint256,bool)"));
const ev = createReceipt.logs.find((l) => l.address.toLowerCase() === factoryAddress.toLowerCase() && l.topics[0] === duelCreatedTopic);
if (!ev) throw new Error("DuelCreated event not found");
const clone = "0x" + ev.topics[1].slice(26);
const decoded = decodeEventLog({
  abi: [{
    type: "event",
    name: "DuelCreated",
    inputs: [
      { name: "clone", type: "address", indexed: true },
      { name: "playerA", type: "address", indexed: true },
      { name: "stakeAmount", type: "uint256", indexed: false },
      { name: "marketAddress", type: "address", indexed: false },
      { name: "joinDeadline", type: "uint256", indexed: false },
      { name: "creatorIsUp", type: "bool", indexed: false },
    ],
  }],
  topics: ev.topics,
  data: ev.data,
});
console.log("smoke duel clone:", clone, "creatorIsUp:", decoded.args.creatorIsUp);
if (decoded.args.creatorIsUp !== false) throw new Error("creatorIsUp should be false (DOWN creator)");

// Read the side back from the clone
const cloneAbi = [
  { name: "creatorIsUp", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { name: "state", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
];
const storedSide = await publicClient.readContract({ address: clone, abi: cloneAbi, functionName: "creatorIsUp" });
console.log("clone.creatorIsUp() (stored on-chain):", storedSide);
if (storedSide !== false) throw new Error("stored creatorIsUp should be false");

// Wait for the join deadline, then reclaim via factory.cancelDuel
console.log("waiting 95s for the smoke duel's join deadline...");
await new Promise((r) => setTimeout(r, 95_000));
const cancelHash = await walletClient.sendTransaction({
  to: factoryAddress,
  data: encodeFunctionData({
    abi: [{ name: "cancelDuel", type: "function", stateMutability: "nonpayable", inputs: [{ name: "clone", type: "address" }], outputs: [] }],
    functionName: "cancelDuel",
    args: [clone],
  }),
  gas: 3_000_000n,
  gasPrice: 20_000_000_000n,
});
const cancelReceipt = await publicClient.waitForTransactionReceipt({ hash: cancelHash, timeout: 120_000 });
console.log("cancel status:", cancelReceipt.status);
if (cancelReceipt.status !== "success") throw new Error("cancelDuel reverted");
const state = await publicClient.readContract({ address: clone, abi: cloneAbi, functionName: "state" });
const bal = await publicClient.getBalance({ address: account.address });
console.log("smoke duel state after cancel (4 = CANCELLED):", Number(state), "| deployer balance:", formatEther(bal), "STT");

console.log("\n=== V30 DEPLOYMENT VERIFIED ===");
console.log("FACTORY_ADDRESS=" + factoryAddress);
console.log("IMPLEMENTATION_ADDRESS=" + implementation);
console.log("creatorIsUp smoke test: PASSED (creator DOWN stored, verified, stake reclaimed)");
