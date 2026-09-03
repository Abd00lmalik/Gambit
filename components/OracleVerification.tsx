"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { Address } from "viem";
import { fetchOracleQuestionId } from "@/lib/dreamdex";

interface OracleVerificationProps {
  marketAddress: Address;
}

const ORACLE_EXPLORER_URL = "https://prd.oracle.somnia.host/questions";

export default function OracleVerification({
  marketAddress,
}: OracleVerificationProps) {
  const [oracleQuestionId, setOracleQuestionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetchOracleQuestionId(marketAddress).then((id) => {
      if (!cancelled) {
        setOracleQuestionId(id);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [marketAddress]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
        <div className="h-3 w-3 rounded-full bg-gray-500 animate-pulse" />
        <span className="font-body text-xs text-gray-400">Loading oracle data...</span>
      </div>
    );
  }

  if (!oracleQuestionId) {
    return null;
  }

  const verificationUrl = `${ORACLE_EXPLORER_URL}/${oracleQuestionId}?view=graph`;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-lg border border-teal/20 bg-teal/5 p-3"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-teal" />
          <span className="font-body text-xs text-gray-400">
            Resolution verified by DreamDEX Oracle
          </span>
        </div>
        <a
          href={verificationUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-lg border border-teal/30 bg-teal/10 px-3 py-1.5 font-body text-xs font-medium text-teal transition-all hover:bg-teal/20 hover:border-teal/50"
        >
          <svg
            className="h-3 w-3"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
            />
          </svg>
          Verify Resolution
        </a>
      </div>
      <p className="font-mono text-[10px] text-gray-500 mt-1.5">
        Oracle ID: {oracleQuestionId}
      </p>
    </motion.div>
  );
}
