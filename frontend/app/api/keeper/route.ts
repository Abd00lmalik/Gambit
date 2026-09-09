import { NextRequest, NextResponse } from "next/server";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbiItem,
  formatEther,
  defineChain,
  type Address,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createClient } from "@supabase/supabase-js";

// ── Config ───────────────────────────────────────────────
const RPC_URL =
  process.env.SOMNIA_RPC_URL || "https://api.infra.testnet.somnia.network";
const PRIVATE_KEY = process.env.KEEPER_PRIVATE_KEY;
const BINARY_MARKETS_MODULE =
  "0x3ecC694Cef705358864a646142ac17A90E29e388" as Address;
const CHUNK = 500;
const MAX_DUELS_PER_RUN = 30;
const RPC_TIMEOUT_MS = 8_000;
const COLD_START_SCAN_BLOCKS = 5_000; // Reduced from 100k — use DB for persistence

// Supabase client for persistent state
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// All known factories (for event scanning)
const KNOWN_FACTORIES: { address: Address; deployBlock: bigint }[] = [
  { address: "0x089079B21dD6A495D4c3f6844ABCab806fcf5d9E" as Address, deployBlock: BigInt(483891102) }, // v29 — no reactivity, split handling, pre-deadline factoryCancel
  { address: "0x0CD18020ffc6E35f985d1aFfD24EE3141323eb56" as Address, deployBlock: BigInt(483866131) }, // v28 — split handling + pre-deadline factoryCancel
  { address: "0x2A4272E249BBAdd03d210ccF3A0B770CD7454089" as Address, deployBlock: BigInt(483841483) }, // v27 — split-market handling in settle()
  { address: "0x0939493F3ba9B96c381110c29fCe85788B8da28a" as Address, deployBlock: BigInt(483764000) }, // v26 — permissionless cancelDuel()
  { address: "0x256E05956B0C93735163a96d366865315f6e0A14" as Address, deployBlock: BigInt(483607331) }, // v25 — extcodesize fallback for dead resolvedMarketContract
  { address: "0xEf261Ee4501A50F989F1b0C3aC58DF0E27d15444" as Address, deployBlock: BigInt(483089000) }, // v24 — pre-deployed Wager impl
  { address: "0xe892cB0d1E16Edc797260c75b42d4e59459d2F4A" as Address, deployBlock: BigInt(483050000) }, // v23
  { address: "0x404b40FA269517D4F37d64AD28A29018e4d84F66" as Address, deployBlock: BigInt(0) }, // v20
  { address: "0xA6804a34f3808e9e1e079ea280f6bb9700bbA71f" as Address, deployBlock: BigInt(0) }, // v19
  { address: "0x087b04Cdf0598b9a53aCAd72522374e059Bc88DF" as Address, deployBlock: BigInt(482642000) },
  { address: "0x4CbE0b9A94E723811e49201733Fb23d73b7c39de" as Address, deployBlock: BigInt(482279598) },
  { address: "0x29AC4B1Ce9F2cCC979B2261681A6F640Dcfb6542" as Address, deployBlock: BigInt(482271937) },
  { address: "0x7B1A880EDC070FDF6a484DAEbF72e3143e68A9Ea" as Address, deployBlock: BigInt(482119325) },
];

// ── Chain ────────────────────────────────────────────────
const somniaChain = defineChain({
  id: 50312,
  name: "Somnia Testnet",
  nativeCurrency: { name: "STT", symbol: "STT", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
});

// ── ABIs ─────────────────────────────────────────────────
const WAGER_ABI = [
  "function state() view returns (uint8)",
  "function joinDeadline() view returns (uint256)",
  "function owner() view returns (address)",
  "function playerA() view returns (address)",
  "function playerB() view returns (address)",
  "function marketId() view returns (bytes32)",
  "function resolvedMarketContract() view returns (address)",
  "function stakeAmount() view returns (uint256)",

  "function deposits(address) view returns (uint256)",
  "function settle()",
  "function refund()",
  "function cancel()",
  "function factoryCancel()",
] as const;

const MARKET_ABI = [
  "function isResolved() view returns (bool)",
  "function isVoided() view returns (bool)",
] as const;

const FACTORY_ABI = [
  "function cancelDuel(address clone)",
] as const;

const BINARY_MARKETS_MODULE_ABI = [
  "function markets(bytes32) view returns (tuple(uint256 oracleQuestionId, uint8 outcomeSlotCount, uint8 voidPolicy, address collateral, uint32 originOperatorId, bytes32 originVenueId, address oracleAdapter, address creator, address market, address pool, uint256 yesId, uint256 noId, uint64 tradingStart, uint64 expiry))",
] as const;

const DUEL_CREATED_EVENT =
  parseAbiItem(
    "event DuelCreated(address indexed clone, address indexed playerA, uint256 stakeAmount, address marketAddress, uint256 joinDeadline)"
  );

// ── State constants ──────────────────────────────────────
const CREATED = 0;
const LOCKED = 1;
const SETTLED = 2;
const REFUNDED = 3;
const CANCELLED = 4;
const FINAL = new Set([SETTLED, REFUNDED, CANCELLED]);
const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

// ── Logging ──────────────────────────────────────────────
function log(msg: string) {
  const ts = new Date().toISOString().slice(11, 23);
  console.log(`[keeper ${ts}] ${msg}`);
}

// ── Timeout helper ───────────────────────────────────────
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms)
    ),
  ]);
}

