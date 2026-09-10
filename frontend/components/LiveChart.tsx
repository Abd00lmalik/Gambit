"use client";

import { useEffect, useRef } from "react";
import { createChart, ColorType, CrosshairMode, CandlestickSeries, type IChartApi, type ISeriesApi, type UTCTimestamp } from "lightweight-charts";

interface LiveChartProps {
  asset: string;
  strike: number;
  currentPrice?: number;
  showOverlay?: boolean;
  compact?: boolean;
}

// P2 (chart density): pick a candle bucket that yields trading-view-style
// density from the available price points (~60-150 candles on screen).
function bucketSizeFor(points: any[]): number {
  if (!points || points.length < 2) return 60;
  const span = Number(points[points.length - 1].blockTimestamp) - Number(points[0].blockTimestamp);
  if (span <= 15 * 60) return 10; // dense feed, short window → 10s candles
  if (span <= 45 * 60) return 30; // → 30s candles
  return 60;                       // → 1m candles (2h window ≈ 120 candles)
}

export default function LiveChart({ asset, strike, showOverlay = true, compact = false }: LiveChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const priceLineRef = useRef<any>(null);
  const bucketSecRef = useRef<number>(60);

  // Initialize chart
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
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
      rightPriceScale: {
        borderColor: "rgba(255, 255, 255, 0.1)",
      },
      timeScale: {
        borderColor: "rgba(255, 255, 255, 0.1)",
        timeVisible: true,
        secondsVisible: false,
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
        chart.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    const ro = new ResizeObserver(handleResize);
    ro.observe(containerRef.current);
    handleResize();

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      priceLineRef.current = null;
    };
  }, []);

  // Fetch OHLC data from DreamDEX price feed
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    let cancelled = false;
    (async () => {
      try {
        const feedId = asset === "BTC" ? "BTC/USDC" : "ETH/USDC";
        // P2 (chart density): fetch a proper window (2h) instead of the last 200
        // ticks (~3-4 minutes), so minute-bucketed candles render at a standard
        // trading-view density (~120 candles) instead of 3-4 sparse ones.
        const since = Math.floor(Date.now() / 1000) - 2 * 60 * 60;
        const buildQuery = (limit: number) => `{
          PricePoint(
            limit: ${limit},
            order_by: {blockTimestamp: asc},
            where: {feed_id: {_eq: "${feedId}"}, blockTimestamp: {_gte: ${since}}}
          ) { spot blockTimestamp }
        }`;

        let points: any[] = [];
        for (const limit of [2000, 500, 200]) {
          const res = await fetch("https://price-feed.prd.oracle.somnia.host/v1/graphql", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: buildQuery(limit) }),
          });
          const data = await res.json();
          if (data?.errors) continue; // row cap — retry smaller
          points = data?.data?.PricePoint || [];
          if (points.length > 0) break;
        }
        if (cancelled || points.length === 0) return;

        const bucketSec = bucketSizeFor(points);
        bucketSecRef.current = bucketSec;

        const candles = new Map<number, { open: number; high: number; low: number; close: number; time: UTCTimestamp }>();
        for (const p of points) {
          const price = Number(p.spot) / 1e18;
          if (price <= 0) continue;
          const ts = Math.floor(Number(p.blockTimestamp));
          const key = Math.floor(ts / bucketSec) * bucketSec;
          const existing = candles.get(key);
          if (existing) {
            existing.high = Math.max(existing.high, price);
            existing.low = Math.min(existing.low, price);
            existing.close = price;
          } else {
            candles.set(key, {
              open: price,
              high: price,
              low: price,
              close: price,
              time: key as UTCTimestamp,
            });
          }
        }

        const candleData = Array.from(candles.values()).sort((a, b) => (a.time as number) - (b.time as number));
        if (candleData.length > 0 && !cancelled) {
          series.setData(candleData);
          chartRef.current?.timeScale().fitContent();
        }
      } catch {}
    })();

    return () => { cancelled = true; };
  }, [asset]);

  // Strike price line — pixel-accurate via lightweight-charts API
  useEffect(() => {
    const series = seriesRef.current;
    if (!series || !showOverlay || !strike || strike === 0) return;

    // Remove old price line
    if (priceLineRef.current) {
      series.removePriceLine(priceLineRef.current);
      priceLineRef.current = null;
    }

    // Add new price line at exact strike price
    const line = series.createPriceLine({
      price: strike,
      color: "#ffffff",
      lineWidth: 1,
      lineStyle: 2, // Dashed
      axisLabelVisible: true,
      title: "Strike",
    });
    priceLineRef.current = line;

    return () => {
      if (priceLineRef.current) {
        series.removePriceLine(priceLineRef.current);
        priceLineRef.current = null;
      }
    };
  }, [strike, showOverlay]);

  // Real-time price polling (every 5s)
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    let cancelled = false;
    const interval = setInterval(async () => {
      if (cancelled) return;
      try {
        const feedId = asset === "BTC" ? "BTC/USDC" : "ETH/USDC";
        const query = `{
          PricePoint(
            limit: 1,
            order_by: {blockTimestamp: desc},
            where: {feed_id: {_eq: "${feedId}"}}
          ) { spot blockTimestamp }
        }`;
        const res = await fetch("https://price-feed.prd.oracle.somnia.host/v1/graphql", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
        });
        const data = await res.json();
        const pp = data?.data?.PricePoint?.[0];
        if (!pp?.spot) return;
        const price = Number(pp.spot) / 1e18;
        const ts = Math.floor(Number(pp.blockTimestamp));
        const bucket = bucketSecRef.current || 60;
        const candleKey = Math.floor(ts / bucket) * bucket as UTCTimestamp;

        const lastCandle = series.data()?.[series.data().length - 1] as any;
        if (lastCandle?.time === candleKey) {
          series.update({
            time: candleKey,
            open: lastCandle.open ?? price,
            high: Math.max(lastCandle.high ?? price, price),
            low: Math.min(lastCandle.low ?? price, price),
            close: price,
          });
        } else if ((candleKey as number) > (lastCandle?.time ?? 0)) {
          series.update({ time: candleKey, open: price, high: price, low: price, close: price });
        }
      } catch {}
    }, 5000);

    return () => { cancelled = true; clearInterval(interval); };
  }, [asset]);

  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-white/10 bg-carbon">
      <div
        ref={containerRef}
        className={`w-full ${compact ? "h-[200px]" : "h-[350px]"}`}
      />
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
