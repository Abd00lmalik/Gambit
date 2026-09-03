"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useInView } from "framer-motion";
import CustomConnectButton from "@/components/CustomConnectButton";

/* ═══════════════════════════════════════════════════════
   DATA
   ═══════════════════════════════════════════════════════ */

interface Matchup {
  id: number;
  asset: string;
  window: string;
  aHandle: string;
  aSide: "up" | "down";
  aStake: number;
  bHandle: string;
  bSide: "up" | "down";
  bStake: number;
  timeLeft: number;
}

const MATCHUPS: Matchup[] = [
  { id: 1, asset: "BTC", window: "15m", aHandle: "Satoshi", aSide: "up", aStake: 2.5, bHandle: "Whale_0x", bSide: "down", bStake: 2.5, timeLeft: 877 },
  { id: 2, asset: "ETH", window: "1h", aHandle: "Vitalik", aSide: "down", aStake: 5, bHandle: "Node42", bSide: "up", bStake: 5, timeLeft: 3241 },
  { id: 3, asset: "BTC", window: "15m", aHandle: "Degen", aSide: "up", aStake: 1, bHandle: "AnonBTC", bSide: "down", bStake: 1, timeLeft: 412 },
  { id: 4, asset: "ETH", window: "15m", aHandle: "Merkle", aSide: "down", aStake: 0.5, bHandle: "Cyphr", bSide: "up", bStake: 0.5, timeLeft: 156 },
  { id: 5, asset: "BTC", window: "1h", aHandle: "Cyphr", aSide: "up", aStake: 10, bHandle: "Whale_0x", bSide: "down", bStake: 10, timeLeft: 2100 },
];

const PFPS: Record<string, string> = {
  Satoshi:  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=256&h=256&fit=crop&crop=faces",
  Whale_0x: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=256&h=256&fit=crop&crop=faces",
  Vitalik:  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=256&h=256&fit=crop&crop=faces",
  Degen:    "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=256&h=256&fit=crop&crop=faces",
  Merkle:   "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=256&h=256&fit=crop&crop=faces",
  Cyphr:    "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=256&h=256&fit=crop&crop=faces",
  Node42:   "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=256&h=256&fit=crop&crop=faces",
  AnonBTC:  "https://images.unsplash.com/photo-1531123897727-8f1f2d6ffab8?w=256&h=256&fit=crop&crop=faces",
};

const TICKER = [
  { side: "down" as const, asset: "ETH", stake: "0.5", who: "Satoshi" },
  { side: "up" as const, asset: "BTC", stake: "5", who: "Vitalik" },
  { side: "up" as const, asset: "ETH", stake: "1", who: "Degen" },
  { side: "down" as const, asset: "BTC", stake: "2.5", who: "Whale_0x" },
  { side: "up" as const, asset: "ETH", stake: "0.5", who: "Merkle" },
  { side: "up" as const, asset: "BTC", stake: "0.5", who: "Cyphr" },
  { side: "down" as const, asset: "ETH", stake: "2.5", who: "Node42" },
];

const HIW_STEPS = [
  {
    n: "01",
    title: "Create a Duel",
    body: "Pick your side, set your stake, challenge someone.",
    bg: "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1200&q=70",
  },
  {
    n: "02",
    title: "Share the Link",
    body: "Send it to your opponent. They accept or you cancel.",
    bg: "https://images.unsplash.com/photo-1557683316-973673baf926?w=1200&q=70",
  },
  {
    n: "03",
    title: "Duel Settles",
    body: "DreamDEX resolves. Winner takes the pot.",
    bg: "https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=1200&q=70",
  },
];

/* ═══════════════════════════════════════════════════════
   PFP — Unsplash photo, circle-cropped
   ═══════════════════════════════════════════════════════ */

