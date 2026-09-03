"use client";

import { motion } from "framer-motion";
import { useCountdown } from "@/hooks/useCountdown";

interface CountdownTimerProps {
  targetTimestamp: number;
  label?: string;
  size?: "sm" | "md" | "lg";
  variant?: "join" | "resolve";
}

export default function CountdownTimer({
  targetTimestamp,
  label,
  size = "md",
  variant = "join",
}: CountdownTimerProps) {
  const { hours, minutes, seconds, expired } = useCountdown(targetTimestamp);

  const pad = (n: number) => String(n).padStart(2, "0");

  const sizeConfig = {
    sm: { block: "h-8 w-7 text-sm", gap: "gap-1", text: "text-sm" },
    md: { block: "h-11 w-10 text-lg", gap: "gap-2", text: "text-lg" },
    lg: { block: "h-16 w-14 text-3xl", gap: "gap-3", text: "text-3xl" },
  };

  const cfg = sizeConfig[size];
  const isUrgent = !expired && hours === 0 && minutes < 5;

  return (
    <div className="flex flex-col items-center gap-1">
      {label && (
        <span className="font-body text-xs uppercase tracking-wider text-gray-400">
          {label}
        </span>
      )}
      <div className={`flex items-center ${cfg.gap} ${cfg.text}`}>
        <TimeBlock value={pad(hours)} className={cfg.block} urgent={isUrgent} />
        <span className={`${isUrgent ? "text-down" : "text-gray-500"} font-display animate-glow-pulse`}>:</span>
        <TimeBlock value={pad(minutes)} className={cfg.block} urgent={isUrgent} />
        <span className={`${isUrgent ? "text-down" : "text-gray-500"} font-display animate-glow-pulse`}>:</span>
        <TimeBlock value={pad(seconds)} className={cfg.block} urgent={isUrgent} />
      </div>
      {expired && (
        <span className="font-body text-xs text-down">
          {variant === "join" ? "Deadline passed" : "Resolved"}
        </span>
      )}
    </div>
  );
}

function TimeBlock({
  value,
  className,
  urgent,
}: {
  value: string;
  className: string;
  urgent: boolean;
}) {
  return (
    <motion.div
      key={value}
      initial={{ y: -4, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", damping: 20, stiffness: 200 }}
      className={`flex items-center justify-center rounded-lg font-display ${
        urgent
          ? "bg-down/15 text-down border border-down/30 shadow-lg shadow-down/10"
          : "bg-white/5 text-foam border border-white/10"
      } ${className}`}
    >
      {value}
    </motion.div>
  );
}
