import { NextRequest, NextResponse } from "next/server";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbiItem,
  getContract,
  formatEther,
  defineChain,
  type Address,
  type PublicClient,
  type WalletClient,
} from "viem";

// ── Config ───────────────────────────────────────────────
const RPC_URL =
  process.env.SOMNIA_RPC_URL || "https://api.infra.testnet.somnia.network";
const PRIVATE_KEY = process.env.KEEPER_PRIVATE_KEY;
const FACTORY_ADDRESS =
  "0x7B1A880EDC070FDF6a484DAEbF72e3143e68A9Ea" as Address;
const FACTORY_DEPLOY_BLOCK = BigInt(482119325);
const CHUNK = 900;
const MAX_DUELS_PER_RUN = 50;

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
  "function subscriptionFund() view returns (uint256)",
  "function deposits(address) view returns (uint256)",
  "function settle()",
  "function refund()",
  "function cancel()",
] as const;

const MARKET_ABI = [
  "function isResolved() view returns (bool)",
  "function isVoided() view returns (bool)",
] as const;

const FACTORY_ABI = [
  "function markets(bytes32) view returns (tuple(bytes32 oracleQuestionId, uint8 outcomeSlotCount, uint32 voidPolicy, address collateral, bytes32 originOperatorId, bytes32 originVenueId, address oracleAdapter, address creator, address market, bytes32 slug, address resolver, uint32 opensAt, uint32 closesAt, uint8 conditionType))",
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
  subscriptionFund: bigint;
}> {
  const c = getContract({
    address: clone,
    abi: WAGER_ABI,
    client: publicClient,
  });
  const [state, joinDl, mA, mB, mktId, resolved, stake, subFund] =
    await Promise.all([
      c.read.state(),
      c.read.joinDeadline(),
      c.read.playerA(),
      c.read.playerB(),
      c.read.marketId(),
      c.read.resolvedMarketContract(),
      c.read.stakeAmount(),
      c.read.subscriptionFund(),
    ]);
  return {
    state: Number(state as bigint),
    joinDeadline: joinDl as bigint,
    playerA: mA as Address,
    playerB: mB as Address,
    marketId: mktId as `0x${string}`,
    resolvedMarketContract: resolved as Address,
    stakeAmount: stake as bigint,
    subscriptionFund: subFund as bigint,
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
  const c = getContract({
    address: addr,
    abi: MARKET_ABI,
    client: publicClient,
  });
  const [resolved, voided] = await Promise.all([
    c.read.isResolved().catch(() => false) as Promise<boolean>,
    c.read.isVoided().catch(() => false) as Promise<boolean>,
  ]);
  return { exists: true, resolved, voided };
}

async function resolveMarket(
  marketId: `0x${string}`,
  publicClient: PublicClient
): Promise<Address | null> {
  const code = await publicClient.getCode({ address: FACTORY_ADDRESS });
  if (!code || code === "0x") return null;
  const c = getContract({
    address: FACTORY_ADDRESS,
    abi: FACTORY_ABI,
    client: publicClient,
  });
  const r = await c.read.markets([marketId]);
  return (r as any).market as Address;
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
    gas: BigInt(500000),
  });
  const hash = await walletClient.writeContract(request);
  return publicClient.waitForTransactionReceipt({ hash });
}

// ── Core logic ───────────────────────────────────────────
async function processDuel(
  clone: Address,
  publicClient: PublicClient,
  walletClient: WalletClient
): Promise<string | null> {
  let info;
  try {
    info = await getDuelInfo(clone, publicClient);
  } catch {
    return null;
  }

  if (FINAL.has(info.state)) return null;

  let market;
  try {
    const resolvedAddr =
      info.resolvedMarketContract !== ZERO_ADDR
        ? info.resolvedMarketContract
        : await resolveMarket(info.marketId, publicClient);
    market = await getMarketStatus(resolvedAddr ?? undefined, publicClient);
  } catch {
    market = { exists: false, resolved: false, voided: false };
  }

  const now = BigInt(Math.floor(Date.now() / 1000));
  const deadlinePassed = now > info.joinDeadline;

  // CREATED: unjoined — cancel if resolved or expired
  if (info.state === CREATED && (market.resolved || deadlinePassed)) {
    log(
      `CANCEL ${clone} — stake: ${formatEther(info.stakeAmount)} STT, reason: ${market.resolved ? "market resolved" : "deadline passed"}`
    );
    try {
      const r = await sendTx(walletClient, publicClient, clone, "cancel");
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
        `SETTLE ${clone} — pot: ${formatEther(info.stakeAmount * BigInt(2))} STT`
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
  }

  return null;
}

async function scanAndProcess(
  publicClient: PublicClient,
  walletClient: WalletClient
) {
  const latest = await publicClient.getBlockNumber();
  const clones: Address[] = [];

  // Scan all DuelCreated events from factory deploy block
  for (
    let start = Number(FACTORY_DEPLOY_BLOCK);
    start <= Number(latest);
    start += CHUNK
  ) {
    const end = Math.min(start + CHUNK - 1, Number(latest));
    try {
      const logs = await publicClient.getLogs({
        address: FACTORY_ADDRESS,
        event: DUEL_CREATED_EVENT,
        fromBlock: BigInt(start),
        toBlock: BigInt(end),
      });
      for (const l of logs) {
        if (l.args.clone) clones.push(l.args.clone);
      }
    } catch (e: any) {
      log(`  getLogs warn ${start}-${end}: ${e.message?.slice(0, 60)}`);
    }
  }

  log(`Scanned to block ${latest} — ${clones.length} total duel(s)`);

  let actions = 0;
  for (const clone of clones.slice(0, MAX_DUELS_PER_RUN)) {
    const tx = await processDuel(clone, publicClient, walletClient);
    if (tx) actions++;
  }

  return { blockNumber: latest, totalDuels: clones.length, actions };
}

// ── Route handlers ───────────────────────────────────────
export async function GET(req: NextRequest) {
  const startTime = Date.now();

  // Authenticate: Vercel cron sends CRON_SECRET as Bearer token.
  // If CRON_SECRET is set, require it; otherwise allow unauthenticated (permissionless on-chain calls).
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
      account: PRIVATE_KEY as `0x${string}`,
      chain: somniaChain,
      transport: http(RPC_URL),
    });

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

// POST: manual trigger (same logic, no auth required for local testing)
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
      account: PRIVATE_KEY as `0x${string}`,
      chain: somniaChain,
      transport: http(RPC_URL),
    });

    log("--- manual run start ---");
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
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "Internal error" },
      { status: 500 }
    );
  }
}
