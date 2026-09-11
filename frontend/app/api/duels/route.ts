import { NextResponse } from "next/server";
import { createPublicClient, http, formatEther } from "viem";
import * as blobReal from "@vercel/blob";
import { somnia } from "@/lib/config";
import { FACTORY_ADDRESS, LEGACY_FACTORY_ADDRESSES, WAGER_ABI } from "@/lib/contracts";
import { fetchMarketAssets } from "@/lib/dreamdex";

// Server-side duel index — the "instant Arena" data source.
//
// WHY: Arena's first paint depended on each visitor's browser scanning Somnia
// logs over a flaky public RPC. Cold sessions showed "No open challenges" for
// up to a minute, and any failed chunk read as zero duels. This endpoint keeps
// ONE server-side copy of the duel list, persisted in Vercel Blob, and serves
// it immediately. The browser scan becomes a top-up, not the source of truth.
//
// Scan strategy (per refresh):
//   1. top-up: blocks since the last persisted scan position (usually small)
//   2. deepen: one ~63-minute window further down toward the history floor,
//      until the floor is reached — so a cold index converges to full history
//      within a few requests instead of one huge timeout-prone scan.

const DUELS_BLOB = "index/duels.json";
const FLOOR_BLOCK = BigInt("484741715"); // V30 factory deploy — nothing older is decodable
const CHUNK = BigInt(900);
const PARALLEL = 8;
const DEEPEN = BigInt(30_000); // history added per refresh (~48 min of chain)
const COLD_MAX = BigInt(30_000); // first-ever scan window (recent duels, instant value)
const TERMINAL = new Set([2, 3, 4]); // SETTLED / REFUNDED / CANCELLED

const EVENT_ABI = [
  {
    type: "event" as const,
    name: "DuelCreated",
    inputs: [
      { name: "clone", type: "address", indexed: true },
      { name: "playerA", type: "address", indexed: true },
      { name: "stakeAmount", type: "uint256", indexed: false },
      { name: "marketAddress", type: "address", indexed: false },
      { name: "joinDeadline", type: "uint256", indexed: false },
      { name: "creatorIsUp", type: "bool", indexed: false },
    ],
  },
] as const;

type DuelRow = {
  address: string;
  playerA: string;
  playerB: string;
  stakeAmount: string;
  marketAddress: string;
  joinDeadline: number;
  state: number;
  asset: string;
  createdBlock: number;
};

type IndexFile = {
  duels: DuelRow[];
  /** Lowest block fully scanned (history walk position). */
  cursor: number;
  /** Highest block fully scanned (top-up position). */
  lastScanned: number;
};

const factories = (): `0x${string}`[] => [FACTORY_ADDRESS, ...LEGACY_FACTORY_ADDRESSES] as `0x${string}`[];

function rpc() {
  return createPublicClient({
    transport: http(somnia.rpcUrls.default.http[0], { timeout: 20_000, retryCount: 1 }),
  });
}

// Serialize refreshes within one serverless instance (concurrent GETs).
let chain: Promise<unknown> = Promise.resolve();

async function scanRange(c: ReturnType<typeof rpc>, from: bigint, to: bigint): Promise<any[]> {
  if (from > to) return [];
  const ranges: { from: bigint; to: bigint }[] = [];
  let cursor = from;
  while (cursor <= to) {
    const end = cursor + CHUNK - BigInt(1) > to ? to : cursor + CHUNK - BigInt(1);
    ranges.push({ from: cursor, to: end });
    cursor = end + BigInt(1);
  }
  const all: any[] = [];
  for (let i = 0; i < ranges.length; i += PARALLEL) {
    const batch = ranges.slice(i, i + PARALLEL);
    const results = await Promise.all(
      batch.map(async (r) => {
        try {
          return await c.getLogs({ address: factories(), event: EVENT_ABI[0], fromBlock: r.from, toBlock: r.to });
        } catch {
          return null; // chunk-failed marker
        }
      })
    );
    for (const r of results) {
      if (r === null) throw new Error("chunk-failed");
      all.push(...r);
    }
  }
  return all;
}

async function readStates(c: ReturnType<typeof rpc>, clones: string[]): Promise<Map<string, { state: number; playerB: string }>> {
  const out = new Map<string, { state: number; playerB: string }>();
  const BATCH = 20;
  for (let i = 0; i < clones.length; i += BATCH) {
    const batch = clones.slice(i, i + BATCH);
    const res = await Promise.all(
      batch.map(async (clone) => {
        try {
          const [state, playerB] = await Promise.all([
            c.readContract({ address: clone as `0x${string}`, abi: WAGER_ABI, functionName: "state" }),
            c.readContract({ address: clone as `0x${string}`, abi: WAGER_ABI, functionName: "playerB" }),
          ]);
          return { clone, state: Number(state), playerB: playerB as string };
        } catch {
          return null;
        }
      })
    );
    for (const r of res) if (r) out.set(r.clone, { state: r.state, playerB: r.playerB });
  }
  return out;
}