// ── Persistent state via Supabase ────────────────────────
async function getPersistedBlock(factoryAddr: string): Promise<bigint> {
  if (!supabase) return BigInt(0);
  try {
    const { data } = await supabase
      .from("indexer_state")
      .select("value")
      .eq("key", `keeper_factory_${factoryAddr.toLowerCase()}`)
      .limit(1)
      .single();
    return data ? BigInt(data.value) : BigInt(0);
  } catch {
    return BigInt(0);
  }
}

async function setPersistedBlock(factoryAddr: string, block: bigint): Promise<void> {
  if (!supabase) return;
  try {
    await supabase
      .from("indexer_state")
      .upsert(
        {
          key: `keeper_factory_${factoryAddr.toLowerCase()}`,
          value: String(block),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" }
      );
  } catch (e) {
    console.warn("setPersistedBlock failed:", e);
  }
}

// ── DB: Get active duels that need processing ────────────
async function getActiveDuelsFromDb(): Promise<{ contract_address: string; factory_address: string }[]> {
  if (!supabase) return [];
  try {
    const { data } = await supabase
      .from("duels")
      .select("contract_address, factory_address")
      .in("state", [CREATED, LOCKED])
      .limit(MAX_DUELS_PER_RUN * 2); // Get more than we need, filtering happens later
    return (data as { contract_address: string; factory_address: string }[]) || [];
  } catch {
    return [];
  }
}

// ── Helpers ──────────────────────────────────────────────
async function getDuelInfo(
  clone: Address,
  publicClient: PublicClient
): Promise<{
  state: number;
  joinDeadline: bigint;
  playerA: Address;
  playerB: Address;
  marketId: `0x${string}`;
  resolvedMarketContract: Address;
  stakeAmount: bigint;
}> {
  const [state, joinDl, mA, mB, mktId, resolved, stake] =
    await Promise.all([
      publicClient.readContract({ address: clone, abi: WAGER_ABI, functionName: "state" }),
      publicClient.readContract({ address: clone, abi: WAGER_ABI, functionName: "joinDeadline" }),
      publicClient.readContract({ address: clone, abi: WAGER_ABI, functionName: "playerA" }),
      publicClient.readContract({ address: clone, abi: WAGER_ABI, functionName: "playerB" }),
      publicClient.readContract({ address: clone, abi: WAGER_ABI, functionName: "marketId" }),
      publicClient.readContract({ address: clone, abi: WAGER_ABI, functionName: "resolvedMarketContract" }),
      publicClient.readContract({ address: clone, abi: WAGER_ABI, functionName: "stakeAmount" }),
    ]);
  return {
    state: Number(state as bigint),
    joinDeadline: joinDl as bigint,
    playerA: mA as Address,
    playerB: mB as Address,
    marketId: mktId as `0x${string}`,
    resolvedMarketContract: resolved as Address,
    stakeAmount: stake as bigint,
  };
}

async function getMarketStatus(
  addr: Address | undefined,
  publicClient: PublicClient
) {
  if (!addr || addr === ZERO_ADDR)
    return { exists: false, resolved: false, voided: false };
  const code = await publicClient.getCode({ address: addr });
  if (!code || code === "0x")
    return { exists: false, resolved: false, voided: false };
  const [resolved, voided] = await Promise.all([
    publicClient.readContract({ address: addr, abi: MARKET_ABI, functionName: "isResolved" }).catch((e: any) => { log(`  isResolved error on ${addr}: ${e.shortMessage || e.message?.slice(0, 100)}`); return false; }),
    publicClient.readContract({ address: addr, abi: MARKET_ABI, functionName: "isVoided" }).catch((e: any) => { log(`  isVoided error on ${addr}: ${e.shortMessage || e.message?.slice(0, 100)}`); return false; }),
  ]);
  return { exists: true, resolved: resolved as boolean, voided: voided as boolean };
}

async function resolveMarket(
  marketId: `0x${string}`,
  publicClient: PublicClient
): Promise<Address | null> {
  const code = await publicClient.getCode({ address: BINARY_MARKETS_MODULE });
  if (!code || code === "0x") return null;
  try {
    const r = await publicClient.readContract({
      address: BINARY_MARKETS_MODULE,
      abi: BINARY_MARKETS_MODULE_ABI,
      functionName: "markets",
      args: [marketId],
    });
    return ((r as any).market ?? (r as any)[8]) as Address;
  } catch (e: any) {
    log(`  resolveMarket error: ${e.shortMessage || e.message?.slice(0, 80)}`);
    return null;
  }
}

async function resolvePoolAddress(
  marketId: `0x${string}`,
  publicClient: PublicClient
): Promise<Address | null> {
  const code = await publicClient.getCode({ address: BINARY_MARKETS_MODULE });
  if (!code || code === "0x") return null;
  try {
    const r = await publicClient.readContract({
      address: BINARY_MARKETS_MODULE,
      abi: BINARY_MARKETS_MODULE_ABI,
      functionName: "markets",
      args: [marketId],
    });
    return ((r as any).pool ?? (r as any)[9]) as Address;
  } catch (e: any) {
    log(`  resolvePool error: ${e.shortMessage || e.message?.slice(0, 80)}`);
    return null;
  }
}

async function hasCode(
  addr: Address,
  publicClient: PublicClient
): Promise<boolean> {
  const code = await publicClient.getCode({ address: addr });
  return !!code && code !== "0x";
}

// ── Transaction helpers ──────────────────────────────────
async function sendTx(
  walletClient: WalletClient,
  publicClient: PublicClient,
  clone: Address,
  functionName: "settle" | "refund" | "cancel"
) {
  const nonce = await publicClient.getTransactionCount({
    address: walletClient.account!.address,
    blockTag: "pending",
  });
  const { request } = await publicClient.simulateContract({
    address: clone,
    abi: WAGER_ABI,
    functionName,
    account: walletClient.account!,
    nonce,
    gas: BigInt(50_000_000),
  });
  const hash = await walletClient.writeContract(request);
  return publicClient.waitForTransactionReceipt({ hash });
}

async function sendFactoryTx(
  walletClient: WalletClient,
  publicClient: PublicClient,
  functionName: "cancelDuel",
  factoryAddr: Address,
  clone: Address
) {
  const nonce = await publicClient.getTransactionCount({
    address: walletClient.account!.address,
    blockTag: "pending",
  });
  const { request } = await publicClient.simulateContract({
    address: factoryAddr,
    abi: FACTORY_ABI,
    functionName,
    args: [clone],
    account: walletClient.account!,
    nonce,
    gas: BigInt(50_000_000),
  });
  const hash = await walletClient.writeContract(request);
  return publicClient.waitForTransactionReceipt({ hash });
}

// ── Core logic ───────────────────────────────────────────
async function processDuel(
  clone: Address,
  factoryAddr: Address,
  publicClient: PublicClient,
  walletClient: WalletClient
): Promise<string | null> {
  let info;
  try {
    info = await withTimeout(getDuelInfo(clone, publicClient), RPC_TIMEOUT_MS, `getDuelInfo ${clone.slice(0, 10)}`);
  } catch {
    return null;
  }

  log(`  [${clone.slice(0, 10)}] state=${info.state} deadline=${info.joinDeadline} market=${info.resolvedMarketContract.slice(0, 10)}...`);

  if (FINAL.has(info.state)) return null;

  // ── Market resolution (3-tier with fallback) ───────────
  let market;
  let resolutionSource = "unknown";
  try {
    let resolvedAddr: Address | null = null;

    if (info.resolvedMarketContract !== ZERO_ADDR) {
      if (await hasCode(info.resolvedMarketContract, publicClient)) {
        resolvedAddr = info.resolvedMarketContract;
        resolutionSource = "stored";
      } else {
        log(`  dead resolvedMarketContract ${info.resolvedMarketContract} — re-resolving`);
        resolvedAddr = await withTimeout(resolveMarket(info.marketId, publicClient), RPC_TIMEOUT_MS, `resolveMarket`);
        if (resolvedAddr && await hasCode(resolvedAddr, publicClient)) {
          resolutionSource = "re-resolved market";
        } else {
          resolvedAddr = await withTimeout(resolvePoolAddress(info.marketId, publicClient), RPC_TIMEOUT_MS, `resolvePoolAddress`);
          if (resolvedAddr && await hasCode(resolvedAddr, publicClient)) {
            resolutionSource = "pool";
          }
        }
      }
    } else {
      resolvedAddr = await withTimeout(resolveMarket(info.marketId, publicClient), RPC_TIMEOUT_MS, `resolveMarket`);
      if (resolvedAddr && await hasCode(resolvedAddr, publicClient)) {
        resolutionSource = "fresh market";
      } else {
        resolvedAddr = await withTimeout(resolvePoolAddress(info.marketId, publicClient), RPC_TIMEOUT_MS, `resolvePoolAddress`);
        if (resolvedAddr && await hasCode(resolvedAddr, publicClient)) {
          resolutionSource = "fresh pool";
        }
      }
    }

    log(`  resolvedAddr=${resolvedAddr?.slice(0, 10) ?? "null"} source=${resolutionSource}`);
    market = await withTimeout(getMarketStatus(resolvedAddr ?? undefined, publicClient), RPC_TIMEOUT_MS, `getMarketStatus`);
    log(`  market status: exists=${market.exists} resolved=${market.resolved} voided=${market.voided}`);
  } catch (e: any) {
    log(`  market resolution error: ${e.message?.slice(0, 80)}`);
    market = { exists: false, resolved: false, voided: false };
  }

  const now = BigInt(Math.floor(Date.now() / 1000));
  const deadlinePassed = now > info.joinDeadline;

  // CREATED: unjoined — factory-cancel if resolved or expired
  if (info.state === CREATED && (market.resolved || deadlinePassed)) {
    log(
      `FACTORY-CANCEL ${clone} — stake: ${formatEther(info.stakeAmount)} STT, reason: ${market.resolved ? "market resolved" : "deadline passed"}`
    );
    try {
      const r = await sendFactoryTx(walletClient, publicClient, "cancelDuel", factoryAddr, clone);
      log(`  OK tx: ${r.transactionHash} gas: ${r.gasUsed}`);
      return r.transactionHash;
    } catch (e: any) {
      log(`  FAIL ${e.shortMessage || e.message?.slice(0, 100)}`);
      return null;
    }
  }

  // LOCKED: both joined — settle or refund
  if (info.state === LOCKED) {
    if (market.voided) {
      log(`REFUND ${clone} — market voided`);
      try {
        const r = await sendTx(walletClient, publicClient, clone, "refund");
        log(`  OK tx: ${r.transactionHash} gas: ${r.gasUsed}`);
        return r.transactionHash;
      } catch (e: any) {
        log(`  FAIL ${e.shortMessage || e.message?.slice(0, 100)}`);
        return null;
      }
    }

    if (market.resolved) {
      log(
        `SETTLE ${clone} — pot: ${formatEther(info.stakeAmount * BigInt(2))} STT (via ${resolutionSource})`
      );
      try {
        const r = await sendTx(walletClient, publicClient, clone, "settle");
        log(`  OK tx: ${r.transactionHash} gas: ${r.gasUsed}`);
        return r.transactionHash;
      } catch (e: any) {
        log(`  FAIL ${e.shortMessage || e.message?.slice(0, 100)}`);
        return null;
      }
    }

    // CRITICAL FALLBACK: If we can't confirm resolution but deadline passed,
    // try settle() anyway. The on-chain Wager contract has its own
    // _resolveMarketContract() fallback that can find the correct market address
    // even when our off-chain lookup fails. If the market truly isn't resolved,
    // the tx will revert harmlessly.
    if (deadlinePassed) {
      log(
        `SETTLE-ATTEMPT ${clone} — market resolved=${market.resolved} exists=${market.exists}, trying on-chain settle (deadline passed)`
      );
      try {
        const r = await sendTx(walletClient, publicClient, clone, "settle");
        log(`  OK tx: ${r.transactionHash} gas: ${r.gasUsed}`);
        return r.transactionHash;
      } catch (e: any) {
        // Expected if market genuinely isn't resolved yet
        log(`  FAIL (market may not be resolved yet) ${e.shortMessage || e.message?.slice(0, 80)}`);
        return null;
      }
    }
  }

  log(`  no action taken for state=${info.state}`);
  return null;
}

// Time budget: must finish under 25s (cron-job.org max timeout = 30s, minus cold-start overhead)
const TIME_BUDGET_MS = 22_000;

async function scanAndProcess(
  publicClient: PublicClient,
  walletClient: WalletClient
) {
  const latest = await withTimeout(publicClient.getBlockNumber(), RPC_TIMEOUT_MS, "getBlockNumber");
  const clones: { clone: Address; factory: Address }[] = [];
  const scanStart = Date.now();

  // ── Phase 1: Load persisted state + active DB duels ────
  const knownDuels = new Map<string, { clone: Address; factory: Address }>();

  // Load active duels from DB (survives cold starts)
  const dbDuels = await getActiveDuelsFromDb();
  for (const d of dbDuels) {
    const addr = d.contract_address.toLowerCase() as string;
    knownDuels.set(addr, {
      clone: d.contract_address as Address,
      factory: d.factory_address as Address,
    });
  }
  if (dbDuels.length > 0) {
    log(`Loaded ${dbDuels.length} active duel(s) from DB`);
  }

  // ── Phase 2: Scan events from factories ────────────────
  for (const factory of KNOWN_FACTORIES) {
    if (Date.now() - scanStart > TIME_BUDGET_MS) {
      log(`TIME BUDGET reached — stopping scan at factory ${factory.address.slice(0, 10)}...`);
      break;
    }

    // Load persisted scan position for this factory
    const persistedBlock = await getPersistedBlock(factory.address);
    const startBlock = persistedBlock > BigInt(0)
      ? persistedBlock + BigInt(1)
      : latest > BigInt(COLD_START_SCAN_BLOCKS)
        ? latest - BigInt(COLD_START_SCAN_BLOCKS)
        : factory.deployBlock;
    const effectiveStart = startBlock < factory.deployBlock ? factory.deployBlock : startBlock;

    // Skip if already up to date
    if (effectiveStart > latest) {
      log(`  ${factory.address.slice(0, 10)}... already up to date (block ${persistedBlock})`);
      continue;
    }

    let lastScannedInFactory = effectiveStart;
    for (
      let start = Number(effectiveStart);
      start <= Number(latest);
      start += CHUNK
    ) {
      if (Date.now() - scanStart > TIME_BUDGET_MS) break;
      const end = Math.min(start + CHUNK - 1, Number(latest));
      try {
        const logs = await withTimeout(
          publicClient.getLogs({
            address: factory.address,
            event: DUEL_CREATED_EVENT,
            fromBlock: BigInt(start),
            toBlock: BigInt(end),
          }),
          RPC_TIMEOUT_MS,
          `getLogs ${factory.address.slice(0, 10)}`
        );
        for (const l of logs) {
          if (l.args.clone) {
            clones.push({ clone: l.args.clone, factory: factory.address });
            knownDuels.set(l.args.clone.toLowerCase(), { clone: l.args.clone, factory: factory.address });
          }
        }
        lastScannedInFactory = BigInt(end);
      } catch (e: any) {
        log(`  getLogs warn ${factory.address.slice(0, 10)}... ${start}-${end}: ${e.message?.slice(0, 60)}`);
        if (e.message?.includes("timeout")) {
          log(`  skipping remaining blocks for ${factory.address.slice(0, 10)}...`);
          break;
        }
      }
    }

    // Persist scan position
    await setPersistedBlock(factory.address, lastScannedInFactory);
  }

  log(`Scanned to block ${latest} — ${clones.length} new duel(s) from events, ${knownDuels.size} total known`);

  // ── Phase 3: Process all known duels ───────────────────
  let actions = 0;
  const duelsToProcess = Array.from(knownDuels.values()).slice(0, MAX_DUELS_PER_RUN);
  for (const { clone, factory } of duelsToProcess) {
    if (Date.now() - scanStart > TIME_BUDGET_MS) {
      log(`TIME BUDGET reached — stopping processing after ${actions} actions`);
      break;
    }
    const tx = await processDuel(clone, factory, publicClient, walletClient);
    if (tx) actions++;
  }

  return { blockNumber: latest, totalDuels: clones.length, actions };
}

// ── Route handlers ───────────────────────────────────────
export async function GET(req: NextRequest) {
  const startTime = Date.now();

  // Authenticate
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    log("UNAUTHORIZED — bad or missing CRON_SECRET");
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  log(`auth: ${cronSecret ? (authHeader ? "Bearer ✓" : "no header") : "no secret set"}`);

  if (!PRIVATE_KEY) {
    log("ERROR: KEEPER_PRIVATE_KEY not set");
    return NextResponse.json(
      { error: "KEEPER_PRIVATE_KEY not configured" },
      { status: 500 }
    );
  }

  try {
    const publicClient = createPublicClient({
      chain: somniaChain,
      transport: http(RPC_URL),
    });
    const walletClient = createWalletClient({
      account: privateKeyToAccount(PRIVATE_KEY as `0x${string}`),
      chain: somniaChain,
      transport: http(RPC_URL),
    });

    // Log keeper wallet balance
    const balance = await publicClient.getBalance({ address: walletClient.account!.address });
    log(`keeper wallet: ${walletClient.account!.address} balance: ${formatEther(balance)} STT`);
    if (balance < BigInt("100000000000000000")) { // < 0.1 STT
      log(`WARNING: keeper wallet balance critically low!`);
    }

    log("--- cron run start ---");
    const result = await scanAndProcess(publicClient, walletClient);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    log(
      `--- cron run done: ${result.actions} action(s), ${result.totalDuels} duel(s), ${elapsed}s ---`
    );

    return NextResponse.json({
      ok: true,
      blockNumber: Number(result.blockNumber),
      totalDuels: result.totalDuels,
      actions: result.actions,
      elapsed: `${elapsed}s`,
      timestamp: new Date().toISOString(),
    });
  } catch (e: any) {
    log(`CRON ERROR: ${e.message}`);
    return NextResponse.json(
      { error: e.message || "Internal error" },
      { status: 500 }
    );
  }
}

// POST: manual trigger — accepts optional { clones: [{ address, factory }] }
export async function POST(req: NextRequest) {
  const startTime = Date.now();

  if (!PRIVATE_KEY) {
    return NextResponse.json(
      { error: "KEEPER_PRIVATE_KEY not configured" },
      { status: 500 }
    );
  }

  try {
    const publicClient = createPublicClient({
      chain: somniaChain,
      transport: http(RPC_URL),
    });
    const walletClient = createWalletClient({
      account: privateKeyToAccount(PRIVATE_KEY as `0x${string}`),
      chain: somniaChain,
      transport: http(RPC_URL),
    });

    // Log balance on manual runs too
    const balance = await publicClient.getBalance({ address: walletClient.account!.address });
    log(`keeper wallet: ${walletClient.account!.address} balance: ${formatEther(balance)} STT`);

    // Check for specific clones in request body
    let explicitClones: { clone: Address; factory: Address }[] = [];
    try {
      const body = await req.json().catch(() => null);
      if (body?.clones && Array.isArray(body.clones) && body.clones.length > 0) {
        explicitClones = body.clones.map((c: any) => ({
          clone: c.address as Address,
          factory: c.factory as Address,
        }));
        log(`manual: processing ${explicitClones.length} explicit clone(s)`);
      }
    } catch {}

    if (explicitClones.length > 0) {
      let actions = 0;
      for (const { clone, factory } of explicitClones) {
        const tx = await processDuel(clone, factory, publicClient, walletClient);
        if (tx) actions++;
      }
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      log(`--- manual run done: ${actions} action(s), ${explicitClones.length} explicit, ${elapsed}s ---`);
      return NextResponse.json({
        ok: true,
        actions,
        totalDuels: explicitClones.length,
        elapsed: `${elapsed}s`,
        mode: "explicit",
      });
    }

    // Fallback: full scan
    log("--- manual run start (scan) ---");
    const result = await scanAndProcess(publicClient, walletClient);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    log(
      `--- manual run done: ${result.actions} action(s), ${result.totalDuels} duel(s), ${elapsed}s ---`
    );

    return NextResponse.json({
      ok: true,
      blockNumber: Number(result.blockNumber),
      totalDuels: result.totalDuels,
      actions: result.actions,
      elapsed: `${elapsed}s`,
      mode: "scan",
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "Internal error" },
      { status: 500 }
    );
  }
}
