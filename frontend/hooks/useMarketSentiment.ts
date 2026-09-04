"use client";

import { useState, useEffect, useCallback } from "react";
import type { Address } from "viem";
import { fetchMarketSentiment, type MarketSentiment } from "@/lib/orderbook";

export function useMarketSentiment(marketAddress: Address | undefined) {
  const [sentiment, setSentiment] = useState<MarketSentiment | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!marketAddress) {
      setIsLoading(false);
      return;
    }
    try {
      const data = await fetchMarketSentiment(marketAddress);
      setSentiment(data);
    } catch {
      // keep previous
    } finally {
      setIsLoading(false);
    }
  }, [marketAddress]);

  useEffect(() => {
    fetch();
    const id = setInterval(fetch, 15000);
    return () => clearInterval(id);
  }, [fetch]);

  return { sentiment, isLoading };
}
