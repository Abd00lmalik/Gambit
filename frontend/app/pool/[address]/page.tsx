"use client";

import { use, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useAccount } from "wagmi";
import AssetIcon from "@/components/AssetIcon";
import OracleVerification from "@/components/OracleVerification";
import { getRoomCode } from "@/components/SquadPoolCard";

interface PoolParticipant {
  address: string;
  side: "UP" | "DOWN";
  amount: number;
  joinedAt: number;
}

interface PoolData {
  address: string;
  squadName: string;
  marketAddress: string;
  asset: string;
  interval: string;
  openingPrice: number;
  expiry: number;
  creator: string;
  participants: PoolParticipant[];
  totalUp: number;
  totalDown: number;
  resolved: boolean;
  winningSide: "UP" | "DOWN" | null;
}

// Mock data for demo — in production this reads from on-chain + events
const MOCK_POOL: PoolData = {
  address: "",
  squadName: "Alpha Traders",
  marketAddress: "0x1234...abcd",
  asset: "BTC",
  interval: "15m",
  openingPrice: 58432.10,
  expiry: Math.floor(Date.now() / 1000) + 600,
  creator: "0x76d73b841d6b086cf98dda0f97588ec9f463472b6f016eae73f51b966be7aed7",
  participants: [
    { address: "0x76d7...80f", side: "UP", amount: 1.0, joinedAt: Date.now() - 300000 },
    { address: "0x5E2D...9cE6", side: "UP", amount: 0.5, joinedAt: Date.now() - 240000 },
    { address: "0xA3B1...7d42", side: "DOWN", amount: 0.8, joinedAt: Date.now() - 180000 },
    { address: "0x9F2C...e1a8", side: "DOWN", amount: 0.3, joinedAt: Date.now() - 120000 },
    { address: "0x4D8E...b3f0", side: "UP", amount: 0.2, joinedAt: Date.now() - 60000 },
  ],
  totalUp: 1.7,
  totalDown: 1.1,
  resolved: false,
  winningSide: null,
};

