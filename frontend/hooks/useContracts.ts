"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
  useBalance,
  usePublicClient,
} from "wagmi";
import { parseEther, formatEther, type Address } from "viem";
import {
  FACTORY_ADDRESS,
  FACTORY_ABI,
  WAGER_ABI,
  DREAMDEX_ABI,
  DuelState,
} from "@/lib/contracts";
import { useEnsureCorrectNetwork } from "@/hooks/useEnsureCorrectNetwork";

export function useDuelFactory() {
  const { address } = useAccount();
  const { writeContractAsync, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash: txHash });
  const { ensureCorrectNetwork } = useEnsureCorrectNetwork();

  const createDuel = useCallback(
    async (marketAddress: Address, joinDeadlineSeconds: number, stakeEth: string) => {
      if (!address) throw new Error("Wallet not connected");
      const ok = await ensureCorrectNetwork();
      if (!ok) throw new Error("Wrong network");
      const deadline = Math.floor(Date.now() / 1000) + joinDeadlineSeconds;
      const hash = await writeContractAsync({
        address: FACTORY_ADDRESS,
        abi: FACTORY_ABI,
        functionName: "createDuel",
        args: [marketAddress, BigInt(deadline)],
        value: parseEther(stakeEth),
      });
      return hash;
    },
    [address, writeContractAsync, ensureCorrectNetwork]
  );

  return { createDuel, txHash, isPending: isPending || isConfirming, ensureCorrectNetwork };
}

