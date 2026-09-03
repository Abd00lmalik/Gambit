"use client";

import { useState, useEffect, useCallback } from "react";
import {
  fetchActiveBinaryMarkets,
  fetchMarketsByInterval,
  getTimeRemainingForInterval,
  type DreamDexMarket,
} from "@/lib/dreamdex";

export function useLiveMarkets() {
  const [markets, setMarkets] = useState<DreamDexMarket[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchActiveBinaryMarkets(30);
      setMarkets(data);
    } catch (e) {
      console.error("Failed to load markets:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
    const id = setInterval(fetch, 15000);
    return () => clearInterval(id);
  }, [fetch]);

  return { markets, isLoading, refetch: fetch };
}

export function useMarketForDuel(
  asset: string,
  intervalSec: number
) {
  const [market, setMarket] = useState<DreamDexMarket | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchMarketsByInterval(asset, intervalSec, 1);
      setMarket(data[0] ?? null);
    } catch (e) {
      console.error("Failed to load market:", e);
    } finally {
      setIsLoading(false);
    }
  }, [asset, intervalSec]);

  useEffect(() => {
    fetch();
    const id = setInterval(fetch, 15000);
    return () => clearInterval(id);
  }, [fetch]);

  return { market, isLoading, refetch: fetch };
}

const LABEL_TO_SEC: Record<string, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1h": 3600,
  "4h": 14400,
  "1d": 86400,
};

export function useIntervalTimer(interval: string) {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [nextBoundary, setNextBoundary] = useState(0);

  useEffect(() => {
    const update = () => {
      const intervalSec = LABEL_TO_SEC[interval] ?? 900;
      const { secondsLeft: sl, nextBoundary: nb } =
        getTimeRemainingForInterval(intervalSec);
      setSecondsLeft(sl);
      setNextBoundary(nb);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [interval]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");

  return { secondsLeft, nextBoundary, mm, ss, formatted: `${mm}:${ss}` };
}
