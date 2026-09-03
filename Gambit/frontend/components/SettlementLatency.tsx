"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface SettlementLatencyProps {
  settlementTriggeredAt: number;
  marketExpiry: number;
}

export default function SettlementLatency({ settlementTriggeredAt, marketExpiry }: SettlementLatencyProps) {
  const [latency, setLatency] = useState<number | null>(null);

  useEffect(() => {
    if (settlementTriggeredAt && marketExpiry) {
      setLatency(settlementTriggeredAt - marketExpiry);
    }
  }, [settlementTriggeredAt, marketExpiry]);

  if (latency === null) return null;

  const isFast = latency <= 5;
  const isMedium = latency <= 10;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 ${
        isFast
          ? "border-up/20 bg-up/5"
          : isMedium
          ? "border-yellow-400/20 bg-yellow-400/5"
          : "border-white/10 bg-white/5"
      }`}
    >
      <div className={`h-2 w-2 rounded-full ${
        isFast ? "bg-up" : isMedium ? "bg-yellow-400" : "bg-gray-400"
      }`} />
      <span className="font-mono text-xs text-gray-300">
        Auto-settled in{" "}
        <span className={`font-bold ${
          isFast ? "text-up" : isMedium ? "text-yellow-400" : "text-gray-300"
        }`}>
          {latency}s
        </span>
      </span>
      <span className="font-body text-[10px] text-gray-500">
        (market → settlement)
      </span>
    </motion.div>
  );
}
