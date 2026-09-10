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

export default function LiveChart({ asset, strike, showOverlay = true, compact = false }: LiveChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const priceLineRef = useRef<any>(null);

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
        const query = `{
          PricePoint(
            limit: 200,
            order_by: {blockTimestamp: asc},
            where: {feed_id: {_eq: "${feedId}"}}
          ) { spot blockTimestamp }
        }`;
        const res = await fetch("https://price-feed.prd.oracle.somnia.host/v1/graphql", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
        });
        const data = await res.json();
        const points = data?.data?.PricePoint || [];
        if (cancelled || points.length === 0) return;

        // Build candle data from price points (group by minute)
        const candles = new Map<number, { open: number; high: number; low: number; close: number; time: UTCTimestamp }>();
        for (const p of points) {
          const price = Number(p.spot) / 1e18;
          if (price <= 0) continue;
          const ts = Math.floor(Number(p.blockTimestamp));
          const minuteKey = Math.floor(ts / 60) * 60;
          const existing = candles.get(minuteKey);
          if (existing) {
            existing.high = Math.max(existing.high, price);
            existing.low = Math.min(existing.low, price);
            existing.close = price;
          } else {
            candles.set(minuteKey, {
              open: price,
              high: price,
              low: price,
              close: price,
              time: minuteKey as UTCTimestamp,
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
        const minuteKey = Math.floor(ts / 60) * 60 as UTCTimestamp;

        const lastCandle = series.data()?.[series.data().length - 1] as any;
        if (lastCandle?.time === minuteKey) {
          series.update({
            time: minuteKey,
            open: lastCandle.open ?? price,
            high: Math.max(lastCandle.high ?? price, price),
            low: Math.min(lastCandle.low ?? price, price),
            close: price,
          });
        } else if ((minuteKey as number) > (lastCandle?.time ?? 0)) {
          series.update({ time: minuteKey, open: price, high: price, low: price, close: price });
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