function Pfp({ name, size = 40 }: { name: string; size?: number }) {
  const src = PFPS[name] || PFPS.Satoshi;
  return (
    <div
      className="rounded-full shrink-0 overflow-hidden pfp-ring"
      style={{ width: size, height: size }}
    >
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        className="w-full h-full object-cover"
        loading="lazy"
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   ROLLING CLOCK
   ═══════════════════════════════════════════════════════ */

function ClockDigit({ char }: { char: string }) {
  const prev = useRef(char);
  const [rolling, setRolling] = useState(false);
  useEffect(() => {
    if (prev.current !== char) {
      setRolling(true);
      const t = setTimeout(() => setRolling(false), 280);
      prev.current = char;
      return () => clearTimeout(t);
    }
  }, [char]);
  return (
    <span className="inline-block overflow-hidden h-[1.15em] relative align-bottom">
      <span key={char + (rolling ? "r" : "s")} className={`block ${rolling ? "digit-roll" : ""}`}>{char}</span>
    </span>
  );
}

function RollingClock({ seconds }: { seconds: number }) {
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return (
    <span className="font-mono text-2xl md:text-3xl font-bold text-[#D7FAFC] tabular-nums tracking-tight inline-flex">
      {mm.split("").map((c, i) => <ClockDigit key={`m${i}`} char={c} />)}
      <span className="mx-[1px]">:</span>
      {ss.split("").map((c, i) => <ClockDigit key={`s${i}`} char={c} />)}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════
   STORY RING
   ═══════════════════════════════════════════════════════ */

function StoryRing({ progress }: { progress: number }) {
  const circ = 2 * Math.PI * 14;
  const offset = circ * (1 - Math.min(progress, 1));
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" className="absolute -top-1.5 -right-1.5">
      <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(25,190,164,0.1)" strokeWidth="2" />
      <circle
        cx="18" cy="18" r="14" fill="none" stroke="#19BEA4" strokeWidth="2"
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" transform="rotate(-90 18 18)"
        style={{ transition: "stroke-dashoffset 1s linear" }}
      />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════
   SEAT POPOVER
   ═══════════════════════════════════════════════════════ */

function SeatPopover({ handle, wins, losses, onClose }: { handle: string; wins: number; losses: number; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const on = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener("mousedown", on);
    return () => document.removeEventListener("mousedown", on);
  }, [onClose]);
  return (
    <div ref={ref} className="popover absolute z-30 top-full mt-2 left-1/2 -translate-x-1/2 rounded-lg px-3 py-2.5 whitespace-nowrap chip-slide">
      <div className="flex items-center gap-2 mb-1.5">
        <Pfp name={handle} size={22} />
        <span className="font-mono text-[11px] text-[#D7FAFC] font-semibold">{handle}</span>
      </div>
      <p className="font-ui text-[10px] text-gray-400">
        <span className="text-[#6fcf97]">{wins}W</span> · <span className="text-[#e07a7a]">{losses}L</span>
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   SPARKLINE
   ═══════════════════════════════════════════════════════ */

function Sparkline() {
  const bars = [3, 5, 4, 6, 5, 7, 6, 8, 7, 5, 8, 9, 8, 7, 9, 8, 6];
  return (
    <div className="flex items-end gap-[2px] justify-center opacity-30 h-4">
      {bars.map((h, i) => (
        <div key={i} className="sparkline-bar rounded-full bg-[#19BEA4]" style={{ width: 2, height: h, animationDelay: `${i * 0.12}s` }} />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   DUEL TABLE
   ═══════════════════════════════════════════════════════ */

function DuelTable({
  matchup,
  viewState,
  onFlipSide,
  onSeatClick,
  onPotClick,
}: {
  matchup: Matchup;
  viewState: "create" | "join" | "settle";
  onFlipSide: () => void;
  onSeatClick: (handle: string) => void;
  onPotClick: () => void;
}) {
  const [countdown, setCountdown] = useState(matchup.timeLeft);
  const [seatA, setSeatA] = useState(matchup.aSide);

  useEffect(() => {
    setSeatA(matchup.aSide);
    setCountdown(matchup.timeLeft);
  }, [matchup.id, matchup.aSide, matchup.timeLeft]);

  useEffect(() => {
    const id = setInterval(() => setCountdown((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, []);

  const handleFlip = useCallback(() => {
    setSeatA((s) => (s === "up" ? "down" : "up"));
    onFlipSide();
  }, [onFlipSide]);

  const seatB = seatA === "up" ? "down" : "up";
  const pot = matchup.aStake + matchup.bStake;
  const isSettle = viewState === "settle";
  const isJoin = viewState === "join";

  return (
    <div className="duel-table w-full max-w-[700px] mx-auto rounded-2xl p-4 md:p-5 relative">
      {/* Top */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[#19BEA4] animate-pulse-dot" />
          <span className="font-mono text-[10px] text-[#D7FAFC]/40 tracking-wider uppercase">
            {isSettle ? "Settled" : "Live Duel"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[10px] text-[#D7FAFC]/35 bg-[#1E2526] rounded px-1.5 py-0.5">{matchup.asset}</span>
          <span className="font-mono text-[10px] text-[#19BEA4]/50 bg-[#19BEA4]/[0.06] rounded px-1.5 py-0.5">{matchup.window}</span>
        </div>
      </div>

      {/* Seats + center */}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center mb-3">
        {/* Seat A */}
        <div
          className={`seat rounded-xl p-3 text-center relative ${isSettle ? (seatA === "up" ? "winner" : "loser") : "bg-[#1E2526]/70"}`}
          onClick={() => onSeatClick(matchup.aHandle)}
          role="button" tabIndex={0}
        >
          <div className="flex justify-center mb-1.5 relative">
            <Pfp name={matchup.aHandle} size={40} />
            <span
              className={`absolute -bottom-0.5 -right-0.5 text-[8px] font-bold px-1 rounded-sm leading-[14px] z-10 ${
                seatA === "up" ? "bg-[#6fcf97]/25 text-[#6fcf97]" : "bg-[#e07a7a]/25 text-[#e07a7a]"
              }`}
            >
              {seatA === "up" ? "▲" : "▼"}
            </span>
          </div>
          <p className="font-ui text-[11px] text-[#D7FAFC] font-medium">{matchup.aHandle}</p>
          {viewState === "create" ? (
            <button onClick={(e) => { e.stopPropagation(); handleFlip(); }} className="mt-1.5 font-mono text-[10px] text-[#19BEA4]/60 hover:text-[#19BEA4] transition-colors cursor-pointer">
              flip →
            </button>
          ) : (
            <p className="font-mono text-[11px] text-[#D7FAFC] mt-1">{matchup.aStake} STT</p>
          )}
        </div>

        {/* Center */}
        <div className="flex flex-col items-center gap-2 px-2 min-w-[100px]">
          <RollingClock seconds={countdown} />
          <div className="energy-line w-16 md:w-24" />
          <div
            className="pot-chip rounded-full bg-[#19BEA4]/10 border border-[#19BEA4]/20 px-3 py-1 flex items-center gap-1.5"
            onClick={onPotClick} role="button" tabIndex={0}
          >
            <span className="font-mono text-[9px] text-[#19BEA4]/50 uppercase tracking-wider">Pot</span>
            <span className="font-mono text-sm font-bold text-[#19BEA4]">{pot.toFixed(1)}</span>
          </div>
          <Sparkline />
        </div>

        {/* Seat B */}
        <div
          className={`seat rounded-xl p-3 text-center relative ${isSettle ? (seatB === "up" ? "winner" : "loser") : "bg-[#1E2526]/70"}`}
          onClick={() => onSeatClick(matchup.bHandle)}
          role="button" tabIndex={0}
        >
          <div className="flex justify-center mb-1.5 relative">
            <Pfp name={matchup.bHandle} size={40} />
            <span
              className={`absolute -bottom-0.5 -right-0.5 text-[8px] font-bold px-1 rounded-sm leading-[14px] z-10 ${
                seatB === "up" ? "bg-[#6fcf97]/25 text-[#6fcf97]" : "bg-[#e07a7a]/25 text-[#e07a7a]"
              }`}
            >
              {seatB === "up" ? "▲" : "▼"}
            </span>
          </div>
          <p className="font-ui text-[11px] text-[#D7FAFC] font-medium">{matchup.bHandle}</p>
          {viewState === "create" ? (
            <button onClick={(e) => { e.stopPropagation(); handleFlip(); }} className="mt-1.5 font-mono text-[10px] text-[#19BEA4]/60 hover:text-[#19BEA4] transition-colors cursor-pointer">
              flip →
            </button>
          ) : (
            <p className="font-mono text-[11px] text-[#D7FAFC] mt-1">{matchup.bStake} STT</p>
          )}
        </div>
      </div>

      {/* State overlays */}
      {isJoin && (
        <div className="chip-slide text-center py-1">
          <span className="font-mono text-[10px] text-[#19BEA4]/60">Pot locked · awaiting resolution</span>
        </div>
      )}
      {isSettle && (
        <div className="chip-slide text-center py-1">
          <span className="font-mono text-[10px] text-[#6fcf97]/70">Winner takes {pot.toFixed(1)} STT</span>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   ARENA CARD
   ═══════════════════════════════════════════════════════ */

function ArenaCard({ m, active, onSelect, maxTime }: { m: Matchup; active: boolean; onSelect: () => void; maxTime: number }) {
  return (
    <button
      onClick={onSelect}
      className={`arena-card flex-shrink-0 w-[190px] md:w-[210px] rounded-xl p-3 text-left transition-all duration-200 relative cursor-pointer ${
        active ? "bg-[#19BEA4]/[0.08] border border-[#19BEA4]/25" : "bg-[#2a3334] border border-white/[0.04] hover:border-white/[0.08]"
      }`}
    >
      <StoryRing progress={m.timeLeft / maxTime} />
      <div className="flex items-center gap-1.5 mb-2">
        <span className="font-mono text-[11px] font-semibold text-[#D7FAFC]">{m.asset}</span>
        <span className="font-mono text-[9px] text-[#19BEA4]/50 bg-[#19BEA4]/[0.05] rounded px-1 py-0">{m.window}</span>
      </div>
      <div className="flex items-center gap-2 mb-2">
        <div className="relative">
          <Pfp name={m.aHandle} size={30} />
          <span className={`absolute -bottom-0.5 -right-0.5 text-[7px] font-bold px-0.5 rounded leading-[12px] z-10 ${
            m.aSide === "up" ? "bg-[#6fcf97]/25 text-[#6fcf97]" : "bg-[#e07a7a]/25 text-[#e07a7a]"
          }`}>
            {m.aSide === "up" ? "▲" : "▼"}
          </span>
        </div>
        <div className="min-w-0">
          <p className="font-ui text-[11px] text-[#D7FAFC] font-medium truncate">{m.aHandle}</p>
          <p className="font-ui text-[9px] text-gray-500">vs {m.bHandle}</p>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] text-[#D7FAFC]/40">{m.aStake + m.bStake} STT</span>
        <span className={`font-mono text-[10px] font-semibold ${active ? "text-[#19BEA4]" : "text-[#D7FAFC]/50"}`}>
          {active ? "Viewing" : "Accept"}
        </span>
      </div>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════
   HOW IT WORKS — cinematic horizontal panels
   ═══════════════════════════════════════════════════════ */

function HowItWorks() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const w = el.offsetWidth;
      const idx = Math.round(el.scrollLeft / w);
      setActiveIdx(Math.min(idx, 2));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <section className="relative z-10 py-16 md:py-24 px-5 border-t border-white/[0.04]">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-10 md:mb-14">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ type: "spring", damping: 20, stiffness: 80 }}
          >
            <span className="font-mono text-[10px] text-[#19BEA4]/60 tracking-widest uppercase mb-2 block">Process</span>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-[#D7FAFC] mb-2">
              How it works
            </h2>
            <p className="font-serif italic text-lg md:text-xl text-[#D7FAFC]/50">
              Three steps from challenge to settlement.
            </p>
          </motion.div>
        </div>

        {/* Panels — horizontal scroll on desktop, stacked on mobile */}
        <div
          ref={scrollRef}
          className="flex gap-5 overflow-x-auto snap-x snap-mandatory scrollbar-none pb-4 md:pb-0"
          style={{ scrollbarWidth: "none" }}
        >
          {HIW_STEPS.map((step, i) => (
            <motion.div
              key={step.n}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ delay: i * 0.08 }}
              className="hiw-panel flex-shrink-0 w-[85vw] md:w-[calc(50vw-2rem)] min-h-[340px] md:min-h-[400px] snap-center flex flex-col justify-between p-6 md:p-8"
            >
              {/* Background image */}
              <div className="hiw-panel-bg" style={{ backgroundImage: `url(${step.bg})` }} />

              {/* Content */}
              <div className="relative z-10">
                {/* Large step number */}
                <span className="font-display text-[80px] md:text-[120px] font-black text-[#19BEA4]/[0.07] leading-none block -mb-6 md:-mb-10 select-none">
                  {step.n}
                </span>

                <h3 className="font-display text-lg md:text-xl font-bold text-[#D7FAFC] mb-1.5">
                  {step.title}
                </h3>
                <p className="font-ui text-sm text-gray-400 mb-6">
                  {step.body}
                </p>
              </div>

              {/* Mini UI */}
              <div className="relative z-10">
                {i === 0 && (
                  <div className="rounded-xl bg-[#1E2526]/80 backdrop-blur-sm p-4 border border-white/[0.04]">
                    <div className="flex gap-2 mb-3">
                      <span className="mock-toggle bg-[#6fcf97]/10 border-[#6fcf97]/20 text-[#6fcf97]">▲ UP</span>
                      <span className="mock-toggle bg-[#2a3334] border-white/[0.05] text-[#D7FAFC]/30">▼ DOWN</span>
                    </div>
                    <div className="mock-input flex items-center justify-between mb-2">
                      <span className="text-[#D7FAFC]/30">Stake</span>
                      <span className="font-mono text-[#D7FAFC]/60">2.5 STT</span>
                    </div>
                    <div className="mock-btn bg-[#19BEA4]/12 border border-[#19BEA4]/20 text-[#19BEA4] text-center text-[11px]">Challenge →</div>
                  </div>
                )}
                {i === 1 && (
                  <div className="rounded-xl bg-[#1E2526]/80 backdrop-blur-sm p-4 border border-white/[0.04]">
                    <div className="mock-input flex items-center gap-2 mb-2.5">
                      <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 text-[#D7FAFC]/25 shrink-0" stroke="currentColor" strokeWidth="1.5">
                        <path d="M6.5 1H3a1 1 0 00-1 1v12a1 1 0 001 1h10a1 1 0 001-1V5.5L9.5 1H6.5z" />
                        <path d="M9.5 1v4.5H14" />
                      </svg>
                      <span className="font-mono text-[10px] text-[#D7FAFC]/40 truncate">gambit.gg/d/a8f2c1e9</span>
                    </div>
                    <div className="flex gap-2">
                      <div className="mock-btn bg-[#19BEA4]/12 border border-[#19BEA4]/20 text-[#19BEA4] flex-1 text-center text-[11px]">Accept</div>
                      <div className="mock-btn bg-[#2a3334] border border-white/[0.05] text-[#D7FAFC]/30 flex-1 text-center text-[11px]">Cancel</div>
                    </div>
                  </div>
                )}
                {i === 2 && (
                  <div className="rounded-xl bg-[#1E2526]/80 backdrop-blur-sm p-4 border border-white/[0.04]">
                    <div className="flex gap-2 mb-2.5">
                      <div className="flex-1 rounded-lg bg-[#6fcf97]/[0.08] border border-[#6fcf97]/15 p-2.5 text-center relative overflow-hidden">
                        <span className="text-[10px] text-[#6fcf97] font-semibold">Winner</span>
                        <p className="font-ui text-[11px] text-[#D7FAFC]">Satoshi</p>
                        <div className="absolute inset-0 bg-gradient-to-t from-[#6fcf97]/[0.06] to-transparent pointer-events-none" />
                      </div>
                      <div className="flex-1 rounded-lg bg-[#e07a7a]/[0.06] border border-[#e07a7a]/10 p-2.5 text-center opacity-40">
                        <span className="text-[10px] text-[#e07a7a] font-semibold">Lost</span>
                        <p className="font-ui text-[11px] text-[#D7FAFC]/50">Whale_0x</p>
                      </div>
                    </div>
                    <div className="text-center font-mono text-[10px] text-[#19BEA4]/50">5.0 STT paid out</div>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Dot indicators */}
        <div className="flex justify-center gap-2 mt-4">
          {HIW_STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                scrollRef.current?.scrollTo({ left: i * (scrollRef.current?.offsetWidth || 0), behavior: "smooth" });
              }}
              className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                activeIdx === i ? "w-6 bg-[#19BEA4]" : "w-1.5 bg-[#D7FAFC]/15"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════
   COUNT UP
   ═══════════════════════════════════════════════════════ */

function CountUp({ to, suffix = "", decimals = 0 }: { to: number; suffix?: string; decimals?: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 1200);
      setVal(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to]);
  return (
    <span ref={ref} className="font-mono text-xl md:text-2xl font-semibold text-[#D7FAFC] tabular-nums whitespace-nowrap">
      {val.toFixed(decimals)}{suffix}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════
   MAIN
   ═══════════════════════════════════════════════════════ */

export default function LandingPage() {
  const [activeId, setActiveId] = useState(1);
  const [seatPopover, setSeatPopover] = useState<string | null>(null);
  const [potHint, setPotHint] = useState(false);
  const [spotPos, setSpotPos] = useState({ x: -600, y: -600 });
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(hover: hover)").matches) {
      const on = (e: PointerEvent) => setSpotPos({ x: e.clientX, y: e.clientY });
      window.addEventListener("pointermove", on, { passive: true });
      return () => window.removeEventListener("pointermove", on);
    }
  }, []);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const matchup = MATCHUPS.find((m) => m.id === activeId) || MATCHUPS[0];
  const maxTime = Math.max(...MATCHUPS.map((m) => m.timeLeft));

  return (
    <div className="relative min-h-screen overflow-hidden film-grain">
      {/* ── Background layers ─────────────────────── */}
      {/* Photo texture */}
      <div className="photo-texture absolute inset-0 z-0 pointer-events-none" />

      {/* Drifting radials */}
      <div className="absolute top-[15%] left-[25%] w-[500px] h-[500px] md:w-[700px] md:h-[700px] rounded-full blur-[160px] bg-[#19BEA4]/[0.06] pointer-events-none z-0 animate-[drift_28s_ease-in-out_infinite_alternate]" aria-hidden />
      <div className="absolute top-[5%] right-[8%] w-[400px] h-[400px] md:w-[550px] md:h-[550px] rounded-full blur-[160px] bg-[#D7FAFC]/[0.03] pointer-events-none z-0 animate-[drift_35s_ease-in-out_infinite_alternate-reverse]" aria-hidden />
      <style>{`@keyframes drift{from{transform:translate(0,0)}to{transform:translate(40px,25px)}}`}</style>

      {/* Diagonal light slash */}
      <div className="light-slash" aria-hidden />

      {/* Pointer spotlight */}
      <div className="pointer-spotlight hidden hover:block" style={{ left: spotPos.x - 300, top: spotPos.y - 300 }} aria-hidden />

      {/* Floating BTC/ETH marks — parallax */}
      <div className="float-mark font-display text-[80px] md:text-[120px] text-[#f7931a]/[0.04] top-[25%] left-[8%] select-none" style={{ transform: `translateY(${scrollY * 0.08}px)` }} aria-hidden>₿</div>
      <div className="float-mark font-display text-[70px] md:text-[100px] text-[#627eea]/[0.04] top-[45%] right-[5%] select-none" style={{ transform: `translateY(${scrollY * -0.06}px)` }} aria-hidden>Ξ</div>

      {/* ── Nav ──────────────────────────────────── */}
      <motion.nav
        initial={{ y: -12, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", damping: 20, stiffness: 90 }}
        className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.04] bg-[#1E2526]/80 backdrop-blur-xl"
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#19BEA4] font-display text-sm font-bold text-[#1E2526] transition-colors group-hover:bg-[#22D4B7]">G</div>
            <span className="font-display text-lg font-bold text-[#D7FAFC] tracking-tight">Gambit</span>
          </Link>
          <div className="hidden items-center gap-1 md:flex">
            {[{ href: "/arena", label: "Arena" }, { href: "/create", label: "Create" }, { href: "/portfolio", label: "Portfolio" }].map((l) => (
              <Link key={l.href} href={l.href} className="min-h-[44px] min-w-[44px] flex items-center rounded-lg px-3.5 py-2 font-ui text-sm text-gray-400 transition-colors hover:bg-white/[0.04] hover:text-[#D7FAFC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#19BEA4]">{l.label}</Link>
            ))}
          </div>
          <CustomConnectButton className="min-h-[44px] min-w-[44px] rounded-lg bg-[#19BEA4] px-4 py-2 font-display text-sm font-semibold text-[#1E2526] transition-all hover:bg-[#22D4B7] hover:shadow-lg hover:shadow-[#19BEA4]/20 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#19BEA4] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1E2526] cursor-pointer" />
        </div>
      </motion.nav>

      {/* ════════════════════════════════════════════
          HERO
         ════════════════════════════════════════════ */}
      <section className="relative z-10 flex flex-col items-center pt-[88px] pb-6 px-5 text-center">
        {/* Badge */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mb-4">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#19BEA4]/12 bg-[#19BEA4]/[0.04] px-3 py-1 font-mono text-[10px] text-[#19BEA4]/60 tracking-wider uppercase">
            <span className="h-1.5 w-1.5 rounded-full bg-[#19BEA4] animate-pulse-dot" />
            Live on Somnia Testnet
          </span>
        </motion.div>

        {/* H1: Gambit — Unbounded */}
        <motion.h1
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", damping: 18, stiffness: 80, delay: 0.08 }}
          className="font-display text-[clamp(3rem,8vw,6rem)] font-black leading-none tracking-[-0.04em] text-[#D7FAFC] mb-3"
        >
          Gambit
        </motion.h1>

        {/* Subtitle — serif italic */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
          className="font-serif italic text-[clamp(1rem,2vw,1.35rem)] leading-snug text-[#D7FAFC]/60 max-w-[500px] mb-2"
        >
          <p>DreamDEX gives you the market.</p>
          <p>Gambit gives you someone to trade against.</p>
        </motion.div>

        {/* Whisper */}
        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
          className="font-ui text-[13px] text-gray-500 mb-5"
        >
          Pick a side. Stake STT. Winner takes all.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="flex gap-2.5 mb-7"
        >
          <Link href="/create" className="min-h-[42px] inline-flex items-center justify-center rounded-lg bg-[#D7FAFC] px-6 py-2 font-display text-[12px] font-bold text-[#1E2526] transition-all hover:bg-[#B0F0F5] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D7FAFC] relative overflow-hidden group cursor-pointer">
            <span className="shimmer absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            <span className="relative z-10">Create a Duel</span>
          </Link>
          <Link href="/arena" className="min-h-[42px] inline-flex items-center justify-center rounded-lg border border-[#19BEA4]/20 bg-[#19BEA4]/[0.04] px-6 py-2 font-display text-[12px] font-semibold text-[#D7FAFC]/80 transition-all hover:bg-[#19BEA4]/[0.08] hover:text-[#D7FAFC] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#19BEA4] cursor-pointer">
            Browse Arena
          </Link>
        </motion.div>

        {/* Duel table */}
        <motion.div
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", damping: 22, stiffness: 70, delay: 0.42 }}
          className="w-full"
        >
          <DuelTable
            matchup={matchup}
            viewState="create"
            onFlipSide={() => {}}
            onSeatClick={(h) => setSeatPopover(seatPopover === h ? null : h)}
            onPotClick={() => setPotHint(!potHint)}
          />
          {seatPopover && (
            <div className="relative flex justify-center">
              <SeatPopover
                handle={seatPopover}
                wins={seatPopover === "Satoshi" ? 12 : seatPopover === "Whale_0x" ? 8 : seatPopover === "Vitalik" ? 15 : 6}
                losses={seatPopover === "Satoshi" ? 5 : seatPopover === "Whale_0x" ? 7 : seatPopover === "Vitalik" ? 3 : 9}
                onClose={() => setSeatPopover(null)}
              />
            </div>
          )}
          {potHint && (
            <div className="text-center mt-1 chip-slide">
              <span className="font-mono text-[10px] text-[#D7FAFC]/30">Expires when DreamDEX resolves · no early withdrawal</span>
            </div>
          )}
        </motion.div>
      </section>

      {/* ════════════════════════════════════════════
          OPEN CHALLENGES
         ════════════════════════════════════════════ */}
      <section className="relative z-10 py-6 px-5 border-t border-white/[0.04]">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-bold text-[#D7FAFC]">Open Challenges</h2>
            <Link href="/arena" className="font-ui text-[11px] text-[#19BEA4]/60 hover:text-[#19BEA4] transition-colors hidden sm:inline">View all →</Link>
          </div>
          <div className="arena-scroll flex gap-2.5 overflow-x-auto pb-1">
            {MATCHUPS.map((m) => (
              <ArenaCard key={m.id} m={m} active={m.id === activeId} onSelect={() => setActiveId(m.id)} maxTime={maxTime} />
            ))}
            <Link href="/create" className="flex-shrink-0 w-[190px] md:w-[210px] rounded-xl border border-dashed border-[#19BEA4]/15 bg-[#19BEA4]/[0.015] p-3 flex flex-col items-center justify-center text-center min-h-[130px] hover:border-[#19BEA4]/30 transition-colors">
              <span className="text-[#19BEA4]/30 text-xl mb-0.5">+</span>
              <p className="font-ui text-[11px] text-[#19BEA4]/50 font-medium">Create a Duel</p>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Demoted ticker ──────────────────────── */}
      <section className="relative z-10 border-y border-white/[0.03] bg-[#1E2526]/30 overflow-hidden">
        <div className="py-2 overflow-hidden">
          <div className="flex gap-6 whitespace-nowrap animate-ticker">
            {[...TICKER, ...TICKER].map((row, i) => (
              <span key={i} className="flex items-center gap-1 font-mono text-[9px] text-gray-600">
                <span className={`font-semibold ${row.side === "up" ? "text-[#6fcf97]/60" : "text-[#e07a7a]/60"}`}>
                  {row.side === "up" ? "▲" : "▼"} {row.asset}
                </span>
                <span>{row.stake}</span>
                <span className="text-gray-700">·</span>
                <span>{row.who}</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          HOW IT WORKS — cinematic panels
         ════════════════════════════════════════════ */}
      <HowItWorks />

      {/* ════════════════════════════════════════════
          STATS
         ════════════════════════════════════════════ */}
      <section className="relative z-10 py-8 px-5 border-t border-white/[0.04]">
        <div className="mx-auto max-w-2xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Duels Fought", to: 156, dec: 0, sfx: "" },
              { label: "STT Volume", to: 89, dec: 1, sfx: " STT" },
              { label: "Players", to: 42, dec: 0, sfx: "" },
              { label: "Win Rate", to: 67, dec: 0, sfx: "%" },
            ].map((stat) => (
              <motion.div key={stat.label} initial={{ opacity: 0, y: 6 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }} className="flex flex-col items-center gap-0.5">
                <CountUp to={stat.to} suffix={stat.sfx} decimals={stat.dec} />
                <span className="font-ui text-[10px] uppercase tracking-wider text-gray-500">{stat.label}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────── */}
      <footer className="relative z-10 border-t border-white/[0.04] py-5 px-5">
        <div className="mx-auto max-w-6xl flex flex-col md:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-[#19BEA4] font-display text-[10px] font-bold text-[#1E2526]">G</div>
            <span className="font-ui text-[11px] text-gray-500">Gambit on Somnia</span>
          </div>
          <p className="font-ui text-[10px] text-gray-600">Built for the Somnia × DreamDEX Event Contracts Hackathon</p>
        </div>
      </footer>
    </div>
  );
}
