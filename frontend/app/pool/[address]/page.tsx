"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";

export default function SquadPoolDetailPage() {
  useEffect(() => {
    // Redirect to pool landing page after 2s
    const t = setTimeout(() => {
      window.location.href = "/pool";
    }, 2000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center py-8 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-lg w-full text-center"
      >
        <div className="h-16 w-16 rounded-full bg-purple-500/15 flex items-center justify-center mx-auto mb-6">
          <span className="text-3xl">🎯</span>
        </div>
        <h1 className="font-display text-3xl md:text-4xl font-bold text-foam mb-3">
          Squad Pools
        </h1>
        <p className="font-body text-gray-400 mb-6">
          Multi-player parimutuel pools are launching post-hackathon.
        </p>
        <div className="rounded-2xl border border-purple-500/30 bg-purple-500/5 p-6 mb-6">
          <p className="font-display text-lg font-bold text-purple-400 mb-2">
            Coming Soon
          </p>
          <p className="font-body text-sm text-gray-400">
            Redirecting to the main page…
          </p>
        </div>
        <a
          href="/pool"
          className="inline-block rounded-xl bg-foam px-6 py-2.5 font-display text-sm font-bold text-carbon transition-all hover:bg-foam-dark"
        >
          Go to Squad Pools
        </a>
      </motion.div>
    </div>
  );
}
