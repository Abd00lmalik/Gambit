"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { type Address, formatEther } from "viem";
import { usePublicClient } from "wagmi";
import { somnia } from "@/lib/config";
import { FACTORY_ADDRESS, WAGER_ABI } from "@/lib/contracts";

const CHUNK = BigInt(900);

export interface OnChainDuel {
  address: Address;
  playerA: Address;
  playerB: Address;
  stakeAmount: string;
  marketAddress: Address;
  joinDeadline: number;
  state: number;
}

export function useDuelCreatedEvents() {
  const [duels, setDuels] = useState<OnChainDuel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isInitialLoad = useRef(true);
  const client = usePublicClient({ chainId: somnia.id });

  const fetchDuels = useCallback(async () => {
    if (!client) return;
    if (isInitialLoad.current) setIsLoading(true);

    try {
      const latest = await client.getBlockNumber();
      const allLogs: any[] = [];
      let from = latest > BigInt(200_000) ? latest - BigInt(200_000) : BigInt(0);
      let emptyChunks = 0;

      while (from <= latest) {
        const to = from + CHUNK - BigInt(1) > latest ? latest : from + CHUNK - BigInt(1);
        try {
          const logs = await client.getLogs({
            address: FACTORY_ADDRESS,
            event: {
              type: "event",
              name: "DuelCreated",
              inputs: [
                { name: "clone", type: "address", indexed: true },
                { name: "playerA", type: "address", indexed: true },
                { name: "stakeAmount", type: "uint256", indexed: false },
                { name: "marketAddress", type: "address", indexed: false },
                { name: "joinDeadline", type: "uint256", indexed: false },
              ],
            },
            fromBlock: from,
            toBlock: to,
          });
          allLogs.push(...logs);
          emptyChunks = 0;
        } catch {
          emptyChunks++;
          if (emptyChunks > 2) break;
        }
        from = to + BigInt(1);
      }

      const results: OnChainDuel[] = [];
      for (const log of allLogs) {
        const { clone, playerA, stakeAmount, marketAddress, joinDeadline } = log.args;

        let eventState = 0;
        let playerB: Address = "0x0000000000000000000000000000000000000000";
        try {
          const [stateResult, playerBResult] = await Promise.all([
            client.readContract({
              address: clone!,
              abi: WAGER_ABI,
              functionName: "state",
            }),
            client.readContract({
              address: clone!,
              abi: WAGER_ABI,
              functionName: "playerB",
            }),
          ]);
          eventState = Number(stateResult);
          if (playerBResult !== "0x0000000000000000000000000000000000000000") {
            playerB = playerBResult as Address;
          }
        } catch {}

        results.push({
          address: clone!,
          playerA: playerA!,
          playerB,
          stakeAmount: formatEther(stakeAmount!),
          marketAddress: marketAddress!,
          joinDeadline: Number(joinDeadline),
          state: eventState,
        });
      }

      setDuels(results.reverse());
    } catch (e) {
      console.error("Failed to fetch duel events:", e);
    } finally {
      isInitialLoad.current = false;
      setIsLoading(false);
    }
  }, [client]);

  useEffect(() => {
    fetchDuels();
    const interval = setInterval(fetchDuels, 30000);
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
