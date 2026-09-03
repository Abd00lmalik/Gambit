"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useAccount } from "wagmi";
import {
  fetchAvailableMarkets,
  fetchMarketsByInterval,
  verifyMarketAddress,
  type DreamDexMarket,
  type MarketCombo,
} from "@/lib/dreamdex";
import AssetIcon from "@/components/AssetIcon";

const INTERVAL_SEC: Record<string, number> = {
  "1m": 60, "5m": 300, "15m": 900, "1h": 3600, "4h": 14400, "1d": 86400,
};

export default function SquadPoolPage() {
  const { isConnected, address } = useAccount();
  const [availableMarkets, setAvailableMarkets] = useState<MarketCombo[]>([]);
  const [selectedAsset, setSelectedAsset] = useState("BTC");
  const [selectedInterval, setSelectedInterval] = useState("15m");
  const [selectedMarket, setSelectedMarket] = useState<DreamDexMarket | null>(null);
  const [marketLoading, setMarketLoading] = useState(false);
  const [squadName, setSquadName] = useState("");
  const [depositAmount, setDepositAmount] = useState("0.5");
  const [selectedSide, setSelectedSide] = useState<"UP" | "DOWN">("UP");
  const [poolState, setPoolState] = useState<"idle" | "creating" | "success">("idle");
  const [poolAddress, setPoolAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  // Fetch available markets
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchAvailableMarkets().then((combos) => {
        if (!cancelled) setAvailableMarkets(combos);
      });
    };
    load();
    const pollId = setInterval(load, 60000);
    return () => { cancelled = true; clearInterval(pollId); };
  }, []);

  const availableAssets = [...new Set(availableMarkets.map((m) => m.asset))];
  const availableIntervals = availableMarkets
    .filter((m) => m.asset === selectedAsset)
    .map((m) => m.label);

  // Fetch selected market
  useEffect(() => {
    let cancelled = false;
    setMarketLoading(true);
    setSelectedMarket(null);

    const intervalSec = INTERVAL_SEC[selectedInterval] ?? 900;
    fetchMarketsByInterval(selectedAsset, intervalSec, 1)
      .then((markets) => {
        if (!cancelled) setSelectedMarket(markets[0] ?? null);
      })
      .catch(() => {
        if (!cancelled) setSelectedMarket(null);
      })
      .finally(() => {
        if (!cancelled) setMarketLoading(false);
      });

    return () => { cancelled = true; };
  }, [selectedAsset, selectedInterval]);

  const inviteLink = poolAddress
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/pool/${poolAddress}`
    : "";

  const handleCreatePool = useCallback(async () => {
    if (!selectedMarket || !isConnected) return;
    setPoolState("creating");
    setError(null);

    try {
      const verification = await verifyMarketAddress(selectedMarket.marketAddress);
      if (!verification.valid) {
        setError(verification.error || "Market verification failed");
        setPoolState("idle");
        return;
      }

      // Create pool transaction would go here via wallet client
      // For demo: show success with invite link
      const mockPoolAddress = "0x" + Math.random().toString(16).slice(2, 42).padEnd(40, "0");
      setPoolAddress(mockPoolAddress);
      setTxHash("0x" + Math.random().toString(16).slice(2, 66));
      setPoolState("success");
    } catch (e: any) {
      setError(e?.message?.includes("User rejected") ? "Transaction rejected" : "Failed to create pool");
      setPoolState("idle");
    }
  }, [selectedMarket, isConnected]);

  const copyInviteLink = useCallback(() => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink);
    }
  }, [inviteLink]);

  // Success state — show invite link
  if (poolState === "success" && poolAddress) {
    return (
      <div className="min-h-screen flex items-center justify-center py-8 px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full text-center glass rounded-2xl p-8"
        >
          <div className="h-16 w-16 rounded-full bg-teal/15 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🎯</span>
          </div>
          <h2 className="font-display text-2xl font-bold text-foam mb-2">
            {squadName || "Squad"} Pool Created!
          </h2>
          <p className="font-body text-sm text-gray-400 mb-4">
            Share this invite link with your squad. Only people with the link can join.
          </p>

          {/* Invite link box */}
          <div className="rounded-xl border border-teal/30 bg-teal/5 p-3 mb-6">
            <p className="font-body text-[10px] text-gray-400 mb-1 uppercase tracking-wider">Invite Link</p>
            <div className="flex items-center gap-2">
              <code className="font-mono text-[11px] text-teal truncate flex-1">
                {inviteLink}
              </code>
              <button
                onClick={copyInviteLink}
                className="shrink-0 rounded-lg bg-teal/20 px-3 py-1.5 font-body text-[10px] font-medium text-teal hover:bg-teal/30 transition-colors"
              >
                Copy
              </button>
            </div>
          </div>

          {/* Pool details */}
          <div className="text-left space-y-2 mb-6 rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <div className="flex justify-between">
              <span className="font-body text-xs text-gray-400">Market</span>
              <span className="font-body text-xs text-foam">{selectedAsset} {selectedInterval}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-body text-xs text-gray-400">Your Side</span>
              <span className={`font-body text-xs ${selectedSide === "UP" ? "text-up" : "text-down"}`}>
                {selectedSide === "UP" ? "▲ Up" : "▼ Down"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="font-body text-xs text-gray-400">Your Stake</span>
              <span className="font-body text-xs text-foam">{depositAmount} STT</span>
            </div>
            <div className="flex justify-between">
              <span className="font-body text-xs text-gray-400">Payout</span>
              <span className="font-body text-xs text-teal">Proportional (2.5% fee)</span>
            </div>
          </div>

          <a
            href={`https://shannon-explorer.somnia.network/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[10px] text-gray-500 hover:text-teal transition-colors block mb-6"
          >
            Tx: {txHash?.slice(0, 16)}...
          </a>

          <div className="flex gap-3 justify-center">
            <a
              href={`/pool/${poolAddress}`}
              className="rounded-xl bg-foam px-6 py-2.5 font-display text-sm font-bold text-carbon transition-all hover:bg-foam-dark"
            >
              View Squad Pool
            </a>
            <button
              onClick={() => { setPoolState("idle"); setPoolAddress(null); setTxHash(null); setSquadName(""); }}
              className="rounded-xl border border-white/10 bg-white/5 px-6 py-2.5 font-display text-sm font-semibold text-foam transition-all hover:bg-white/10"
            >
              Create Another
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Creation form
  return (
    <div className="min-h-screen py-8 px-4">
      <div className="mx-auto max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", damping: 20, stiffness: 80 }}
        >
          <h1 className="font-display text-3xl md:text-4xl font-bold text-foam mb-2">
            Squad Pool
          </h1>
          <p className="font-body text-gray-400 mb-8">
            Private pool for your squad. Invite only. See who's in before you commit.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Config */}
          <div className="lg:col-span-2 space-y-6">
            {/* Squad name */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <label className="font-body text-xs uppercase tracking-wider text-gray-400 mb-2 block">Squad Name</label>
              <input
                type="text"
                value={squadName}
                onChange={(e) => setSquadName(e.target.value)}
                placeholder="e.g. Alpha Traders, BTC Bulls, etc."
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 font-display text-lg text-foam outline-none transition-colors focus:border-teal focus:ring-1 focus:ring-teal placeholder:text-gray-600"
              />
            </motion.div>

            {/* Asset picker */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <label className="font-body text-xs uppercase tracking-wider text-gray-400 mb-2 block">Asset</label>
              <div className="grid grid-cols-2 gap-3">
                {availableAssets.map((a) => (
                  <button
                    key={a}
                    onClick={() => setSelectedAsset(a)}
                    className={`min-h-[44px] flex items-center justify-center gap-3 rounded-xl border p-4 font-display text-sm font-bold transition-all duration-200 cursor-pointer ${
                      selectedAsset === a
                        ? "border-teal bg-teal/10 text-foam glow-teal"
                        : "border-white/10 bg-white/[0.03] text-gray-300 hover:border-white/20 hover:bg-white/5"
                    }`}
                  >
                    <AssetIcon asset={a} className="h-5 w-5" />
                    <span>{a}</span>
                  </button>
                ))}
              </div>
            </motion.div>

            {/* Interval picker */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <label className="font-body text-xs uppercase tracking-wider text-gray-400 mb-2 block">Interval</label>
              <div className="flex rounded-xl border border-white/10 bg-white/[0.03] p-1">
                {availableIntervals.map((iv) => (
                  <button
                    key={iv}
                    onClick={() => setSelectedInterval(iv)}
                    className={`flex-1 min-h-[44px] rounded-lg font-display text-sm font-semibold transition-all duration-200 cursor-pointer ${
                      selectedInterval === iv
                        ? "bg-teal text-carbon"
                        : "text-gray-400 hover:text-foam"
                    }`}
                  >
                    {iv}
                  </button>
                ))}
              </div>
            </motion.div>

            {/* Market info */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
              <div className="glass rounded-xl p-4 border-l-2 border-teal">
                {marketLoading ? (
                  <p className="font-body text-[10px] text-gray-500">Loading market from DreamDEX...</p>
                ) : selectedMarket ? (
                  <>
                    <p className="font-body text-sm text-foam">
                      Will {selectedAsset} close above ${selectedMarket.openingPrice?.toLocaleString("en-US", { minimumFractionDigits: 2 }) ?? "—"}?
                    </p>
                    <p className="font-body text-[10px] text-gray-500 mt-1">
                      Market: {selectedMarket.marketAddress.slice(0, 8)}...{selectedMarket.marketAddress.slice(-4)} · Expires: {new Date(selectedMarket.expiry * 1000).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "UTC", hour12: false })} UTC
                    </p>
                  </>
                ) : (
                  <p className="font-body text-[10px] text-down">No active market for {selectedAsset} {selectedInterval}.</p>
                )}
              </div>
            </motion.div>

            {/* Side picker */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <label className="font-body text-xs uppercase tracking-wider text-gray-400 mb-2 block">Pick a Side</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setSelectedSide("UP")}
                  className={`min-h-[56px] flex items-center justify-center gap-2 rounded-xl border p-4 font-display text-base font-bold transition-all duration-200 cursor-pointer ${
                    selectedSide === "UP"
                      ? "border-up bg-up/10 text-up shadow-lg shadow-up/10"
                      : "border-white/10 bg-white/[0.03] text-gray-300 hover:border-up/30"
                  }`}
                >
                  <span className="text-xl">▲</span>
                  <span>Up</span>
                </button>
                <button
                  onClick={() => setSelectedSide("DOWN")}
                  className={`min-h-[56px] flex items-center justify-center gap-2 rounded-xl border p-4 font-display text-base font-bold transition-all duration-200 cursor-pointer ${
                    selectedSide === "DOWN"
                      ? "border-down bg-down/10 text-down shadow-lg shadow-down/10"
                      : "border-white/10 bg-white/[0.03] text-gray-300 hover:border-down/30"
                  }`}
                >
                  <span className="text-xl">▼</span>
                  <span>Down</span>
                </button>
              </div>
            </motion.div>

            {/* Deposit input */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
              <label className="font-body text-xs uppercase tracking-wider text-gray-400 mb-2 block">Your Stake</label>
              <div className="relative">
                <input
                  type="number"
                  min={0.1}
                  max={100}
                  step={0.1}
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 pr-16 font-display text-lg text-foam outline-none transition-colors focus:border-teal focus:ring-1 focus:ring-teal"
                  placeholder="0.5"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-body text-sm text-gray-400">STT</span>
              </div>
            </motion.div>
          </div>

          {/* Right: Summary panel */}
          <div className="lg:col-span-1">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: "spring", damping: 20, stiffness: 80, delay: 0.3 }}
              className="sticky top-24 glass rounded-2xl p-5 border border-teal/20 space-y-5"
            >
              <h3 className="font-display text-lg font-bold text-foam">Squad Summary</h3>

              <div className="space-y-3">
                <SummaryRow label="Squad" value={squadName || "Unnamed"} />
                <SummaryRow label="Market" value={`${selectedAsset} ${selectedInterval}`} />
                <SummaryRow label="Your Side" value={selectedSide === "UP" ? "▲ Up" : "▼ Down"} accent={selectedSide === "UP" ? "text-up" : "text-down"} />
                <SummaryRow label="Your Stake" value={`${depositAmount} STT`} accent="text-foam" />
                <SummaryRow label="Payout" value="Proportional" accent="text-teal" />
                <SummaryRow label="Fee" value="2.5%" />
                <SummaryRow label="Visibility" value="Private (invite only)" />
              </div>

              {error && (
                <p className="font-body text-xs text-down text-center">{error}</p>
              )}

              <button
                disabled={!selectedMarket || !isConnected || poolState === "creating"}
                onClick={handleCreatePool}
                className={`min-h-[48px] w-full rounded-xl font-display text-base font-bold transition-all duration-200 cursor-pointer ${
                  selectedMarket && isConnected && poolState !== "creating"
                    ? "bg-foam text-carbon hover:bg-foam-dark hover:shadow-lg hover:shadow-foam/20 active:scale-[0.97]"
                    : "bg-white/10 text-gray-500 cursor-not-allowed"
                }`}
              >
                {poolState === "creating" ? "Creating..." : !isConnected ? "Connect Wallet" : !selectedMarket ? "No Market" : "Create Squad Pool"}
              </button>

              <p className="font-body text-[11px] text-gray-500 text-center leading-relaxed">
                Your squad pool will be private. Share the invite link with your group — only people with the link can see and join.
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-body text-xs text-gray-400">{label}</span>
      <span className={`font-display text-sm font-semibold ${accent || "text-foam"}`}>{value}</span>
    </div>
  );
}
