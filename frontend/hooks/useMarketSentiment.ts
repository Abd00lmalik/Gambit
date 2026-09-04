"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Address } from "viem";
import { fetchMarketSentiment, type MarketSentiment } from "@/lib/orderbook";

export function useMarketSentiment(marketAddress: Address | undefined) {
  const [sentiment, setSentiment] = useState<MarketSentiment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const prevAddress = useRef<string>("");

  const fetchNow = useCallback(async () => {
    if (!marketAddress) {
      setSentiment(null);
      setIsLoading(false);
      return;
    }
    try {
      const data = await fetchMarketSentiment(marketAddress);
      if (data) setSentiment(data);
    } catch {
      // keep previous
    } finally {
      setIsLoading(false);
    }
  }, [marketAddress]);

  useEffect(() => {
    if (marketAddress !== prevAddress.current) {
      prevAddress.current = marketAddress ?? "";
      setIsLoading(true);
    }
    fetchNow();
    const id = setInterval(fetchNow, 3000);
    return () => clearInterval(id);
  }, [fetchNow, marketAddress]);

  return { sentiment, isLoading, refetch: fetchNow };
}
