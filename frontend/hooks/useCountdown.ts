"use client";

import { useState, useEffect, useCallback } from "react";

export function useCountdown(targetTimestamp: number) {
  const calc = useCallback(() => {
    const diff = targetTimestamp - Math.floor(Date.now() / 1000);
    if (diff <= 0) return { hours: 0, minutes: 0, seconds: 0, total: 0, expired: true };
    return {
      hours: Math.floor(diff / 3600),
      minutes: Math.floor((diff % 3600) / 60),
      seconds: diff % 60,
      total: diff,
      expired: false,
    };
  }, [targetTimestamp]);

  const [time, setTime] = useState(calc);

  useEffect(() => {
    const interval = setInterval(() => setTime(calc()), 1000);
    return () => clearInterval(interval);
  }, [calc]);

  return time;
}
