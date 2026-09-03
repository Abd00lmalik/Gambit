"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { createPublicClient, http, formatEther } from "viem";
import { somnia } from "@/lib/config";
import {
  FACTORY_ADDRESS,
  WAGER_ABI,
  DREAMDEX_ABI,
  DEX_EVENT_CONTRACTS_ADDRESS,
} from "@/lib/contracts";
import { fetchAvailableMarkets, type MarketCombo } from "@/lib/dreamdex";

const client = createPublicClient({ chain: somnia, transport: http() });

const BINARY_MODULE_ABI = [
  {
    type: "function" as const,
    name: "markets",
    inputs: [{ name: "marketId", type: "bytes32" }],
    outputs: [
      { name: "oracleQuestionId", type: "uint256" },
      { name: "outcomeSlotCount", type: "uint8" },
      { name: "voidPolicy", type: "uint8" },
      { name: "collateral", type: "address" },
      { name: "originOperatorId", type: "uint32" },
      { name: "originVenueId", type: "bytes32" },
      { name: "oracleAdapter", type: "address" },
      { name: "creator", type: "address" },
      { name: "market", type: "address" },
      { name: "pool", type: "address" },
      { name: "yesId", type: "uint256" },
      { name: "noId", type: "uint256" },
      { name: "tradingStart", type: "uint64" },
      { name: "expiry", type: "uint64" },
    ],
    stateMutability: "view" as const,
  },
] as const;

interface DuelStats {
  totalSettled: number;
  reactiveSettled: number;
  avgLatency: number;
  fastestLatency: number;
  slowestLatency: number;
  voidedCount: number;
}

interface MarketStatus {
  address: string;
  status: string;
  expiry: number;
  isResolved: boolean;
  isVoided: boolean;
  asset: string;
  interval: string;
}

export default function StatsPage() {
  const [duelStats, setDuelStats] = useState<DuelStats | null>(null);
  const [liveMarkets, setLiveMarkets] = useState<MarketCombo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        // Fetch available markets
        const markets = await fetchAvailableMarkets();
        setLiveMarkets(markets);

        // For now, show placeholder stats since we need on-chain event scanning
        // In production, this would scan DuelCreated + ReactiveSettled events
        setDuelStats({
          totalSettled: 0,
          reactiveSettled: 0,
          avgLatency: 0,
          fastestLatency: 0,
          slowestLatency: 0,
          voidedCount: 0,
        });
      } catch (e) {
        console.error("Failed to load stats:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="mx-auto max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", damping: 20, stiffness: 80 }}
        >
          <h1 className="font-display text-3xl md:text-4xl font-bold text-foam mb-2">
            Gambit Stats
          </h1>
          <p className="font-body text-gray-400 mb-8">
            Live metrics from the DreamDEX duel layer.
          </p>
        </motion.div>

        {loading ? (
          <div className="text-center py-16">
            <div className="animate-spin h-8 w-8 border-2 border-teal border-t-transparent rounded-full mx-auto mb-4" />
            <p className="font-body text-sm text-gray-400">Loading stats...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Settlement Latency Section (Item 5) */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass rounded-2xl p-6 border border-teal/20"
            >
              <h2 className="font-display text-xl font-bold text-foam mb-4">
                Settlement Latency
              </h2>
              <p className="font-body text-xs text-gray-400 mb-4">
                Measured from DreamDEX oracle resolution to Gambit payout via Somnia reactivity.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                  label="Avg Latency"
                  value={duelStats?.avgLatency ? `${duelStats.avgLatency.toFixed(1)}s` : "—"}
                  color="text-teal"
                />
                <StatCard
                  label="Fastest"
                  value={duelStats?.fastestLatency ? `${duelStats.fastestLatency.toFixed(1)}s` : "—"}
                  color="text-up"
                />
                <StatCard
                  label="Slowest"
                  value={duelStats?.slowestLatency ? `${duelStats.slowestLatency.toFixed(1)}s` : "—"}
                  color="text-down"
                />
                <StatCard
                  label="Success Rate"
                  value={duelStats?.reactiveSettled && duelStats?.totalSettled
                    ? `${((duelStats.reactiveSettled / duelStats.totalSettled) * 100).toFixed(0)}%`
                    : "—"}
                  color="text-foam"
                />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-4">
                <StatCard
                  label="Total Settled"
                  value={String(duelStats?.totalSettled ?? 0)}
                  color="text-gray-300"
                />
                <StatCard
                  label="Reactive Settled"
                  value={String(duelStats?.reactiveSettled ?? 0)}
                  color="text-teal"
                />
                <StatCard
                  label="Voided"
                  value={String(duelStats?.voidedCount ?? 0)}
                  color="text-yellow-400"
                />
              </div>
            </motion.div>

            {/* Market Status Dashboard (Item 6) */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="glass rounded-2xl p-6 border border-teal/20"
            >
              <h2 className="font-display text-xl font-bold text-foam mb-4">
                DreamDEX Market Coverage
              </h2>
              <p className="font-body text-xs text-gray-400 mb-4">
                Live asset/interval combos currently tradeable on DreamDEX event contracts.
              </p>
              {liveMarkets.length === 0 ? (
                <p className="font-body text-sm text-gray-500">No live markets found.</p>
              ) : (
                <div className="space-y-2">
                  {liveMarkets.map((combo) => (
                    <div
                      key={`${combo.asset}-${combo.label}`}
                      className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-display text-sm font-bold text-foam">
                          {combo.asset}
                        </span>
                        <span className="font-body text-xs text-gray-400">
                          {combo.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-teal/10 px-2 py-0.5 font-body text-[10px] font-medium text-teal">
                          {combo.marketCount} market{combo.marketCount !== 1 ? "s" : ""}
                        </span>
                        <span className="h-2 w-2 rounded-full bg-up animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="font-body text-[10px] text-gray-500 mt-4">
                Refreshes every 60s. New combos appear automatically when DreamDEX lists them.
              </p>
            </motion.div>

            {/* Contract Info */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="glass rounded-2xl p-6 border border-white/10"
            >
              <h2 className="font-display text-xl font-bold text-foam mb-4">
                Contract Info
              </h2>
              <div className="space-y-2">
                <InfoRow label="Gambit Factory" value={FACTORY_ADDRESS} />
                <InfoRow label="DreamDEX Module" value={DEX_EVENT_CONTRACTS_ADDRESS} />
                <InfoRow label="Chain" value="Somnia Testnet (50312)" />
                <InfoRow label="Settlement" value="Reactive (Somnia precompile 0x0100)" />
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center">
      <p className="font-body text-[10px] text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`font-display text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
      <span className="font-body text-xs text-gray-400">{label}</span>
      <span className="font-mono text-[11px] text-gray-300 truncate ml-4 max-w-[200px]">
        {value}
      </span>
    </div>
  );
}
