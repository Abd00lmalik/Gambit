"use client";

import { useState, useEffect, useCallback } from "react";
import type { DbWalletProfile, DbDuel } from "@/lib/db";

export function useSupabaseProfile(address: string | undefined) {
  const [profile, setProfile] = useState<DbWalletProfile | null>(null);
  const [duels, setDuels] = useState<DbDuel[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!address) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/profile?address=${address.toLowerCase()}`
      );
      if (!res.ok) throw new Error("Failed to fetch profile");
      const data = await res.json();
      setProfile(data.profile);
      setDuels(data.duels || []);
    } catch (e) {
      console.warn("Profile fetch failed, using on-chain data:", e);
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return { profile, duels, isLoading, refetch: fetchProfile };
}

export function useSupabasePfp(address: string | undefined) {
  const [result, setResult] = useState<{ pfpUrl: string | null; displayName: string | null }>({
    pfpUrl: null,
    displayName: null,
  });

  useEffect(() => {
    if (!address) return;

    (async () => {
      try {
        const res = await fetch(
          `/api/profile?address=${address.toLowerCase()}`
        );
        if (!res.ok) return;
        const data = await res.json();
        setResult({
          pfpUrl: data.profile?.pfp_url ?? null,
          displayName: data.profile?.display_name ?? null,
        });
      } catch {}
    })();
  }, [address]);

  return result;
}
