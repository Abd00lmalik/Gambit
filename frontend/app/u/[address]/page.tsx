"use client";

import { use, useMemo } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useAccount } from "wagmi";
import { useDuelCreatedEvents } from "@/hooks/useDuelEvents";
import { useSupabaseProfile } from "@/hooks/useSupabaseProfile";
import PfpUpload from "@/components/PfpUpload";
import StatCounter from "@/components/StatCounter";
import AssetIcon from "@/components/AssetIcon";
import { DuelState } from "@/lib/contracts";

function formatAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function ProfilePage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = use(params);
  const addressLower = address.toLowerCase();
  const { address: connectedAddress } = useAccount();
  const { duels, isLoading: chainLoading } = useDuelCreatedEvents();
  const { profile, isLoading: dbLoading } = useSupabaseProfile(address);

  const isOwnProfile =
    connectedAddress?.toLowerCase() === addressLower;

  const userDuels = useMemo(
    () =>
      duels.filter(
        (d) =>
          d.playerA.toLowerCase() === addressLower ||
          d.playerB.toLowerCase() === addressLower
      ),
    [duels, addressLower]
  );

  const chainStats = useMemo(() => {
    let wins = 0;
    let losses = 0;
    let biggestWin = 0;

    const settled = userDuels.filter((d) => d.state === DuelState.SETTLED);
    for (const d of settled) {
      wins++;
      biggestWin = Math.max(biggestWin, parseFloat(d.stakeAmount));
    }

    return {
      wins,
      losses: settled.length - wins,
      streak: 0,
      biggestWin,
      totalDuels: userDuels.length,
    };
  }, [userDuels]);

  const stats = {
    wins: profile?.wins ?? chainStats.wins,
    losses: profile?.losses ?? chainStats.losses,
    streak: profile?.streak ?? chainStats.streak,
    biggestWin: Math.max(profile?.biggest_win ?? 0, chainStats.biggestWin),
    totalDuels: chainStats.totalDuels,
  };

  const winRate =
    stats.wins + stats.losses > 0
      ? Math.round((stats.wins / (stats.wins + stats.losses)) * 100)
      : 0;

  const recentSettled = useMemo(
    () =>
      userDuels
        .filter((d) => d.state === DuelState.SETTLED)
        .sort((a, b) => b.joinDeadline - a.joinDeadline)
        .slice(0, 5),
    [userDuels]
  );

  const isLoading = chainLoading && duels.length === 0;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 border-2 border-teal border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="font-body text-sm text-gray-400">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", damping: 20, stiffness: 80 }}
          className="flex flex-col items-center text-center mb-10"
        >
          {isOwnProfile ? (
            <PfpUpload
              currentPfp={profile?.pfp_url}
              onUploaded={() => {}}
            />
          ) : profile?.pfp_url ? (
            <img
              src={profile.pfp_url}
              alt="Profile"
              className="h-20 w-20 rounded-full object-cover border-2 border-teal/30 mb-4"
            />
          ) : (
            <div className="h-20 w-20 rounded-full bg-teal/15 border-2 border-teal/30 flex items-center justify-center mb-4">
              <span className="font-display text-2xl font-bold text-teal">
                {address.charAt(2).toUpperCase()}
              </span>
            </div>
          )}

          <h1 className="font-display text-3xl font-bold text-foam mb-1">
            {profile?.display_name || formatAddress(address)}
          </h1>
          <p className="font-body text-sm text-gray-400 font-mono">
            {address}
          </p>

          {stats.streak !== 0 && (
            <span
              className={`inline-flex items-center gap-1 mt-3 rounded-full px-3 py-1 text-xs font-bold font-display ${
                stats.streak > 0
                  ? "bg-up/15 text-up border border-up/20"
                  : "bg-down/15 text-down border border-down/20"
              }`}
            >
              {stats.streak > 0
                ? `${stats.streak} win streak`
                : `${Math.abs(stats.streak)} loss streak`}
            </span>
          )}
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass rounded-2xl p-6 mb-8"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <StatCounter value={stats.wins} label="Wins" />
            <StatCounter value={stats.losses} label="Losses" />
            <StatCounter value={winRate} label="Win Rate" suffix="%" />
            <StatCounter
              value={stats.biggestWin}
              label="Biggest Win"
              suffix=" STT"
              decimals={1}
            />
          </div>
        </motion.div>

        {/* Details */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="glass rounded-2xl p-6 mb-8"
        >
          <h2 className="font-display text-lg font-bold text-foam mb-4">
            Stats
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="font-body text-xs text-gray-400">Total Duels</p>
              <p className="font-display text-lg font-bold text-foam">
                {stats.totalDuels}
              </p>
            </div>
            <div>
              <p className="font-body text-xs text-gray-400">
                Completed Duels
              </p>
              <p className="font-display text-lg font-bold text-foam">
                {stats.wins + stats.losses}
              </p>
            </div>
            <div>
              <p className="font-body text-xs text-gray-400">Current Streak</p>
              <p
                className={`font-display text-lg font-bold ${
                  stats.streak > 0
                    ? "text-up"
                    : stats.streak < 0
                    ? "text-down"
                    : "text-foam"
                }`}
              >
                {stats.streak > 0
                  ? `${stats.streak}W`
                  : stats.streak < 0
                  ? `${Math.abs(stats.streak)}L`
                  : "—"}
              </p>
            </div>
            <div>
              <p className="font-body text-xs text-gray-400">Biggest Win</p>
              <p className="font-display text-lg font-bold text-teal">
                {stats.biggestWin} STT
              </p>
            </div>
          </div>
        </motion.div>

        {/* Recent duels */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <h2 className="font-display text-lg font-bold text-foam mb-4">
            Recent Duels
          </h2>
          {recentSettled.length > 0 ? (
            <div className="space-y-2">
              {recentSettled.map((duel, i) => (
                <motion.div
                  key={duel.address}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + i * 0.05 }}
                >
                  <Link
                    href={`/duel/${duel.address}`}
                    className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 transition-all duration-200 hover:border-white/20 hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal cursor-pointer"
                  >
                    <div className="h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold bg-orange-500/15 text-orange-400">
                      <AssetIcon asset="BTC" className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-display text-xs font-bold text-foam">
                        {duel.stakeAmount} STT
                      </p>
                      <p className="font-body text-[10px] text-gray-500">
                        vs{" "}
                        {duel.playerA.toLowerCase() === addressLower
                          ? formatAddress(duel.playerB)
                          : formatAddress(duel.playerA)}
                      </p>
                    </div>
                    <span className="font-body text-xs font-medium text-gray-400">
                      Settled
                    </span>
                  </Link>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="font-body text-sm text-gray-500">
                No completed duels yet.
              </p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
