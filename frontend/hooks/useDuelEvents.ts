"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { type Address, formatEther } from "viem";
import { usePublicClient } from "wagmi";
import { somnia } from "@/lib/config";
import { FACTORY_ADDRESS, LEGACY_FACTORY_ADDRESSES, WAGER_ABI } from "@/lib/contracts";
import { fetchMarketAssets } from "@/lib/dreamdex";

const CHUNK = BigInt(900);
const MAX_RETRIES_PER_CHUNK = 3;
const PARALLEL_BATCH = 8;
const CLONE_READ_BATCH = 20;
// Somnia produces ~10.5 blocks/s and this RPC rejects getLogs spans over 1000
// blocks, so the INITIAL window only needs to cover fresh duels since the last
// visit. History older than that is filled in by the progressive backfill
// below — the old INITIAL_RANGE of 10_000 blocks reached just ~16 minutes
// back, which is why the Arena appeared capped at a couple of duels.
const INITIAL_RANGE = BigInt(1_000);
const POLL_INTERVAL = 30_000;
const CACHE_KEY = "gambit_last_scanned_block";
const BACKFILL_KEY = "gambit_backfill_floor";
const DUELS_CACHE_KEY = "gambit_duels_cache_v1";
const FULL_RESYNC_INTERVAL = 10; // Full resync every N polls
// Backfill stops here: block where the V30 factory (the oldest one whose duels
// still use the current DuelCreated signature) was deployed. Everything older
// came from factories emitting a pre-creatorIsUp event shape we cannot decode.
export const DUEL_HISTORY_FLOOR_BLOCK = BigInt("484741715");
const BACKFILL_WAVE = 24; // parallel 900-block chunks per backfill pass
const BACKFILL_TICK_MS = 1_200;

export interface OnChainDuel {
  address: Address;
  playerA: Address;
  playerB: Address;
  stakeAmount: string;
  marketAddress: Address;
  joinDeadline: number;
  state: number;
  asset: string;
  /** Block the DuelCreated log was emitted in — the true recency key. */
  createdBlock: number;
}

const DUEL_CREATED_EVENT = {
  type: "event" as const,
  name: "DuelCreated",
  inputs: [
    { name: "clone", type: "address", indexed: true },
    { name: "playerA", type: "address", indexed: true },
    { name: "stakeAmount", type: "uint256", indexed: false },
    { name: "marketAddress", type: "address", indexed: false },
    { name: "joinDeadline", type: "uint256", indexed: false },
    // The event gained `creatorIsUp`, which changed its topic0 hash. Omitting
    // it here made getLogs filter by the OLD hash — zero duels ever matched,
    // so freshly created challenges never appeared in the Arena listing.
    { name: "creatorIsUp", type: "bool", indexed: false },
  ],
} as const;

async function fetchChunkWithRetry(
  client: any,
  from: bigint,
  to: bigint,
  retries = MAX_RETRIES_PER_CHUNK
): Promise<any[]> {
  // Scan the current factory AND all legacy ones: pre-V31 duels must keep
  // appearing in the Arena listing after a redeployment.
  const factories: Address[] = [FACTORY_ADDRESS, ...LEGACY_FACTORY_ADDRESSES];
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await client.getLogs({
        address: factories,
        event: DUEL_CREATED_EVENT,
        fromBlock: from,
        toBlock: to,
      });
    } catch (e) {
      // Never swallow a failed chunk: returning [] here made a flaky RPC burst
      // paint "No open challenges" and the next data only arrived 30s later.
      if (attempt === retries - 1) throw e;
      await new Promise((r) => setTimeout(r, 400 * 2 ** attempt + Math.floor(Math.random() * 200)));
    }
  }
  return [];
}

async function parallelScan(
  client: any,
  from: bigint,
  to: bigint
): Promise<any[]> {
  const ranges: { from: bigint; to: bigint }[] = [];
  let cursor = from;
  while (cursor <= to) {
    const end = cursor + CHUNK - BigInt(1) > to ? to : cursor + CHUNK - BigInt(1);
    ranges.push({ from: cursor, to: end });
    cursor = end + BigInt(1);
  }

  const allLogs: any[] = [];
  for (let i = 0; i < ranges.length; i += PARALLEL_BATCH) {
    const batch = ranges.slice(i, i + PARALLEL_BATCH);
    const results = await Promise.all(
      batch.map((r) => fetchChunkWithRetry(client, r.from, r.to))
    );
    for (const logs of results) {
      allLogs.push(...logs);
    }
  }
  return allLogs;
}

async function readDuelState(
  client: any,
  clone: Address
): Promise<{ state: number; playerB: Address }> {
  try {
    const [stateResult, playerBResult] = await Promise.all([
      client.readContract({
        address: clone,
        abi: WAGER_ABI,
        functionName: "state",
      }),
      client.readContract({
        address: clone,
        abi: WAGER_ABI,
        functionName: "playerB",
      }),
    ]);
    return {
      state: Number(stateResult),
      playerB:
        playerBResult !== "0x0000000000000000000000000000000000000000"
          ? (playerBResult as Address)
          : "0x0000000000000000000000000000000000000000",
    };
  } catch {
    return { state: 0, playerB: "0x0000000000000000000000000000000000000000" };
  }
}

