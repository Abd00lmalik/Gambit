"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Address } from "viem";
import { subscribeOrderBook, type WsProbabilityUpdate } from "@/lib/dreamdex-ws";
import type { MarketSentiment } from "@/lib/orderbook";

export function useMarketSentiment(marketAddress: Address | undefined) {
  const [sentiment, setSentiment] = useState<MarketSentiment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const prevAddress = useRef<string>("");

  useEffect(() => {
    if (!marketAddress) {
      setSentiment(null);
      setIsLoading(false);
      return;
    }

    if (marketAddress !== prevAddress.current) {
      prevAddress.current = marketAddress;
      setIsLoading(true);
    }

    const unsub = subscribeOrderBook(marketAddress, (update: WsProbabilityUpdate) => {
      setSentiment({
        upPercent: update.upPercent,
        downPercent: update.downPercent,
        totalBidDepth: 0,
        totalAskDepth: 0,
        midPrice: update.midPrice,
        spread: (update.bestAsk - update.bestBid) / 1_000_000,
      });
      setIsLoading(false);
    });

    return unsub;
  }, [marketAddress]);

  return { sentiment, isLoading };
}
