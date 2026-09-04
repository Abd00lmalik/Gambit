"use client";

import { useState, useEffect, useCallback } from "react";
import { type Asset, type LivePrice } from "@/lib/types";
import { fetchLatestIndexPrices } from "@/lib/dreamdex";

const FALLBACK_PRICES: Record<Asset, { price: number; change24h: number; changePercent: number }> = {
  BTC: { price: 78665.63, change24h: -215.3, changePercent: -0.27 },
  ETH: { price: 3245.18, change24h: 42.18, changePercent: 1.32 },
};

export function useLivePrices() {
  const [prices, setPrices] = useState<LivePrice[]>([
    { asset: "BTC", ...FALLBACK_PRICES.BTC, upProbability: 0.46 },
    { asset: "ETH", ...FALLBACK_PRICES.ETH, upProbability: 0.58 },
  ]);

  const fetchPrices = useCallback(async () => {
    try {
      const realPrices = await fetchLatestIndexPrices();
      if (Object.keys(realPrices).length === 0) return;

      setPrices((prev) =>
        prev.map((p) => {
          const realPrice = realPrices[p.asset];
          if (!realPrice) return p;

          const prevPrice = p.price;
          const diff = realPrice - prevPrice;
          const base = FALLBACK_PRICES[p.asset].price;
          const change24h = realPrice - base;
          const changePercent = (change24h / base) * 100;

          const priceMove = prevPrice !== 0 ? (realPrice - prevPrice) / prevPrice : 0;
          const newUpProb = Math.max(0.05, Math.min(0.95, p.upProbability + priceMove * 50));

          return {
            ...p,
            price: realPrice,
            change24h,
            changePercent,
            upProbability: newUpProb,
          };
        })
      );
    } catch (e) {
      console.warn("Failed to fetch real prices, keeping current:", e);
    }
  }, []);

  useEffect(() => {
    fetchPrices();
    const interval = setInterval(fetchPrices, 5000);
    return () => clearInterval(interval);
  }, [fetchPrices]);

  return prices;
}
