"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { Address } from "viem";
import { fetchMarketSentiment, type MarketSentiment } from "@/lib/orderbook";

interface MarketSentimentBarProps {
  marketAddress: Address;
  refreshInterval?: number;
}

export default function MarketSentimentBar({
  marketAddress,
  refreshInterval = 3000,
}: MarketSentimentBarProps) {
  const [sentiment, setSentiment] = useState<MarketSentiment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const data = await fetchMarketSentiment(marketAddress);
        if (!cancelled) {
          setSentiment(data);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    const interval = setInterval(load, refreshInterval);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [marketAddress, refreshInterval]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
        <div className="h-3 w-3 rounded-full bg-gray-500 animate-pulse" />
        <span className="font-body text-xs text-gray-400">Loading market sentiment...</span>
      </div>
    );
  }

  if (!sentiment) {
    return null;
  }

  const isUpMajority = sentiment.upPercent > sentiment.downPercent;
  const sentimentLabel = isUpMajority ? "UP" : "DOWN";
  const sentimentPercent = isUpMajority ? sentiment.upPercent : sentiment.downPercent;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-lg border border-white/10 bg-white/[0.03] p-3"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-body text-[10px] text-gray-500 uppercase tracking-wider">
          DreamDEX Market Sentiment
        </span>
        <span className="font-mono text-[10px] text-gray-500">
          {sentiment.totalBidDepth.toFixed(0)} / {sentiment.totalAskDepth.toFixed(0)} depth
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="font-body text-xs text-up">▲ UP</span>
            <span className="font-mono text-xs font-bold text-up">
              {sentiment.upPercent}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-down/20 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${sentiment.upPercent}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="h-full rounded-full bg-up"
            />
          </div>
        </div>

        <div className="flex flex-col items-center">
          <span className="font-display text-lg font-bold text-foam">
            {sentimentPercent}%
          </span>
          <span className={`font-body text-[10px] font-medium ${
            isUpMajority ? "text-up" : "text-down"
          }`}>
            {sentimentLabel}
          </span>
        </div>

        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="font-body text-xs text-down">DOWN ▼</span>
            <span className="font-mono text-xs font-bold text-down">
              {sentiment.downPercent}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-up/20 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${sentiment.downPercent}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="h-full rounded-full bg-down ml-auto"
            />
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span className="font-body text-[10px] text-gray-500">
          Mid: {sentiment.midPrice.toFixed(4)} · Spread: {sentiment.spread.toFixed(4)}
        </span>
        <span className="font-body text-[10px] text-gray-500">
          From DreamDEX CLOB
        </span>
      </div>
    </motion.div>
  );
}
