"use client";

import { useEffect, useRef, useMemo } from "react";

interface LiveChartProps {
  asset: string;
  strike: number;
  currentPrice?: number;
  showOverlay?: boolean;
  compact?: boolean;
}

export default function LiveChart({ asset, strike, currentPrice, showOverlay = true, compact = false }: LiveChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate strike line Y position based on price range
  // TradingView 1-min chart typically shows ~±1.5-2% around current price
  const strikeTopPct = useMemo(() => {
    if (!currentPrice || !strike || strike === 0 || currentPrice === 0) return null;
    const rangePct = 0.02; // ±2% — matches typical TradingView 1-min visible range
    const high = currentPrice * (1 + rangePct);
    const low = currentPrice * (1 - rangePct);
    if (strike >= high || strike <= low) return null; // out of range, don't render
    // Map strike to 0-100% (0% = top/high, 100% = bottom/low)
    return ((high - strike) / (high - low)) * 100;
  }, [strike, currentPrice]);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: asset === "BTC" ? "BTCUSD" : "ETHUSD",
      interval: "1",
      timezone: "Etc/UTC",
      theme: "dark",
      style: "1",
      backgroundColor: "rgba(30, 37, 38, 1)",
      gridColor: "rgba(255, 255, 255, 0.04)",
      hide_top_toolbar: true,
      hide_legend: true,
      save_image: false,
      hide_volume: true,
      studies: [],
    });

    container.innerHTML = "";
    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
  }, [asset]);

  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-white/10 bg-carbon">
      <div
        ref={containerRef}
        className={`w-full ${compact ? "h-[200px]" : "h-[350px]"}`}
      />
      {showOverlay && strikeTopPct !== null && (
        <>
          {/* Strike line overlay — white, positioned at opening price */}
          <div
            className="absolute left-0 right-0 pointer-events-none z-10"
            style={{ top: `${strikeTopPct}%` }}
          >
            <div className="border-t-2 border-dashed border-white/70 relative">
              <span className="absolute right-2 -top-5 bg-carbon/90 border border-white/30 rounded px-2 py-0.5 font-body text-[10px] text-white backdrop-blur-sm whitespace-nowrap">
                Strike ${strike.toLocaleString()}
              </span>
            </div>
          </div>
          {/* Resolution window shading */}
          <div className="absolute top-0 right-0 bottom-0 w-1/4 bg-gradient-to-l from-white/5 to-transparent pointer-events-none z-10">
            <span className="absolute top-2 right-2 font-body text-[10px] text-white/60 uppercase tracking-wider">
              Resolution
            </span>
          </div>
        </>
      )}
    </div>
  );
}
