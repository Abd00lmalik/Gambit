"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  CandlestickSeries,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type CandlestickData,
  type UTCTimestamp,
} from "lightweight-charts";

// ── Data source ────────────────────────────────────────────────
// The already-established DreamDEX prod oracle price feed — the same GraphQL
// endpoint + units convention (/1e18) that lib/dreamdex.ts uses to compute
// opening prices, so the chart, the strike and the resolution all read from
// one coherent source. We pull the LATEST tick rows (descending) and bucket
// them into 1-minute candles; the previous version requested `order_by asc`
// with a limit, which returned the OLDEST 200 rows in the table.
const PRICE_FEED_URL = "https://price-feed.prd.oracle.somnia.host/v1/graphql";
const TICK_LIMIT = 1000;
const MAX_CANDLES = 480;
const POLL_MS = 5000;

interface LiveChartProps {
  asset: string;
  strike: number;
  currentPrice?: number;
  showOverlay?: boolean;
  compact?: boolean;
}

function feedIdFor(asset: string): string {
  return asset === "ETH" ? "ETH/USDC" : "BTC/USDC";
}

type Candle = CandlestickData<UTCTimestamp>;

async function fetchTicks(feedId: string, newestFirst: boolean, limit: number): Promise<{ spot: string; blockTimestamp: string }[]> {
  const query = `{
    PricePoint(
      limit: ${limit},
      order_by: {blockTimestamp: ${newestFirst ? "desc" : "asc"}},
      where: {feed_id: {_eq: "${feedId}"}}
    ) { spot blockTimestamp }
  }`;
  const res = await fetch(PRICE_FEED_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`price feed HTTP ${res.status}`);
  const data = await res.json();
  return data?.data?.PricePoint ?? [];
}

/** Bucket raw oracle ticks (assumed newest-first) into ascending 1-minute candles. */
function bucketCandles(ticks: { spot: string; blockTimestamp: string }[]): Candle[] {
  const candles = new Map<number, Candle>();
  // iterate oldest → newest
  const ordered = [...ticks].sort((a, b) => Number(a.blockTimestamp) - Number(b.blockTimestamp));
  for (const t of ordered) {
    const price = Number(t.spot) / 1e18;
    const tsSec = Math.floor(Number(t.blockTimestamp));
    if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(tsSec) || tsSec <= 0) continue;
    const minute = (Math.floor(tsSec / 60) * 60) as UTCTimestamp;
    const existing = candles.get(minute);
    if (existing) {
      existing.high = Math.max(existing.high, price);
      existing.low = Math.min(existing.low, price);
      existing.close = price;
    } else {
      candles.set(minute, { time: minute, open: price, high: price, low: price, close: price });
    }
  }
  const arr = Array.from(candles.values()).sort((a, b) => (a.time as number) - (b.time as number));
  return arr.slice(-MAX_CANDLES);
}

