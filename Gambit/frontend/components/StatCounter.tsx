"use client";

import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";

interface StatCounterProps {
  value: number;
  label: string;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
}

export default function StatCounter({
  value,
  label,
  prefix = "",
  suffix = "",
  decimals = 0,
  duration = 1.5,
}: StatCounterProps) {
  const [displayed, setDisplayed] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          const start = performance.now();
          const animate = (now: number) => {
            const elapsed = (now - start) / 1000;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setDisplayed(eased * value);
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.3 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [value, duration]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ type: "spring", damping: 20, stiffness: 100 }}
      className="flex flex-col items-center gap-1"
    >
      <span className="font-display text-3xl font-bold text-foam tabular-nums">
        {prefix}{displayed.toFixed(decimals)}{suffix}
      </span>
      <span className="font-body text-xs uppercase tracking-wider text-gray-400">
        {label}
      </span>
    </motion.div>
  );
}