async function batchReadDuelStates(
  client: any,
  clones: Address[]
): Promise<Map<Address, { state: number; playerB: Address }>> {
  const results = new Map<Address, { state: number; playerB: Address }>();
  for (let i = 0; i < clones.length; i += CLONE_READ_BATCH) {
    const batch = clones.slice(i, i + CLONE_READ_BATCH);
    const batchResults = await Promise.all(
      batch.map((clone) => readDuelState(client, clone))
    );
    batch.forEach((clone, idx) => {
      results.set(clone, batchResults[idx]);
    });
  }
  return results;
}

function logsToDuels(
  logs: any[],
  stateMap: Map<Address, { state: number; playerB: Address }>,
  assetMap: Map<string, string>
): OnChainDuel[] {
  return logs.map((log) => {
    const { clone, playerA, stakeAmount, marketAddress, joinDeadline } =
      log.args;
    const onChain = stateMap.get(clone!);
    return {
      address: clone!,
      playerA: playerA!,
      playerB: onChain?.playerB ?? "0x0000000000000000000000000000000000000000",
      stakeAmount: formatEther(stakeAmount!),
      marketAddress: marketAddress!,
      joinDeadline: Number(joinDeadline),
      state: onChain?.state ?? 0,
      asset: assetMap.get((marketAddress as string)?.toLowerCase()) ?? "BTC",
      createdBlock: Number(log.blockNumber ?? 0),
    };
  });
}