export default function SquadPoolDetailPage({ params }: { params: Promise<{ address: string }> }) {
  const { address: poolAddress } = use(params) as { address: string };
  const { address: connectedAddress, isConnected } = useAccount();
  const [selectedSide, setSelectedSide] = useState<"UP" | "DOWN">("UP");
  const [depositAmount, setDepositAmount] = useState("0.5");
  const [joinState, setJoinState] = useState<"idle" | "joining" | "joined" | "error">("idle");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // In production: fetch pool data from on-chain + events
  const pool = { ...MOCK_POOL, address: poolAddress };
  const isCreator = connectedAddress?.toLowerCase() === pool.creator.toLowerCase();
  const isParticipant = pool.participants.some(
    (p) => p.address.toLowerCase() === connectedAddress?.toLowerCase()
  );
  const myParticipation = pool.participants.find(
    (p) => p.address.toLowerCase() === connectedAddress?.toLowerCase()
  );
  const timeLeft = Math.max(0, pool.expiry - Math.floor(Date.now() / 1000));
  const isExpired = timeLeft <= 0;

  const inviteLink = typeof window !== "undefined"
    ? `${window.location.origin}/pool/${poolAddress}`
    : "";
  const roomCode = getRoomCode(poolAddress);

  const copyInviteLink = useCallback(() => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [inviteLink]);

  const copyRoomCode = useCallback(() => {
    navigator.clipboard.writeText(roomCode);
  }, [roomCode]);

  const handleJoin = useCallback(async () => {
    if (!isConnected || isParticipant) return;
    setJoinState("joining");
    setError(null);
    try {
      // Join pool transaction would go here
      setJoinState("joined");
    } catch (e: any) {
      setError(e?.message?.includes("User rejected") ? "Transaction rejected" : "Failed to join pool");
      setJoinState("idle");
    }
  }, [isConnected, isParticipant]);

  const totalPool = pool.totalUp + pool.totalDown;
  const upPct = totalPool > 0 ? (pool.totalUp / totalPool) * 100 : 50;
  const downPct = 100 - upPct;

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <AssetIcon asset={pool.asset} className="h-6 w-6" />
            <h1 className="font-display text-3xl md:text-4xl font-bold text-foam">
              {pool.squadName || "Squad Pool"}
            </h1>
          </div>
          <p className="font-body text-gray-400">
            Private squad pool. Invite only.
          </p>
        </motion.div>

        {/* Invite link banner */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4 mb-6"
        >
          <div className="flex items-center gap-4 flex-wrap">
            {/* Room code */}
            <div className="flex items-center gap-2">
              <span className="font-body text-[10px] text-gray-400 uppercase tracking-wider">Room Code</span>
              <code className="font-mono text-lg font-bold text-purple-400 tracking-widest">{roomCode}</code>
              <button
                onClick={copyRoomCode}
                className="rounded-lg bg-purple-500/20 px-2 py-1 font-body text-[10px] font-medium text-purple-400 hover:bg-purple-500/30 transition-colors"
              >
                Copy
              </button>
            </div>
            <div className="h-4 w-px bg-white/10 hidden sm:block" />
            {/* Full link */}
            <div className="flex-1 min-w-0 flex items-center gap-2">
              <span className="font-body text-[10px] text-gray-400 uppercase tracking-wider hidden sm:inline">Link</span>
              <code className="font-mono text-[11px] text-teal truncate flex-1">{inviteLink}</code>
              <button
                onClick={copyInviteLink}
                className="shrink-0 rounded-lg bg-teal/20 px-3 py-1.5 font-body text-[10px] font-medium text-teal hover:bg-teal/30 transition-colors"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Pool info + participants */}
          <div className="lg:col-span-2 space-y-6">
            {/* Market question */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="glass rounded-xl p-4 border-l-2 border-teal"
            >
              <p className="font-body text-sm text-foam">
                Will {pool.asset} close above ~${pool.openingPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })}?
              </p>
              <div className="flex items-center gap-4 mt-2">
                <p className="font-body text-[10px] text-gray-500">
                  Expires: {new Date(pool.expiry * 1000).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "UTC", hour12: false })} UTC
                </p>
                {pool.resolved && (
                  <span className={`rounded-full px-2 py-0.5 font-body text-[10px] font-medium ${
                    pool.winningSide === "UP" ? "bg-up/10 text-up" : "bg-down/10 text-down"
                  }`}>
                    Resolved: {pool.winningSide === "UP" ? "▲ Up Won" : "▼ Down Won"}
                  </span>
                )}
              </div>
            </motion.div>

            {/* Pool split bar */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-body text-xs text-gray-400">Pool Split</span>
                <span className="font-body text-xs text-foam">{totalPool.toFixed(2)} STT total</span>
              </div>
              <div className="h-3 rounded-full overflow-hidden flex bg-white/5">
                <div
                  className="bg-up/60 transition-all duration-500"
                  style={{ width: `${upPct}%` }}
                />
                <div
                  className="bg-down/60 transition-all duration-500"
                  style={{ width: `${downPct}%` }}
                />
              </div>
              <div className="flex justify-between mt-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-up" />
                  <span className="font-body text-[11px] text-up">▲ Up: {pool.totalUp.toFixed(2)} STT ({upPct.toFixed(0)}%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-body text-[11px] text-down">▼ Down: {pool.totalDown.toFixed(2)} STT ({downPct.toFixed(0)}%)</span>
                  <span className="h-2 w-2 rounded-full bg-down" />
                </div>
              </div>
            </motion.div>

              {/* Participants */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
              >
                <h3 className="font-display text-sm font-bold text-foam mb-3">
                  Squad ({pool.participants.length})
                </h3>
                <div className="space-y-2">
                  {pool.participants.map((p, i) => {
                    const isWinner = pool.resolved && p.side === pool.winningSide;
                    const isLoser = pool.resolved && p.side !== pool.winningSide;
                    return (
                      <div
                        key={i}
                        className={`flex items-center justify-between rounded-xl border p-3 ${
                          isWinner
                            ? "border-up/30 bg-up/[0.06]"
                            : isLoser
                              ? "border-down/15 bg-down/[0.03] opacity-60"
                              : p.side === "UP"
                                ? "border-up/10 bg-up/[0.03]"
                                : "border-down/10 bg-down/[0.03]"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center font-display text-[10px] font-bold ${
                            isWinner ? "bg-up/20 text-up" : isLoser ? "bg-down/10 text-down/60" : p.side === "UP" ? "bg-up/15 text-up" : "bg-down/15 text-down"
                          }`}>
                            {isWinner ? "✓" : isLoser ? "✗" : p.side === "UP" ? "▲" : "▼"}
                          </div>
                          <div>
                            <span className="font-mono text-[11px] text-foam block">
                              {p.address.slice(0, 6)}...{p.address.slice(-4)}
                            </span>
                            <span className="font-body text-[10px] text-gray-500">
                              {p.side === "UP" ? "Bullish" : "Bearish"} · {new Date(p.joinedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                        </div>
                        <span className={`font-display text-sm font-semibold ${
                          isWinner ? "text-up" : isLoser ? "text-down/60" : p.side === "UP" ? "text-up" : "text-down"
                        }`}>
                          {p.amount.toFixed(2)} STT
                        </span>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
          </div>

          {/* Right: Join panel */}
          <div className="lg:col-span-1">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: "spring", damping: 20, stiffness: 80, delay: 0.3 }}
              className="sticky top-24 glass rounded-2xl p-5 border border-teal/20 space-y-5"
            >
              <h3 className="font-display text-lg font-bold text-foam">Join Squad</h3>

              {pool.resolved ? (
                <div className="py-4">
                  <div className="text-center mb-4">
                    <p className="font-display text-lg font-bold text-up mb-1">Pool Resolved</p>
                    <p className="font-body text-sm text-gray-400">
                      {pool.winningSide === "UP" ? "▲ Up" : "▼ Down"} side won. Winners split the pool.
                    </p>
                  </div>

                  {/* Squad tally */}
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 mb-4">
                    <p className="font-body text-xs text-gray-400 uppercase tracking-wider mb-3">Squad Results</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="text-center rounded-xl bg-up/5 border border-up/10 p-3">
                        <p className="font-display text-2xl font-bold text-up">
                          {pool.participants.filter((p) => p.side === pool.winningSide).length}
                        </p>
                        <p className="font-body text-[10px] text-gray-400 mt-1">Got it right</p>
                      </div>
                      <div className="text-center rounded-xl bg-down/5 border border-down/10 p-3">
                        <p className="font-display text-2xl font-bold text-down">
                          {pool.participants.filter((p) => p.side !== pool.winningSide).length}
                        </p>
                        <p className="font-body text-[10px] text-gray-400 mt-1">Got it wrong</p>
                      </div>
                    </div>
                  </div>

                  {myParticipation && (
                    <div className={`rounded-xl p-3 ${
                      myParticipation.side === pool.winningSide
                        ? "border border-up/20 bg-up/5"
                        : "border border-down/20 bg-down/5"
                    }`}>
                      <p className={`font-display text-sm font-bold ${
                        myParticipation.side === pool.winningSide ? "text-up" : "text-down"
                      }`}>
                        {myParticipation.side === pool.winningSide ? "You got it right!" : "You got it wrong."}
                      </p>
                      <p className="font-body text-xs text-gray-400 mt-1">
                        {myParticipation.side === pool.winningSide
                          ? `Claim your proportional share of the pool.`
                          : `Your ${myParticipation.amount.toFixed(2)} STT stake goes to the winners.`}
                      </p>
                    </div>
                  )}
                </div>
              ) : isParticipant ? (
                <div className="text-center py-4">
                  <div className="h-12 w-12 rounded-full bg-teal/15 flex items-center justify-center mx-auto mb-3">
                    <span className="text-2xl">✓</span>
                  </div>
                  <p className="font-display text-sm font-bold text-foam mb-1">You're in the squad</p>
                  <p className="font-body text-xs text-gray-400">
                    You're on the <span className={myParticipation?.side === "UP" ? "text-up" : "text-down"}>
                      {myParticipation?.side === "UP" ? "▲ Up" : "▼ Down"}
                    </span> side with {myParticipation?.amount.toFixed(2)} STT.
                  </p>
                  <div className="mt-3 rounded-xl border border-white/5 bg-white/[0.02] p-3">
                    <p className="font-body text-[10px] text-gray-400">
                      Waiting for DreamDEX market to resolve...
                    </p>
                  </div>
                </div>
              ) : isExpired ? (
                <div className="text-center py-4">
                  <p className="font-display text-sm font-bold text-gray-400 mb-1">Pool Closed</p>
                  <p className="font-body text-xs text-gray-500">
                    This market has expired. No new deposits accepted.
                  </p>
                </div>
              ) : (
                <>
                  {/* Side picker */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setSelectedSide("UP")}
                      className={`min-h-[48px] flex items-center justify-center gap-2 rounded-xl border p-3 font-display text-sm font-bold transition-all duration-200 cursor-pointer ${
                        selectedSide === "UP"
                          ? "border-up bg-up/10 text-up shadow-lg shadow-up/10"
                          : "border-white/10 bg-white/[0.03] text-gray-300 hover:border-up/30"
                      }`}
                    >
                      <span>▲</span>
                      <span>Up</span>
                    </button>
                    <button
                      onClick={() => setSelectedSide("DOWN")}
                      className={`min-h-[48px] flex items-center justify-center gap-2 rounded-xl border p-3 font-display text-sm font-bold transition-all duration-200 cursor-pointer ${
                        selectedSide === "DOWN"
                          ? "border-down bg-down/10 text-down shadow-lg shadow-down/10"
                          : "border-white/10 bg-white/[0.03] text-gray-300 hover:border-down/30"
                      }`}
                    >
                      <span>▼</span>
                      <span>Down</span>
                    </button>
                  </div>

                  {/* Deposit input */}
                  <div>
                    <label className="font-body text-xs uppercase tracking-wider text-gray-400 mb-2 block">Your Stake</label>
                    <div className="relative">
                      <input
                        type="number"
                        min={0.1}
                        max={100}
                        step={0.1}
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 pr-16 font-display text-lg text-foam outline-none transition-colors focus:border-teal focus:ring-1 focus:ring-teal"
                        placeholder="0.5"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 font-body text-sm text-gray-400">STT</span>
                    </div>
                  </div>

                  {error && (
                    <p className="font-body text-xs text-down text-center">{error}</p>
                  )}

                  <button
                    disabled={!isConnected || joinState === "joining"}
                    onClick={handleJoin}
                    className={`min-h-[48px] w-full rounded-xl font-display text-base font-bold transition-all duration-200 cursor-pointer ${
                      isConnected && joinState !== "joining"
                        ? "bg-foam text-carbon hover:bg-foam-dark hover:shadow-lg hover:shadow-foam/20 active:scale-[0.97]"
                        : "bg-white/10 text-gray-500 cursor-not-allowed"
                    }`}
                  >
                    {joinState === "joining" ? "Joining..." : !isConnected ? "Connect Wallet" : `Join ${selectedSide}`}
                  </button>
                </>
              )}

              {/* Payout info */}
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 space-y-2">
                <div className="flex justify-between">
                  <span className="font-body text-[11px] text-gray-400">Payout</span>
                  <span className="font-body text-[11px] text-teal">Proportional</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-body text-[11px] text-gray-400">Fee</span>
                  <span className="font-body text-[11px] text-foam">2.5%</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-body text-[11px] text-gray-400">Settlement</span>
                  <span className="font-body text-[11px] text-foam">Auto (DreamDEX)</span>
                </div>
              </div>

              <p className="font-body text-[10px] text-gray-500 text-center leading-relaxed">
                Winners split the pool proportionally. Stake goes to the winning side after DreamDEX resolves.
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
