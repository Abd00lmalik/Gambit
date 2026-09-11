"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { type Address, formatEther } from "viem";
import { usePublicClient } from "wagmi";
import { somnia } from "@/lib/config";
import { FACTORY_ADDRESS, LEGACY_FACTORY_ADDRESSES, WAGER_ABI } from "@/lib/contracts";
import { fetchMarketAssets } from "@/lib/dreamdex";

const CHUNK = BigInt(900);
const MAX_RETRIES_PER_CHUNK = 3;
const PARALLEL_BATCH = 6;
const CLONE_READ_BATCH = 20;
const INITIAL_RANGE = BigInt(10_000);
const POLL_INTERVAL = 30_000;
const CACHE_KEY = "gambit_last_scanned_block";
const FULL_RESYNC_INTERVAL = 10; // Full resync every N polls

export interface OnChainDuel {
  address: Address;
  playerA: Address;
  playerB: Address;
  stakeAmount: string;
  marketAddress: Address;
  joinDeadline: number;
  state: number;
  asset: string;
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
      if (attempt === retries - 1) return [];
      await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
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
    };
  });
}

export function useDuelCreatedEvents() {
  const [duels, setDuels] = useState<OnChainDuel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isInitialLoad = useRef(true);
  const lastScannedBlock = useRef<bigint>(BigInt(0));
  const pollCount = useRef(0);
  const client = usePublicClient({ chainId: somnia.id });

  // Load cached block on mount
  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        lastScannedBlock.current = BigInt(cached);
      }
    } catch {}
  }, []);

  const fetchDuels = useCallback(async (forceFullResync = false) => {
    if (!client) return;
    if (isInitialLoad.current) setIsLoading(true);

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

      if (isInitialLoad.current) {
        setDuels(newDuels.sort((a, b) => b.joinDeadline - a.joinDeadline));
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
    } finally {
      isInitialLoad.current = false;
      setIsLoading(false);
    }
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
