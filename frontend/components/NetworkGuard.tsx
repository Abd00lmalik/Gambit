"use client";

import { useAccount } from "wagmi";
import { useEnsureCorrectNetwork } from "@/hooks/useEnsureCorrectNetwork";
import { somnia } from "@/lib/config";

/**
 * Banner that appears when the wallet is connected to the wrong network.
 * Place this in the layout to show globally.
 */
export default function NetworkGuard() {
  const { isConnected, chain } = useAccount();
  const { ensureCorrectNetwork, isChecking, error } =
    useEnsureCorrectNetwork();

  if (!isConnected) return null;
  if (chain?.id === somnia.id) return null;

  return (
    <div className="fixed top-[60px] left-0 right-0 z-40 border-b border-yellow-500/30 bg-yellow-500/10 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-500/20 text-sm">
            ⚠
          </div>
          <div>
            <p className="font-body text-sm font-medium text-yellow-400">
              Wrong network — switch to Somnia Testnet to continue
            </p>
            {error && (
              <p className="font-body text-xs text-yellow-500/70">{error}</p>
            )}
          </div>
        </div>
        <button
          onClick={() => ensureCorrectNetwork()}
          disabled={isChecking}
          className="shrink-0 rounded-lg bg-yellow-500 px-4 py-2 font-body text-sm font-semibold text-carbon transition-all hover:bg-yellow-400 disabled:opacity-50"
        >
          {isChecking ? "Switching..." : "Switch Network"}
        </button>
      </div>
    </div>
  );
}