export default function LiveChart({ asset, strike, currentPrice, showOverlay = true, compact = false }: LiveChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const priceLineRef = useRef<IPriceLine | null>(null);
  const lastCandleRef = useRef<Candle | null>(null);
  const [hasData, setHasData] = useState(false);

  // ── Chart lifecycle ──────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: "rgba(30, 37, 38, 1)" },
        textColor: "rgba(255, 255, 255, 0.5)",
        fontFamily: "inherit",
      },
      grid: {
        vertLines: { color: "rgba(255, 255, 255, 0.04)" },
        horzLines: { color: "rgba(255, 255, 255, 0.04)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "rgba(255,255,255,0.2)", width: 1, style: 0, labelBackgroundColor: "#1e2526" },
        horzLine: { color: "rgba(255,255,255,0.2)", width: 1, style: 0, labelBackgroundColor: "#1e2526" },
      },
      rightPriceScale: { borderColor: "rgba(255, 255, 255, 0.1)" },
      timeScale: {
        borderColor: "rgba(255, 255, 255, 0.1)",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 4,
      },
      handleScroll: { vertTouchDrag: false },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderDownColor: "#ef4444",
      borderUpColor: "#22c55e",
      wickDownColor: "#ef4444",
      wickUpColor: "#22c55e",
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight });
      }
    };
    const ro = new ResizeObserver(handleResize);
    ro.observe(el);
    handleResize();

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      priceLineRef.current = null;
      lastCandleRef.current = null;
    };
  }, []);

  // ── History load (once per asset) ────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ticks = await fetchTicks(feedIdFor(asset), true, TICK_LIMIT);
        if (cancelled) return;
        const candles = bucketCandles(ticks);
        if (candles.length === 0) return; // polling will seed the chart instead
        const series = seriesRef.current;
        if (!series) return;
        series.setData(candles);
        lastCandleRef.current = candles[candles.length - 1];
        chartRef.current?.timeScale().fitContent();
        setHasData(true);
      } catch {
        // feed unreachable — live polling below still drives the chart
      }
    })();
    return () => { cancelled = true; };
  }, [asset]);

  // ── Live ticks (5s poll, appends/updates the current minute) ──
  const currentPriceRef = useRef<number | undefined>(currentPrice);
  currentPriceRef.current = currentPrice;

  useEffect(() => {
    let cancelled = false;
    const applyTick = (price: number, tsSec: number) => {
      const series = seriesRef.current;
      if (!series || !(price > 0)) return;
      const minute = (Math.floor(tsSec / 60) * 60) as UTCTimestamp;
      const last = lastCandleRef.current;
      if (last && (last.time as number) === minute) {
        last.high = Math.max(last.high, price);
        last.low = Math.min(last.low, price);
        last.close = price;
        series.update(last);
      } else if (!last || minute > (last.time as number)) {
        const next: Candle = { time: minute, open: price, high: price, low: price, close: price };
        series.update(next);
        lastCandleRef.current = next;
      }
      setHasData(true);
    };

    const poll = async () => {
      if (cancelled) return;
      try {
        const rows = await fetchTicks(feedIdFor(asset), true, 1);
        const pp = rows[0];
        if (pp) applyTick(Number(pp.spot) / 1e18, Math.floor(Number(pp.blockTimestamp)) || Math.floor(Date.now() / 1000));
      } catch {
        // feed hiccup — fall back to the app-wide live price so the chart keeps ticking
        const fallback = currentPriceRef.current;
        if (typeof fallback === "number" && fallback > 0) {
          applyTick(fallback, Math.floor(Date.now() / 1000));
        }
      }
    };

    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [asset]);

  // ── Strike line — pixel-accurate by construction ─────────────
  // Drawn via the series' price-scale API: it maps the price itself, not a
  // CSS percentage of the container, so it tracks through pan/zoom/resize.
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    if (priceLineRef.current) {
      series.removePriceLine(priceLineRef.current);
      priceLineRef.current = null;
    }
    if (!Number.isFinite(strike) || strike <= 0) return;

    priceLineRef.current = series.createPriceLine({
      price: strike,
      color: "rgba(255, 255, 255, 0.9)",
      lineWidth: 1,
      lineStyle: 2, // dashed
      axisLabelVisible: true,
      title: "Strike",
    });

    return () => {
      if (priceLineRef.current) {
        try { series.removePriceLine(priceLineRef.current); } catch {}
        priceLineRef.current = null;
      }
    };
  }, [strike]);

  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-white/10 bg-carbon">
      <div ref={containerRef} className={`w-full ${compact ? "h-[200px]" : "h-[350px]"}`} />
      {!hasData && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
          <span className="font-body text-xs text-gray-500 animate-pulse">Loading price feed…</span>
        </div>
      )}
      {showOverlay && (
        <div className="absolute top-0 right-0 bottom-0 w-1/4 bg-gradient-to-l from-white/5 to-transparent pointer-events-none z-10">
          <span className="absolute top-2 right-2 font-body text-[10px] text-white/50 uppercase tracking-wider">
            Resolution
          </span>
        </div>
      )}
    </div>
  );
}
