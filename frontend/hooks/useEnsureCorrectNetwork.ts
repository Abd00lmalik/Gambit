import { useAccount, useSwitchChain } from "wagmi";
import { useCallback, useState } from "react";
import { somnia } from "@/lib/config";

/**
 * Hook that ensures the wallet is on Somnia Testnet before proceeding.
 * Returns:
 * - isCorrectNetwork: whether the wallet is on the correct chain
 * - ensureCorrectNetwork: call before any transaction; returns true if on correct network
 * - isChecking: whether a switch is in progress
 * - error: error message if switch failed
 */
export function useEnsureCorrectNetwork() {
  const { chain } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCorrectNetwork = chain?.id === somnia.id;

  const ensureCorrectNetwork = useCallback(async (): Promise<boolean> => {
    setError(null);

    if (chain?.id === somnia.id) {
      return true;
    }

    setIsChecking(true);
    try {
      await switchChainAsync({ chainId: somnia.id });
      setIsChecking(false);
      return true;
    } catch (e: any) {
      setIsChecking(false);
      const msg = e?.message?.includes("User rejected")
        ? "Network switch was rejected. Please switch to Somnia Testnet to continue."
        : "Failed to switch network. Please switch to Somnia Testnet manually.";
      setError(msg);
      return false;
    }
  }, [chain?.id, switchChainAsync]);

  return {
    isCorrectNetwork,
    ensureCorrectNetwork,
    isChecking,
    error,
  };
}
