"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { useAccount } from "wagmi";
import { useLivePrices } from "@/hooks/useLivePrices";
import { useIntervalTimer } from "@/hooks/useMarkets";
import { useDuelFactory } from "@/hooks/useContracts";
import CountdownTimer from "@/components/CountdownTimer";
import MarketSentimentBar from "@/components/MarketSentimentBar";
import { ASSET_INFO, STAKE_OPTIONS } from "@/lib/constants";
import {
  fetchMarketsByInterval,
  verifyMarketAddress,
  type DreamDexMarket,
} from "@/lib/dreamdex";
import AssetIcon from "@/components/AssetIcon";

const LiveChart = dynamic(() => import("@/components/LiveChart"), { ssr: false });

const INTERVAL_SEC: Record<string, number> = {
  "5m": 300,
  "15m": 900,
  "1h": 3600,
};

const AVAILABLE_INTERVALS = ["5m", "15m", "1h"] as const;

type CreationMode = "duel" | "squad";

export default function CreateDuelPage() {
  const { isConnected } = useAccount();
  const prices = useLivePrices();
  const [mode, setMode] = useState<CreationMode | null>(null);
  const [asset, setAsset] = useState<"BTC" | "ETH">("BTC");
  const [selectedInterval, setSelectedInterval] = useState<string>("15m");
  const [side, setSide] = useState<"UP" | "DOWN">("UP");
  const [stake, setStake] = useState<number>(0.5);
  const [customStake, setCustomStake] = useState("");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedMarket, setSelectedMarket] = useState<DreamDexMarket | null>(null);
  const [marketLoading, setMarketLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const { createDuel, isPending } = useDuelFactory();
  const timer = useIntervalTimer(selectedInterval);

  // Fetch selected market from DreamDEX — only when asset or interval changes
  useEffect(() => {
    let cancelled = false;
    setMarketLoading(true);
    setSelectedMarket(null);

    const intervalSec = INTERVAL_SEC[selectedInterval] ?? 900;
    fetchMarketsByInterval(asset, intervalSec, 1)
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
  }, [asset, selectedInterval]);

  const currentPrice = prices.find((p) => p.asset === asset);
  const strike = currentPrice?.price ?? 0;
  const upProb = currentPrice?.upProbability ?? 0.5;
  const joinDeadline = Math.floor(Date.now() / 1000) + timer.secondsLeft;

  const stakeAmount = customStake ? parseFloat(customStake) || 0 : stake;
  const isValid = stakeAmount >= 0.1 && stakeAmount <= 100 && isConnected && !!selectedMarket;

  const marketQuestion = useMemo(() => {
    const expiryTime = selectedMarket
      ? new Date(selectedMarket.expiry * 1000).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "UTC",
          hour12: false,
        })
      : new Date(Date.now() + timer.secondsLeft * 1000).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "UTC",
          hour12: false,
        });

    const strikePrice = selectedMarket?.openingPrice ?? strike;
    return `Will ${asset} settle above $${strikePrice.toLocaleString("en-US", { minimumFractionDigits: 2 })} at ${expiryTime} UTC?`;
  }, [asset, strike, timer.secondsLeft, selectedMarket]);

  const handleCreate = useCallback(async () => {
    if (!isValid || !selectedMarket) return;
    setError(null);
    setVerifying(true);
    try {
      const verification = await verifyMarketAddress(selectedMarket.marketAddress);
      if (!verification.valid) {
        setError(verification.error || "Market verification failed");
        setVerifying(false);
        return;
      }

      const marketAddress = selectedMarket.marketAddress;
      const deadline = INTERVAL_SEC[selectedInterval];
      const hash = await createDuel(marketAddress, deadline, String(stakeAmount));
      setTxHash(hash);
    } catch (e: any) {
      setError(e?.message?.includes("User rejected") ? "Transaction rejected" : "Failed to create duel");
    } finally {
      setVerifying(false);
    }
  }, [isValid, selectedMarket, selectedInterval, stakeAmount, createDuel]);

  // Mode selection screen
  if (!mode) {
    return (
      <div className="min-h-screen flex items-center justify-center py-8 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-lg w-full"
        >
          <h1 className="font-display text-3xl md:text-4xl font-bold text-foam mb-2 text-center">
            Create
          </h1>
          <p className="font-body text-gray-400 mb-8 text-center">
            Choose how you want to play.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => setMode("duel")}
              className="rounded-2xl border border-teal/30 bg-teal/5 p-6 text-left transition-all hover:border-teal/50 hover:bg-teal/10 cursor-pointer group"
            >
              <div className="h-12 w-12 rounded-xl bg-teal/15 flex items-center justify-center mb-4">
                <span className="text-2xl">⚔️</span>
              </div>
              <h3 className="font-display text-lg font-bold text-foam mb-1">1v1 Duel</h3>
              <p className="font-body text-sm text-gray-400">
                Challenge one opponent. Equal stakes. Winner takes all.
              </p>
            </button>

            <button
              onClick={() => setMode("squad")}
              className="rounded-2xl border border-purple-500/30 bg-purple-500/5 p-6 text-left transition-all hover:border-purple-500/50 hover:bg-purple-500/10 cursor-pointer group"
            >
              <div className="h-12 w-12 rounded-xl bg-purple-500/15 flex items-center justify-center mb-4">
                <span className="text-2xl">🎯</span>
              </div>
              <h3 className="font-display text-lg font-bold text-foam mb-1">Squad Pool</h3>
              <p className="font-body text-sm text-gray-400">
                Invite your squad. Multiple players per side. Proportional payout.
              </p>
            </button>
          </div>

          <p className="font-body text-xs text-gray-500 text-center mt-6">
            Both use DreamDEX Event Contracts with auto-settlement.
          </p>
        </motion.div>
      </div>
    );
  }

  // Success screen
  if (txHash) {
    const inviteLink = typeof window !== "undefined"
      ? `${window.location.origin}/arena?highlight=${txHash}`
      : "";

    return (
      <div className="min-h-screen flex items-center justify-center py-8 px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full text-center glass rounded-2xl p-8"
        >
          <div className="h-16 w-16 rounded-full bg-teal/15 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">{mode === "duel" ? "⚔️" : "🎯"}</span>
          </div>
          <h2 className="font-display text-2xl font-bold text-foam mb-2">
            {mode === "duel" ? "Duel Created!" : "Squad Pool Created!"}
          </h2>
          <p className="font-body text-sm text-gray-400 mb-4">
            {mode === "duel"
              ? "Your challenge is live. Share the invite or wait for someone in the Arena to accept."
              : "Your squad pool is live. Share the invite link with your group."}
          </p>

          <div className="rounded-xl border border-teal/30 bg-teal/5 p-3 mb-4">
            <p className="font-body text-[10px] text-gray-400 mb-1 uppercase tracking-wider">Invite Link</p>
            <div className="flex items-center gap-2">
              <code className="font-mono text-[11px] text-teal truncate flex-1">{inviteLink}</code>
              <button
                onClick={() => navigator.clipboard.writeText(inviteLink)}
                className="shrink-0 rounded-lg bg-teal/20 px-3 py-1.5 font-body text-[10px] font-medium text-teal hover:bg-teal/30 transition-colors"
              >
                Copy
              </button>
            </div>
          </div>

          <a
            href={`https://shannon-explorer.somnia.network/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[10px] text-gray-500 hover:text-teal transition-colors block mb-6"
          >
            Tx: {txHash.slice(0, 16)}...
          </a>
          <div className="flex gap-3 justify-center">
            <a
              href="/arena"
              className="rounded-xl bg-foam px-6 py-2.5 font-display text-sm font-bold text-carbon transition-all hover:bg-foam-dark"
            >
              View Arena
            </a>
            <button
              onClick={() => { setTxHash(null); setError(null); setMode(null); }}
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
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={() => setMode(null)}
              className="font-body text-sm text-gray-400 hover:text-foam transition-colors cursor-pointer"
            >
              ← Back
            </button>
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-foam mb-2">
            {mode === "duel" ? "Create a Duel" : "Create a Squad Pool"}
          </h1>
          <p className="font-body text-gray-400">
            {mode === "duel"
              ? "Pick your side. Set your stake. Challenge someone."
              : "Pick a side. Set your stake. Invite your squad."}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Asset picker — BTC and ETH only */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <label className="font-body text-xs uppercase tracking-wider text-gray-400 mb-2 block">Asset</label>
              <div className="grid grid-cols-2 gap-3">
                {(["BTC", "ETH"] as const).map((a) => {
                  const assetPrice = prices.find((p) => p.asset === a);
                  return (
                    <button
                      key={a}
                      onClick={() => setAsset(a)}
                      className={`min-h-[44px] flex items-center justify-center gap-3 rounded-xl border p-4 font-display text-sm font-bold transition-all duration-200 cursor-pointer ${
                        asset === a
                          ? "border-teal bg-teal/10 text-foam glow-teal"
                          : "border-white/10 bg-white/[0.03] text-gray-300 hover:border-white/20 hover:bg-white/5"
                      }`}
                    >
                      <AssetIcon asset={a} className="h-5 w-5" />
                      <span>{a}</span>
                      <span className="text-xs text-gray-400 font-normal">
                        ${assetPrice?.price.toLocaleString("en-US", { minimumFractionDigits: 2 }) ?? "—"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </motion.div>

            {/* Interval toggle — 5m, 15m, 1h */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <label className="font-body text-xs uppercase tracking-wider text-gray-400 mb-2 block">Interval</label>
              <div className="flex rounded-xl border border-white/10 bg-white/[0.03] p-1">
                {AVAILABLE_INTERVALS.map((iv) => (
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

            {/* Next window countdown */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
              <div className="glass rounded-xl p-3 border border-teal/20">
                <div className="flex items-center justify-between">
                  <span className="font-body text-xs text-gray-400">Next {selectedInterval} window opens in</span>
                  <span className="font-mono text-sm font-bold text-teal">{timer.formatted}</span>
                </div>
              </div>
            </motion.div>

            {/* Market info */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <div className="glass rounded-xl p-4 border-l-2 border-teal">
                <p className="font-body text-sm text-foam">{marketQuestion}</p>
                {selectedMarket && (
                  <p className="font-body text-[10px] text-gray-500 mt-1">
                    Market: {selectedMarket.marketAddress.slice(0, 8)}...{selectedMarket.marketAddress.slice(-4)} · Expiry: {new Date(selectedMarket.expiry * 1000).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "UTC", hour12: false })} UTC
                  </p>
                )}
                {marketLoading && (
                  <p className="font-body text-[10px] text-gray-500 mt-1">Loading market from DreamDEX...</p>
                )}
                {!marketLoading && !selectedMarket && (
                  <p className="font-body text-[10px] text-down mt-1">No active market found for {asset} {selectedInterval}.</p>
                )}
              </div>
            </motion.div>

            {/* Market Sentiment */}
            {selectedMarket && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}>
                <MarketSentimentBar marketAddress={selectedMarket.marketAddress} />
              </motion.div>
            )}

            {/* Live chart */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
              <LiveChart asset={asset} strike={strike} />
            </motion.div>

            {/* Side picker */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <label className="font-body text-xs uppercase tracking-wider text-gray-400 mb-2 block">Your Side</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setSide("UP")}
                  className={`min-h-[56px] flex items-center justify-center gap-2 rounded-xl border p-4 font-display text-base font-bold transition-all duration-200 cursor-pointer ${
                    side === "UP"
                      ? "border-up bg-up/10 text-up shadow-lg shadow-up/10"
                      : "border-white/10 bg-white/[0.03] text-gray-300 hover:border-up/30"
                  }`}
                >
                  <span className="text-xl">▲</span>
                  <span>Up {(upProb * 100).toFixed(0)}%</span>
                </button>
                <button
                  onClick={() => setSide("DOWN")}
                  className={`min-h-[56px] flex items-center justify-center gap-2 rounded-xl border p-4 font-display text-base font-bold transition-all duration-200 cursor-pointer ${
                    side === "DOWN"
                      ? "border-down bg-down/10 text-down shadow-lg shadow-down/10"
                      : "border-white/10 bg-white/[0.03] text-gray-300 hover:border-down/30"
                  }`}
                >
                  <span className="text-xl">▼</span>
                  <span>Down {((1 - upProb) * 100).toFixed(0)}%</span>
                </button>
              </div>
            </motion.div>

            {/* Stake input */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
              <label className="font-body text-xs uppercase tracking-wider text-gray-400 mb-2 block">Stake</label>
              <div className="relative">
                <input
                  type="number"
                  min={0.1}
                  max={100}
                  step={0.1}
                  value={customStake || stake}
                  onChange={(e) => setCustomStake(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 pr-16 font-display text-lg text-foam outline-none transition-colors focus:border-teal focus:ring-1 focus:ring-teal"
                  placeholder="0.5"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-body text-sm text-gray-400">STT</span>
              </div>
              <div className="flex gap-2 mt-2">
                {STAKE_OPTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => { setStake(s); setCustomStake(""); }}
                    className={`min-h-[36px] flex-1 rounded-lg border py-1.5 font-body text-xs font-medium transition-all duration-200 cursor-pointer ${
                      stake === s && !customStake
                        ? "border-teal bg-teal/10 text-teal"
                        : "border-white/10 text-gray-400 hover:border-white/20"
                    }`}
                  >
                    {s}
                  </button>
                ))}
                <button
                  onClick={() => setCustomStake("100")}
                  className={`min-h-[36px] flex-1 rounded-lg border py-1.5 font-body text-xs font-medium transition-all duration-200 cursor-pointer ${
                    customStake === "100"
                      ? "border-teal bg-teal/10 text-teal"
                      : "border-white/10 text-gray-400 hover:border-white/20"
                  }`}
                >
                  Max
                </button>
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
              <h3 className="font-display text-lg font-bold text-foam">
                {mode === "duel" ? "Duel Summary" : "Pool Summary"}
              </h3>

              <div className="space-y-3">
                <SummaryRow label="Asset" value={asset} />
                <SummaryRow label="Interval" value={selectedInterval} />
                <SummaryRow label="Your Side" value={side === "UP" ? "▲ Up" : "▼ Down"} accent={side === "UP" ? "text-up" : "text-down"} />
                <SummaryRow label="Opening Price" value={`$${(selectedMarket?.openingPrice ?? strike).toLocaleString("en-US", { minimumFractionDigits: 2 })}`} />
                <SummaryRow label="Stake" value={`${stakeAmount} STT`} accent="text-foam" />
                <div className="border-t border-white/10 pt-3">
                  <SummaryRow
                    label="Potential Payout"
                    value={mode === "duel"
                      ? `${(stakeAmount * 2 * 0.975).toFixed(3)} STT`
                      : "Proportional"}
                    accent="text-teal"
                  />
                </div>
              </div>

              {/* Join deadline countdown */}
              <div className="border-t border-white/10 pt-4">
                <p className="font-body text-xs text-gray-400 mb-2 text-center">Joins expire in</p>
                <CountdownTimer targetTimestamp={joinDeadline} size="sm" variant="join" />
              </div>

              {error && (
                <p className="font-body text-xs text-down text-center">{error}</p>
              )}

              {/* CTA */}
              <button
                disabled={!isValid || isPending || verifying}
                onClick={handleCreate}
                className={`min-h-[48px] w-full rounded-xl font-display text-base font-bold transition-all duration-200 cursor-pointer ${
                  isValid && !isPending
                    ? mode === "squad"
                      ? "bg-purple-500 text-white hover:bg-purple-600 hover:shadow-lg hover:shadow-purple-500/20 active:scale-[0.97]"
                      : "bg-foam text-carbon hover:bg-foam-dark hover:shadow-lg hover:shadow-foam/20 active:scale-[0.97]"
                    : "bg-white/10 text-gray-500 cursor-not-allowed"
                }`}
              >
                {isPending
                  ? "Creating..."
                  : verifying
                    ? "Verifying Market..."
                    : marketLoading
                      ? "Loading market..."
                      : !isConnected
                        ? "Connect Wallet First"
                        : !selectedMarket
                          ? "No Market Available"
                          : mode === "duel"
                            ? "Create Challenge →"
                            : "Create Squad Pool →"}
              </button>

              <p className="font-body text-[11px] text-gray-500 text-center leading-relaxed">
                {mode === "duel"
                  ? "Funds are held in an isolated contract until your opponent joins or the deadline passes. Cancel anytime before someone joins."
                  : "Create a pool for this market. Others can then join either side."}
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
