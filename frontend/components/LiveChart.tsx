"use client";

import { useEffect, useRef } from "react";
import { createChart, ColorType, CrosshairMode, CandlestickSeries, type IChartApi, type ISeriesApi, type UTCTimestamp } from "lightweight-charts";
import {
  bucketSizeFor,
  bucketKey,
  buildCandles,
  feedIdFor,
  fetchWindowPoints,
  tailQuery,
  FEED_URL,
  type Candle,
} from "@/lib/chartData";

interface LiveChartProps {
  asset: string;
  strike: number;
  currentPrice?: number;
  showOverlay?: boolean;
  compact?: boolean;
}

export default function LiveChart({ asset, strike, showOverlay = true, compact = false }: LiveChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const priceLineRef = useRef<any>(null);
  const bucketSecRef = useRef<number>(60);
  // Newest bucket rendered by setData — realtime points at/after this continue
  // the current candle; anything older is already-rendered history.
  const newestBucketRef = useRef<number>(0);

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

  // Fetch the full lookback window (paged) and render OHLC candles
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    let cancelled = false;
    (async () => {
      try {
        const nowSec = Math.floor(Date.now() / 1000);
        const points = await fetchWindowPoints(asset, nowSec);
        if (cancelled || points.length === 0) return;

        const bucketSec = bucketSizeFor(points);
        bucketSecRef.current = bucketSec;
        const candleData = buildCandles(points, bucketSec);
        if (candleData.length === 0 || cancelled) return;

        newestBucketRef.current = candleData[candleData.length - 1].time;
        series.setData(candleData as any);
        chartRef.current?.timeScale().fitContent();
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

  // Realtime updates — fetch every point since the newest rendered bucket and
  // continue that bucket's candle. Points before it are already-rendered
  // history and are ignored, so the current candle never gets repainted from
  // stale data and a rollover always opens at the first new price.
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    let cancelled = false;
    const interval = setInterval(async () => {
      if (cancelled) return;
      try {
        const feedId = feedIdFor(asset);
        const res = await fetch(FEED_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: tailQuery(feedId, newestBucketRef.current) }),
        });
        const data = await res.json();
        if (data?.errors) return;
        const points = data?.data?.PricePoint || [];
        if (points.length === 0) return;

        const bucket = bucketSecRef.current || 60;
        const current = bucketKey(Math.floor(Date.now() / 1000), bucket);

        const candles: Candle[] = buildCandles(points, bucket);
        for (const c of candles) {
          if ((c.time as number) < newestBucketRef.current) continue; // history
          if ((c.time as number) > current) continue; // future-skewed timestamp
          if ((c.time as number) === newestBucketRef.current) {
            // Merge into the rendered current candle (keep its open).
            const rendered = series.data() as any[];
            const last = rendered[rendered.length - 1];
            series.update({
              time: c.time as UTCTimestamp,
              open: last?.time === c.time ? last.open : c.open,
              high: Math.max(last?.time === c.time ? last.high : -Infinity, c.high),
              low: Math.min(last?.time === c.time ? last.low : Infinity, c.low),
              close: c.close,
            });
          } else {
            // A gap-free rollover: newestBucket advanced — open at first price.
            series.update({ time: c.time as UTCTimestamp, open: c.open, high: c.high, low: c.low, close: c.close });
            newestBucketRef.current = c.time as number;
          }
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