async function loadIndex(): Promise<IndexFile | null> {
  try {
    const head = await blobReal.head(DUELS_BLOB).catch(() => null);
    if (!head) return null;
    const r = await fetch(head.url, { cache: "no-store" });
    if (!r.ok) return null;
    const data = (await r.json()) as IndexFile;
    if (!Array.isArray(data.duels)) return null;
    return data;
  } catch {
    return null;
  }
}

async function saveIndex(index: IndexFile): Promise<void> {
  await blobReal.put(DUELS_BLOB, JSON.stringify(index), {
    access: "public",
    addRandomSuffix: false,
    contentType: "application/json",
    allowOverwrite: true,
  });
}

async function refreshIndex(prev: IndexFile | null): Promise<IndexFile> {
  const c = rpc();
  const latest = await c.getBlockNumber();
  const latestB = BigInt(latest);

  const byAddress = new Map<string, DuelRow>();
  for (const d of prev?.duels ?? []) byAddress.set(d.address.toLowerCase(), d);

  // 1) top-up: new blocks since the last scan
  let lastScanned = prev?.lastScanned ?? 0;
  const topFrom = lastScanned > 0 ? BigInt(lastScanned) + BigInt(1) : latestB - COLD_MAX + BigInt(1);
  let topLogs: any[] = [];
  let topOk = true;
  try {
    topLogs = await scanRange(c, topFrom < BigInt(0) ? BigInt(0) : topFrom, latestB);
  } catch {
    topOk = false; // retry window next refresh
  }
  if (topOk) lastScanned = Number(latest);

  // 2) deepen: extend history one window further down
  let cursor = prev?.cursor ?? 0;
  if (!prev) {
    // cold index: history walk starts just below the cold window
    cursor = Number(topFrom > BigInt(0) ? topFrom : latestB - COLD_MAX + BigInt(1));
  }
  let deepenLogs: any[] = [];
  let deepenOk = true;
  if (cursor > Number(FLOOR_BLOCK)) {
    const dTo = BigInt(cursor) - BigInt(1);
    const dFrom = dTo - DEEPEN + BigInt(1) < FLOOR_BLOCK ? FLOOR_BLOCK : dTo - DEEPEN + BigInt(1);
    try {
      deepenLogs = await scanRange(c, dFrom, dTo);
      cursor = Number(dFrom); // only advance when the window fully scanned
    } catch {
      deepenOk = false; // same window retried next refresh
    }
  } else {
    cursor = Number(FLOOR_BLOCK);
  }

  // merge new logs
  const newLogs = [...topLogs, ...deepenLogs];
  const clones = newLogs.map((l) => l.args.clone as string);
  if (clones.length > 0) {
    const [stateMap, assetMap] = await Promise.all([
      readStates(c, clones),
      fetchMarketAssets([...new Set(newLogs.map((l) => l.args.marketAddress as string))]),
    ]);
    for (const log of newLogs) {
      const { clone, playerA, stakeAmount, marketAddress, joinDeadline } = log.args;
      const onChain = stateMap.get(clone as string);
      const row: DuelRow = {
        address: clone as string,
        playerA: playerA as string,
        playerB: onChain?.playerB ?? "0x0000000000000000000000000000000000000000",
        stakeAmount: formatEther(stakeAmount as bigint),
        marketAddress: marketAddress as string,
        joinDeadline: Number(joinDeadline),
        state: onChain?.state ?? 0,
        asset: assetMap.get((marketAddress as string).toLowerCase()) ?? "BTC",
        createdBlock: Number(log.blockNumber ?? 0),
      };
      const existing = byAddress.get((clone as string).toLowerCase());
      if (!existing || row.createdBlock >= existing.createdBlock) byAddress.set((clone as string).toLowerCase(), row);
    }
  }

  // 3) refresh states of known non-terminal duels (settlements show up here
  //    even for duels created before this server's lifetime)
  const stale = [...byAddress.values()]
    .filter((d) => !TERMINAL.has(d.state))
    .sort((a, b) => b.createdBlock - a.createdBlock)
    .slice(0, 100);
  if (stale.length > 0) {
    const refreshed = await readStates(c, stale.map((d) => d.address));
    for (const d of stale) {
      const s = refreshed.get(d.address);
      if (s) {
        d.state = s.state;
        if (s.playerB !== "0x0000000000000000000000000000000000000000") d.playerB = s.playerB;
      }
    }
  }

  const duels = [...byAddress.values()].sort((a, b) => b.createdBlock - a.createdBlock);
  return { duels, cursor, lastScanned };
}

export const maxDuration = 60;

export async function GET() {
  try {
    const prev = await loadIndex();
    const run = chain.then(() => refreshIndex(prev));
    chain = run.catch(() => {});
    const { duels, cursor, lastScanned } = await run;
    saveIndex({ duels, cursor, lastScanned }).catch(() => {});
    return NextResponse.json({ duels }, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    // Never fail the client: fall back to the last good index if present.
    try {
      const prev = await loadIndex();
      if (prev) return NextResponse.json({ duels: prev.duels }, { headers: { "Cache-Control": "no-store" } });
    } catch {}
    return NextResponse.json({ duels: [], error: e?.message ?? "index unavailable" }, { status: 200 });
  }
}
