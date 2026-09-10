"use client";

import { motion, AnimatePresence } from "framer-motion";

export type ResultKind = "won" | "lost" | "void";

interface ResultPopupProps {
  show: boolean;
  kind: ResultKind;
  pot?: string;
  onDismiss: () => void;
  onClaim?: () => void;
  claiming?: boolean;
}

const COPY: Record<ResultKind, { title: string; accent: string; ring: string; glow: string }> = {
  won: {
    title: "You Won!",
    accent: "text-up",
    ring: "border-up/40",
    glow: "shadow-[0_0_60px_-10px_rgba(34,197,94,0.45)]",
  },
  lost: {
    title: "You Lost",
    accent: "text-down",
    ring: "border-down/40",
    glow: "shadow-[0_0_60px_-10px_rgba(239,68,68,0.35)]",
  },
  void: {
    title: "Market Voided",
    accent: "text-yellow-400",
    ring: "border-yellow-400/40",
    glow: "shadow-[0_0_60px_-10px_rgba(250,204,21,0.35)]",
  },
};

export default function ResultPopup({ show, kind, pot, onDismiss, onClaim, claiming }: ResultPopupProps) {
  const c = COPY[kind];
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={onDismiss}
        >
          <motion.div
            initial={{ scale: 0.7, opacity: 0, y: 24 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", damping: 18, stiffness: 260 }}
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-sm rounded-2xl border bg-[#12171a] p-8 text-center ${c.ring} ${c.glow}`}
          >
            <motion.div
              initial={{ rotate: -12, scale: 0.6 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ delay: 0.1, type: "spring", damping: 12, stiffness: 200 }}
              className="text-6xl mb-4"
            >
              {kind === "won" ? "🏆" : kind === "lost" ? "💀" : "⚖️"}
            </motion.div>
            <p className={`font-display text-3xl font-bold mb-2 ${c.accent}`}>{c.title}</p>
            {kind === "won" && (
              <p className="font-body text-sm text-gray-400 mb-1">
                {pot ? <>Pot: <span className="text-foam font-semibold">{pot} STT</span> · after 2.5% fee <span className="text-up font-semibold">{(parseFloat(pot) * 0.975).toFixed(3)} STT</span></> : "Winner takes the pot."}
              </p>
            )}
            {kind === "lost" && <p className="font-body text-sm text-gray-400 mb-1">Better luck next duel.</p>}
            {kind === "void" && (
              <p className="font-body text-sm text-gray-400 mb-1">Market split/voided — both stakes are refunded on settle.</p>
            )}
            <div className="mt-6 flex flex-col gap-2">
              {kind === "won" && onClaim && (
                <button
                  disabled={claiming}
                  onClick={onClaim}
                  className="min-h-[48px] w-full rounded-xl bg-up py-2.5 font-display text-sm font-bold text-carbon transition-all hover:bg-up/80 active:scale-[0.98] disabled:opacity-70"
                >
                  {claiming ? "Claiming..." : "Claim Pot →"}
                </button>
              )}
              <button
                onClick={onDismiss}
                className="min-h-[40px] w-full rounded-xl border border-white/10 py-2.5 font-body text-sm text-gray-300 transition-all hover:bg-white/5"
              >
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