export function useDuelCreatedEvents() {
  const [duels, setDuels] = useState<OnChainDuel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isInitialLoad = useRef(true);
  const lastScannedBlock = useRef<bigint>(BigInt(0));
  // Backfill walk position: the lowest block already scanned. 0 = not started
  // (a fresh session starts from the bottom of its initial window).
  const backfillFloor = useRef<bigint>(BigInt(0));
  const backfillDone = useRef(false);
  const pollCount = useRef(0);
  const client = usePublicClient({ chainId: somnia.id });

  // Load cached block + hydrated duel list on mount, then hydrate instantly
  // from the server-side duel index. The chain scan below stays the freshness
  // mechanism; the server index exists so Arena shows the FULL duel list the
  // moment it opens, even on a brand-new browser with an empty localStorage.
  useEffect(() => {
    let cancelled = false;
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        lastScannedBlock.current = BigInt(cached);
      }
      const cachedFloor = localStorage.getItem(BACKFILL_KEY);
      if (cachedFloor) {
        const floor = BigInt(cachedFloor);
        if (floor <= DUEL_HISTORY_FLOOR_BLOCK) {
          backfillDone.current = true; // a previous session fully backfilled
        } else {
          backfillFloor.current = floor; // resume the walk where it stopped
        }
      }
      const cachedDuels = localStorage.getItem(DUELS_CACHE_KEY);
      if (cachedDuels) {
        const parsed = JSON.parse(cachedDuels) as OnChainDuel[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setDuels(parsed.sort((a, b) => b.createdBlock - a.createdBlock));
          setIsLoading(false);
        }
      }
    } catch {}
    fetch("/api/duels")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.duels?.length) return;
        setDuels((prev) => {
          const existing = new Map(prev.map((d) => [d.address, d]));
          for (const d of data.duels as OnChainDuel[]) existing.set(d.address, d);
          return [...existing.values()].sort((a, b) => b.createdBlock - a.createdBlock);
        });
        setIsLoading(false);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Persist the duels list so the next session loads instantly.
  useEffect(() => {
    if (duels.length === 0) return;
    try { localStorage.setItem(DUELS_CACHE_KEY, JSON.stringify(duels)); } catch {}
  }, [duels]);

  const fetchDuels = useCallback(async (forceFullResync = false) => {
    if (!client) return;
    if (isInitialLoad.current) setIsLoading(true);
    let succeeded = false;

    try {
      const latest = await client.getBlockNumber();

      // P4: Periodic full resync to prevent cache drift
      const shouldFullResync = forceFullResync || (pollCount.current > 0 && pollCount.current % FULL_RESYNC_INTERVAL === 0);
      pollCount.current += 1;

      let allLogs: any[];
      if (isInitialLoad.current || lastScannedBlock.current === BigInt(0) || shouldFullResync) {
        // Initial load OR periodic full resync: scan from latest - INITIAL_RANGE
        const from =
          latest > INITIAL_RANGE ? latest - INITIAL_RANGE : BigInt(0);
        if (shouldFullResync) {
          console.log(`[DuelEvents] Full resync #${pollCount.current / FULL_RESYNC_INTERVAL}: scanning from ${from} to ${latest}`);
        }
        allLogs = await parallelScan(client, from, latest);
      } else {
        // Incremental: only scan new blocks since last scan
        const from = lastScannedBlock.current + BigInt(1);
        if (from > latest) {
          isInitialLoad.current = false;
          setIsLoading(false);
          return;
        }
        allLogs = await parallelScan(client, from, latest);
      }

      lastScannedBlock.current = latest;
      try {
        localStorage.setItem(CACHE_KEY, latest.toString());
      } catch {}

      const clones = allLogs.map((log) => log.args.clone as Address);

      // Batch-fetch state and asset info in parallel
      const marketAddresses = allLogs.map((log) => log.args.marketAddress as string);
      const [stateMap, assetMap] = await Promise.all([
        batchReadDuelStates(client, clones),
        fetchMarketAssets(marketAddresses),
      ]);

      const newDuels = logsToDuels(allLogs, stateMap, assetMap);

      succeeded = true;
      if (isInitialLoad.current) {
        // MERGE, never replace: a hydrated cache may already hold older duels
        // (settled ones) that this fresh 1000-block scan cannot see.
        setDuels((prev) => {
          const existing = new Map(prev.map((d) => [d.address, d]));
          for (const d of newDuels) existing.set(d.address, d);
          return [...existing.values()].sort((a, b) => b.createdBlock - a.createdBlock);
        });
      } else {
        setDuels((prev) => {
          const existing = new Map(prev.map((d) => [d.address, d]));
          for (const d of newDuels) {
            existing.set(d.address, d);
          }
          return [...existing.values()].sort(
            (a, b) => b.joinDeadline - a.joinDeadline
          );
        });
      }
    } catch (e) {
      console.error("Failed to fetch duel events:", e);
      // A transient RPC failure during the FIRST paint must not render the
      // empty state (that read as "slow/zero duels"). Stay in the loading
      // state and retry shortly.
      if (isInitialLoad.current) {
        setTimeout(() => { if (isInitialLoad.current) fetchDuels(); }, 3000);
      }
    } finally {
      if (succeeded || !isInitialLoad.current) {
        isInitialLoad.current = false;
        setIsLoading(false);
      }
    }
  }, [client]);

  // Progressive history backfill: the initial window only reaches ~16 minutes
  // back, so older duels stream in afterwards, one small parallel wave per
  // pass, oldest-first walk downward. Runs between polls until it reaches the
  // V30 deploy floor, then never again (persisted in localStorage).
  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    let inFlight = false;
    const runBackfill = async () => {
      if (backfillDone.current || cancelled || inFlight) return;
      inFlight = true;
      try {
      // First run of a fresh session: start just below the initial scan window.
      if (backfillFloor.current === BigInt(0)) {
        try {
          const latest = await client.getBlockNumber();
          backfillFloor.current = latest + BigInt(1) - (lastScannedBlock.current > BigInt(0) ? INITIAL_RANGE : BigInt(0));
        } catch { return; }
      }
      const to = backfillFloor.current - BigInt(1);
      if (to <= DUEL_HISTORY_FLOOR_BLOCK) {
        backfillDone.current = true;
        try { localStorage.setItem(BACKFILL_KEY, DUEL_HISTORY_FLOOR_BLOCK.toString()); } catch {}
        return;
      }
      const from = to - CHUNK * BigInt(BACKFILL_WAVE) + BigInt(1);
      let logs: any[];
      try {
        logs = await parallelScan(client, from < DUEL_HISTORY_FLOOR_BLOCK ? DUEL_HISTORY_FLOOR_BLOCK : from, to);
      } catch (e) {
        console.warn("[DuelEvents] backfill wave failed, will retry next tick", e);
        return; // floor unchanged; the interval retries the same range
      }
      if (cancelled) return;
      backfillFloor.current = from < DUEL_HISTORY_FLOOR_BLOCK ? DUEL_HISTORY_FLOOR_BLOCK : from;
      try { localStorage.setItem(BACKFILL_KEY, backfillFloor.current.toString()); } catch {}
      if (logs.length === 0) return;
      const clones = logs.map((log: any) => log.args.clone as Address);
      const marketAddresses = logs.map((log: any) => log.args.marketAddress as string);
      const [stateMap, assetMap] = await Promise.all([
        batchReadDuelStates(client, clones),
        fetchMarketAssets(marketAddresses),
      ]);
      if (cancelled) return;
      const older = logsToDuels(logs, stateMap, assetMap);
      setDuels((prev) => {
        const existing = new Map(prev.map((d) => [d.address, d]));
        for (const d of older) existing.set(d.address, d);
        return [...existing.values()].sort((a, b) => b.createdBlock - a.createdBlock);
      });
      } finally {
        inFlight = false;
      }
    };
    const interval = setInterval(runBackfill, BACKFILL_TICK_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [client]);

  useEffect(() => {
    fetchDuels();
    const interval = setInterval(fetchDuels, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchDuels]);

  return { duels, isLoading, refetch: fetchDuels };
}

export function useUserDuels(userAddress: Address | undefined) {
  const { duels, isLoading, refetch } = useDuelCreatedEvents();
  const userDuels = userAddress
    ? duels.filter(
        (d) =>
          d.playerA.toLowerCase() === userAddress.toLowerCase() ||
          d.playerB.toLowerCase() === userAddress.toLowerCase()
      )
    : [];
  return { duels: userDuels, isLoading, refetch };
}
