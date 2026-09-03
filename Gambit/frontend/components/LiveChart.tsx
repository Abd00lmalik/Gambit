"use client";

import { useEffect, useRef } from "react";

interface LiveChartProps {
  asset: string;
  strike: number;
  showOverlay?: boolean;
  compact?: boolean;
}

export default function LiveChart({ asset, strike, showOverlay = true, compact = false }: LiveChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

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
      {showOverlay && (
        <>
          {/* Strike line overlay */}
          <div className="absolute left-0 right-0 top-1/2 pointer-events-none z-10">
            <div className="border-t border-dashed border-teal/50 relative">
              <span className="absolute right-2 -top-5 bg-carbon/90 border border-teal/30 rounded px-2 py-0.5 font-body text-[10px] text-teal backdrop-blur-sm">
                Strike ${strike.toLocaleString()}
              </span>
            </div>
          </div>
          {/* Resolution window shading */}
          <div className="absolute top-0 right-0 bottom-0 w-1/4 bg-gradient-to-l from-teal/5 to-transparent pointer-events-none z-10">
            <span className="absolute top-2 right-2 font-body text-[10px] text-teal/60 uppercase tracking-wider">
              Resolution
            </span>
          </div>
        </>
      )}
    </div>
  );
}
