"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { type Address, formatEther } from "viem";
import { usePublicClient } from "wagmi";
import { somnia } from "@/lib/config";
import { FACTORY_ADDRESS, FACTORY_ABI, WAGER_ABI } from "@/lib/contracts";

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
        fromBlock: BigInt(0),
        toBlock: "latest",
      });

      const results: OnChainDuel[] = [];

      for (const log of logs) {
        const { clone, playerA, stakeAmount, marketAddress, joinDeadline } = log.args;

        try {
          const state = await client.readContract({
            address: clone!,
            abi: WAGER_ABI,
            functionName: "state",
          });

          let playerB: Address = "0x0000000000000000000000000000000000000000";
          try {
            const bAddr = await client.readContract({
              address: clone!,
              abi: WAGER_ABI,
              functionName: "playerB",
            });
            if (bAddr !== "0x0000000000000000000000000000000000000000") {
              playerB = bAddr as Address;
            }
          } catch {}

          results.push({
            address: clone!,
            playerA: playerA!,
            playerB,
            stakeAmount: formatEther(stakeAmount!),
            marketAddress: marketAddress!,
            joinDeadline: Number(joinDeadline),
            state: Number(state),
          });
        } catch (e) {
          results.push({
            address: clone!,
            playerA: playerA!,
            playerB: "0x0000000000000000000000000000000000000000",
            stakeAmount: formatEther(stakeAmount!),
            marketAddress: marketAddress!,
            joinDeadline: Number(joinDeadline),
            state: 0,
          });
        }
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