export function useDuelActions(duelAddress: Address) {
  const { writeContractAsync, data: joinTxHash, isPending: isJoinPending } = useWriteContract();
  const { isLoading: isJoinConfirming } = useWaitForTransactionReceipt({ hash: joinTxHash });
  const { ensureCorrectNetwork } = useEnsureCorrectNetwork();

  const settleDuel = useCallback(async () => {
    const ok = await ensureCorrectNetwork();
    if (!ok) throw new Error("Wrong network");
    const hash = await writeContractAsync({
      address: duelAddress,
      abi: WAGER_ABI,
      functionName: "settle",
    });
    return hash;
  }, [duelAddress, writeContractAsync, ensureCorrectNetwork]);

  const refundDuel = useCallback(async () => {
    const ok = await ensureCorrectNetwork();
    if (!ok) throw new Error("Wrong network");
    const hash = await writeContractAsync({
      address: duelAddress,
      abi: WAGER_ABI,
      functionName: "refund",
    });
    return hash;
  }, [duelAddress, writeContractAsync, ensureCorrectNetwork]);

  const cancelDuel = useCallback(async () => {
    const ok = await ensureCorrectNetwork();
    if (!ok) throw new Error("Wrong network");
    const hash = await writeContractAsync({
      address: duelAddress,
      abi: WAGER_ABI,
      functionName: "cancel",
    });
    return hash;
  }, [duelAddress, writeContractAsync, ensureCorrectNetwork]);

  // ── Two-step deposit+join ──────────────────────────────
  // Somnia reverts writeContract with value. Player B must:
  //   1. sendTransaction (plain STT transfer) → triggers receive() → records deposit
  //   2. writeContract → calls join() → state transitions to LOCKED
  const [depositHash, setDepositHash] = useState<`0x${string}` | undefined>();
  const [joinStep, setJoinStep] = useState<"idle" | "deposit" | "join" | "done">("idle");
  const joinDuelRef = useRef<() => Promise<void>>();

  const publicClient = usePublicClient();

  // Watch deposit tx → when confirmed, auto-call join()
  useEffect(() => {
    if (joinStep !== "deposit" || !depositHash || !publicClient) return;

    let cancelled = false;
    const poll = setInterval(async () => {
      if (cancelled) return;
      try {
        const receipt = await publicClient.getTransactionReceipt({ hash: depositHash });
        if (cancelled || !receipt) return;
        clearInterval(poll);
        setJoinStep("join");
        joinDuelRef.current?.();
      } catch {}
    }, 2000);

    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [joinStep, depositHash, publicClient]);

  const depositAndJoin = useCallback(
    async (amountEth: string) => {
      if (!publicClient) throw new Error("No public client");
      const ok = await ensureCorrectNetwork();
      if (!ok) throw new Error("Wrong network");
      const walletClient = await (window as any).ethereum;
      const accounts = await (window as any).ethereum.request({ method: "eth_accounts" });
      if (!accounts?.[0]) throw new Error("Wallet not connected");

      // Step 1: Plain STT transfer to clone → triggers receive() → records deposit
      setJoinStep("deposit");
      const hash = await new Promise<`0x${string}`>((resolve, reject) => {
        (window as any).ethereum.request({
          method: "eth_sendTransaction",
          params: [{
            from: accounts[0],
            to: duelAddress,
            value: "0x" + BigInt(parseEther(amountEth).toString()).toString(16),
            gas: "0x" + (2500000).toString(16),
          }],
        }).then(resolve).catch(reject);
      });
      setDepositHash(hash);

      // Step 2 will be triggered by the watchTransactionReceipt effect above
      // Store the join callback so the watcher can call it
      joinDuelRef.current = async () => {
        try {
          await writeContractAsync({
            address: duelAddress,
            abi: WAGER_ABI,
            functionName: "join",
          });
          setJoinStep("done");
        } catch (e) {
          setJoinStep("idle");
          throw e;
        }
      };

      return hash;
    },
    [duelAddress, writeContractAsync, publicClient, ensureCorrectNetwork]
  );

  // Wait for join() tx confirmation
  const joinStepIsPending = joinStep === "deposit"
    ? true // waiting for deposit to confirm
    : joinStep === "join"
    ? isJoinPending || isJoinConfirming
    : false;

  return {
    settleDuel,
    refundDuel,
    cancelDuel,
    depositAndJoin,
    txHash: joinStep === "join" ? joinTxHash : depositHash,
    isPending: joinStepIsPending,
    joinStep,
  };
}

export function useDuelReads(duelAddress: Address | undefined) {
  const playerA = useReadContract({
    address: duelAddress,
    abi: WAGER_ABI,
    functionName: "playerA",
    query: { enabled: !!duelAddress },
  });

  const playerB = useReadContract({
    address: duelAddress,
    abi: WAGER_ABI,
    functionName: "playerB",
    query: { enabled: !!duelAddress },
  });

  const stakeAmount = useReadContract({
    address: duelAddress,
    abi: WAGER_ABI,
    functionName: "stakeAmount",
    query: { enabled: !!duelAddress },
  });

  const marketAddress = useReadContract({
    address: duelAddress,
    abi: WAGER_ABI,
    functionName: "marketAddress",
    query: { enabled: !!duelAddress },
  });

  const state = useReadContract({
    address: duelAddress,
    abi: WAGER_ABI,
    functionName: "state",
    query: { enabled: !!duelAddress, refetchInterval: 5000 },
  });

  const getPot = useReadContract({
    address: duelAddress,
    abi: WAGER_ABI,
    functionName: "getPot",
    query: { enabled: !!duelAddress, refetchInterval: 5000 },
  });

  const joinDeadline = useReadContract({
    address: duelAddress,
    abi: WAGER_ABI,
    functionName: "joinDeadline",
    query: { enabled: !!duelAddress },
  });

  const joinDeadlineRemaining = useReadContract({
    address: duelAddress,
    abi: WAGER_ABI,
    functionName: "joinDeadlineRemaining",
    query: { enabled: !!duelAddress, refetchInterval: 1000 },
  });

  const owner = useReadContract({
    address: duelAddress,
    abi: WAGER_ABI,
    functionName: "owner",
    query: { enabled: !!duelAddress },
  });

  const settlementTriggeredAt = useReadContract({
    address: duelAddress,
    abi: WAGER_ABI,
    functionName: "settlementTriggeredAt",
    query: { enabled: !!duelAddress },
  });

  const isReactiveSettlement = useReadContract({
    address: duelAddress,
    abi: WAGER_ABI,
    functionName: "isReactiveSettlement",
    query: { enabled: !!duelAddress },
  });

  const duelState = state.data !== undefined ? Number(state.data) as DuelState : undefined;

  return {
    playerA: playerA.data as Address | undefined,
    playerB: playerB.data as Address | undefined,
    stakeAmount: stakeAmount.data ? formatEther(stakeAmount.data) : undefined,
    marketAddress: marketAddress.data as Address | undefined,
    state: duelState,
    pot: getPot.data ? formatEther(getPot.data) : undefined,
    joinDeadline: joinDeadline.data ? Number(joinDeadline.data) : undefined,
    joinDeadlineRemaining: joinDeadlineRemaining.data ? Number(joinDeadlineRemaining.data) : undefined,
    owner: owner.data as Address | undefined,
    settlementTriggeredAt: settlementTriggeredAt.data ? Number(settlementTriggeredAt.data) : undefined,
    isReactiveSettlement: isReactiveSettlement.data ?? false,
    isLoading: playerA.isLoading || state.isLoading,
    refetch: () => {
      playerA.refetch();
      playerB.refetch();
      state.refetch();
      getPot.refetch();
      joinDeadlineRemaining.refetch();
    },
  };
}

export function useFactoryReads() {
  const feeRecipient = useReadContract({
    address: FACTORY_ADDRESS,
    abi: FACTORY_ABI,
    functionName: "feeRecipient",
  });

  const minStake = useReadContract({
    address: FACTORY_ADDRESS,
    abi: FACTORY_ABI,
    functionName: "minStake",
  });

  const maxStake = useReadContract({
    address: FACTORY_ADDRESS,
    abi: FACTORY_ABI,
    functionName: "maxStake",
  });

  return {
    feeRecipient: feeRecipient.data as Address | undefined,
    minStake: minStake.data ? formatEther(minStake.data) : undefined,
    maxStake: maxStake.data ? formatEther(maxStake.data) : undefined,
  };
}

export function useMarketStatus(marketAddress: Address | undefined) {
  const status = useReadContract({
    address: marketAddress,
    abi: DREAMDEX_ABI,
    functionName: "status",
    query: { enabled: !!marketAddress, refetchInterval: 10000 },
  });

  const isResolved = useReadContract({
    address: marketAddress,
    abi: DREAMDEX_ABI,
    functionName: "isResolved",
    query: { enabled: !!marketAddress, refetchInterval: 10000 },
  });

  const isVoided = useReadContract({
    address: marketAddress,
    abi: DREAMDEX_ABI,
    functionName: "isVoided",
    query: { enabled: !!marketAddress, refetchInterval: 10000 },
  });

  const payoutNumerators = useReadContract({
    address: marketAddress,
    abi: DREAMDEX_ABI,
    functionName: "payoutNumerators",
    query: { enabled: !!marketAddress && isResolved.data === true },
  });

  return {
    status: status.data !== undefined ? Number(status.data) : undefined,
    isResolved: isResolved.data ?? false,
    isVoided: isVoided.data ?? false,
    payoutNumerators: payoutNumerators.data as bigint[] | undefined,
  };
}
