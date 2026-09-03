"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useConnect, useAccount, useDisconnect } from "wagmi";
import { motion, AnimatePresence } from "framer-motion";

function WalletIcon({ name }: { name: string }) {
  const lower = name.toLowerCase();

  // MetaMask — real fox SVG (from RainbowKit)
  if (lower.includes("metamask")) {
    return (
      <svg viewBox="0 0 318.6 318.6" className="h-7 w-7">
        <path fill="#E2761B" stroke="#E2761B" strokeLinecap="round" strokeLinejoin="round" d="m274.1 35.5-99.5 73.9L193 65.8z"/>
        <path fill="#E2761B" stroke="#E2761B" strokeLinecap="round" strokeLinejoin="round" d="m44.4 35.5 98.7 74.6-17.5-44.3zm193.9 171.3-26.5 40.6 56.7 15.6 16.3-55.3zm-204.4.9L50.1 263l56.7-15.6-26.5-40.6z"/>
        <path fill="#E2761B" stroke="#E2761B" strokeLinecap="round" strokeLinejoin="round" d="m103.6 138.2-15.8 23.9 56.3 2.5-2-60.5zm111.3 0-39-34.8-1.3 61.2 56.2-2.5zM106.8 247.4l33.8-16.5-29.2-22.8zm71.1-16.5 33.9 16.5-4.7-39.3z"/>
        <path fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round" d="m87.8 162.1 23.6 46-.8-22.9zm120.3 23.1-1 22.9 23.7-46zm-64-20.6-5.3 28.9 6.6 34.1 1.5-44.9zm30.5 0-2.7 18 1.2 45 6.7-34.1z"/>
        <path fill="#F6851B" stroke="#F6851B" strokeLinecap="round" strokeLinejoin="round" d="m179.8 193.5-6.7 34.1 4.8 3.3 29.2-22.8 1-22.9zm-69.2-8.3.8 22.9 29.2 22.8 4.8-3.3-6.6-34.1z"/>
        <path fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round" d="m278.3 114.2 8.5-40.8-12.7-37.9-96.2 71.4 37 31.3 52.3 15.3 11.6-13.5-5-3.6 8-7.3-6.2-4.8 8-6.1zM31.8 73.4l8.5 40.8-5.4 4 8 6.1-6.1 4.8 8 7.3-5 3.6 11.5 13.5 52.3-15.3 37-31.3-96.2-71.4z"/>
        <path fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round" d="m267.2 153.5-52.3-15.3 15.9 23.9-23.7 46 31.2-.4h46.5zm-163.6-15.3-52.3 15.3-17.4 54.2h46.4l31.1.4-23.6-46zm71 26.4 3.3-57.7 15.2-41.1h-67.5l15 41.1 3.5 57.7 1.2 18.2.1 44.8h27.7l.2-44.8z"/>
        <path fill="#D7C1B3" stroke="#D7C1B3" strokeLinecap="round" strokeLinejoin="round" d="m211.8 247.4-33.9-16.5 2.7 22.1-.3 9.3zm-105 0 31.5 14.9-.2-9.3 2.5-22.1z"/>
        <path fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round" d="m106.8 247.4 4.8-40.6-31.3.9zM207 206.8l4.8 40.6 26.5-39.7z"/>
        <path fill="#CD6116" stroke="#CD6116" strokeLinecap="round" strokeLinejoin="round" d="m23.8 168.8 28.3 14.1-20.1 18.2zm193.4 0-28.3 14.1 20.1 18.2z"/>
        <path fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round" d="m106.8 247.4 33.8-16.5-29.2-22.8zm71.1-16.5 33.9 16.5-4.7-39.3z"/>
        <path fill="#233447" stroke="#233447" strokeLinecap="round" strokeLinejoin="round" d="m138.8 193.5-28.2-8.3 19.9-9.1zm40.9 0 8.3-17.4 20 9.1z"/>
        <path fill="#CD6116" stroke="#CD6116" strokeLinecap="round" strokeLinejoin="round" d="m106.8 247.4 4.8-40.6-31.3.9zM207 206.8l4.8 40.6 26.5-39.7z"/>
        <path fill="#C0AD9E" stroke="#C0AD9E" strokeLinecap="round" strokeLinejoin="round" d="m180.3 262.3.3-9.3-2.5-2.2h-37.7l-2.3 2.2.2 9.3-31.5-14.9 11 9 22.3 15.5h38.3l22.4-15.5 11-9z"/>
        <path fill="#161616" stroke="#161616" strokeLinecap="round" strokeLinejoin="round" d="m177.9 230.9-4.8-3.3h-27.7l-4.8 3.3-2.5 22.1 2.3-2.2h37.7l2.5 2.2z"/>
        <path fill="#763D16" stroke="#763D16" strokeLinecap="round" strokeLinejoin="round" d="m278.3 114.2 8.5-40.8-12.7-37.9-96.2 71.4 37 31.3 52.3 15.3 11.6-13.5-5-3.6 8-7.3-6.2-4.8 8-6.1zM31.8 73.4l8.5 40.8-5.4 4 8 6.1-6.1 4.8 8 7.3-5 3.6 11.5 13.5 52.3-15.3 37-31.3-96.2-71.4z"/>
        <path fill="#F6851B" stroke="#F6851B" strokeLinecap="round" strokeLinejoin="round" d="m267.2 153.5-52.3-15.3 15.9 23.9-23.7 46 31.2-.4h46.5zm-163.6-15.3-52.3 15.3-17.4 54.2h46.4l31.1.4-23.6-46zm71 26.4 3.3-57.7 15.2-41.1h-67.5l15 41.1 3.5 57.7 1.2 18.2.1 44.8h27.7l.2-44.8z"/>
      </svg>
    );
  }

  // Rabby — real logo (from RainbowKit / RabbyHub)
  if (lower.includes("rabby")) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 28 28" className="h-7 w-7">
        <g clipPath="url(#rabby-clip)">
          <path fill="#8697FF" d="M28 0H0v28h28V0Z"/>
          <path fill="#fff" d="M22.54 15.078c.677-1.514-2.673-5.744-5.874-7.506-2.017-1.365-4.12-1.178-4.545-.579-.935 1.316 3.094 2.43 5.788 3.731-.58.252-1.125.703-1.446 1.28-1.004-1.096-3.209-2.04-5.796-1.28-1.743.513-3.191 1.721-3.751 3.546a1.097 1.097 0 1 0-.445 2.1c.112 0 .463-.075.463-.075l5.612.041c-2.244 3.56-4.018 4.081-4.018 4.698s1.697.45 2.335.22c3.05-1.1 6.327-4.531 6.89-5.519 2.36.295 4.345.33 4.786-.657Z"/>
          <path fill="url(#rabby-g)" fillRule="evenodd" d="m17.885 10.713.025.01c.125-.049.105-.233.07-.378-.078-.333-1.438-1.676-2.715-2.277-1.743-.82-3.025-.777-3.212-.398.356.726 1.998 1.408 3.714 2.12.723.3 1.46.606 2.118.923Z" clipRule="evenodd"/>
          <path fill="url(#rabby-h)" fillRule="evenodd" d="M15.701 18.036a10.296 10.296 0 0 0-1.2-.37c.482-.862.583-2.138.128-2.945-.639-1.133-1.44-1.736-3.304-1.736-1.024 0-3.783.346-3.832 2.648-.005.242 0 .464.017.667l5.036.037a17.264 17.264 0 0 1-1.871 2.483c.669.172 1.221.316 1.728.448.48.125.92.24 1.38.357a21.003 21.003 0 0 0 1.918-1.59Z" clipRule="evenodd"/>
          <path fill="url(#rabby-i)" d="M6.848 16.063c.206 1.75 1.2 2.435 3.232 2.638 2.032.203 3.197.067 4.749.208 1.296.118 2.453.778 2.882.55.386-.205.17-.947-.347-1.423-.67-.617-1.597-1.046-3.229-1.199.325-.89.234-2.138-.27-2.817-.731-.982-2.079-1.426-3.785-1.232-1.782.202-3.49 1.08-3.232 3.275Z"/>
        </g>
        <defs>
          <linearGradient id="rabby-b" x1="10.464" x2="22.394" y1="13.737" y2="17.12" gradientUnits="userSpaceOnUse"><stop stopColor="#fff"/><stop offset="1" stopColor="#fff"/></linearGradient>
          <linearGradient id="rabby-g" x1="20.386" x2="11.779" y1="13.509" y2="4.879" gradientUnits="userSpaceOnUse"><stop stopColor="#7258DC"/><stop offset="1" stopColor="#797DEA" stopOpacity="0"/></linearGradient>
          <linearGradient id="rabby-h" x1="15.94" x2="7.673" y1="18.337" y2="13.584" gradientUnits="userSpaceOnUse"><stop stopColor="#7461EA"/><stop offset="1" stopColor="#BFC2FF" stopOpacity="0"/></linearGradient>
          <linearGradient id="rabby-i" x1="11.177" x2="16.765" y1="13.648" y2="20.749" gradientUnits="userSpaceOnUse"><stop stopColor="#fff"/><stop offset=".984" stopColor="#D5CEFF"/></linearGradient>
          <clipPath id="rabby-clip"><path fill="#fff" d="M0 0h28v28H0z"/></clipPath>
        </defs>
      </svg>
    );
  }

  // Binance Wallet — real logo (from RainbowKit)
  if (lower.includes("binance") || lower.includes("bsc")) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="130" height="130" fill="none" className="h-7 w-7">
        <path fill="#000" d="M0 0h130v130H0z"/>
        <path fill="#F3BA2F" d="M45.587 57.02 65.01 37.606l19.43 19.43 11.295-11.303L65.01 15 34.284 45.725zM15 65.004l11.299-11.299 11.298 11.299L26.3 76.302zM45.587 72.983 65.01 92.406l19.43-19.43 11.303 11.287-.008.007-30.725 30.734-30.725-30.718-.016-.016zM92.403 65.006 103.7 53.708 115 65.006l-11.299 11.299z"/>
        <path fill="#F3BA2F" d="m76.471 64.998-11.46-11.469-8.476 8.475-.98.972-2.005 2.006-.016.016.016.024 11.46 11.453 11.461-11.47.008-.007z"/>
      </svg>
    );
  }

  // Zerion — real logo (from RainbowKit)
  if (lower.includes("zerion")) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 28 28" className="h-7 w-7">
        <path fill="#2962EF" d="M0 0h28v28H0z"/>
        <path fill="#fff" d="M6.073 7c-.48 0-.665.593-.262.841l10.073 6.074a.577.577 0 0 0 .758-.139l4.43-5.814c.3-.404-.004-.962-.525-.962H6.073ZM21.904 21c.48 0 .67-.596.267-.844l-10.075-6.073a.569.569 0 0 0-.751.146l-4.437 5.813c-.301.404.012.958.534.958h14.462Z"/>
      </svg>
    );
  }

  // OKX Wallet — real logo (from RainbowKit)
  if (lower.includes("okx")) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 28 28" className="h-7 w-7">
        <path fill="#000" d="M0 0h28v28H0z"/>
        <path fill="#fff" fillRule="evenodd" d="M10.819 5.556H5.93a.376.376 0 0 0-.375.375v4.888c0 .207.168.375.375.375h4.888a.376.376 0 0 0 .375-.376V5.932a.376.376 0 0 0-.376-.375Zm5.64 5.638h-4.886a.376.376 0 0 0-.376.376v4.887c0 .208.168.376.376.376h4.887a.376.376 0 0 0 .376-.375V11.57a.376.376 0 0 0-.376-.377Zm.75-5.638h4.887c.208 0 .376.168.376.375v4.888a.376.376 0 0 1-.376.375H17.21a.376.376 0 0 1-.376-.376V5.933c0-.208.169-.376.376-.376Zm-6.39 11.277H5.93a.376.376 0 0 0-.375.376v4.887c0 .208.168.376.375.376h4.888a.376.376 0 0 0 .375-.376V17.21a.376.376 0 0 0-.376-.376Zm6.39 0h4.887c.208 0 .376.169.376.376v4.887a.376.376 0 0 1-.376.376H17.21a.376.376 0 0 1-.376-.376V17.21c0-.207.169-.376.376-.376Z" clipRule="evenodd"/>
      </svg>
    );
  }

  // Coinbase Wallet — real logo (from RainbowKit)
  if (lower.includes("coinbase")) {
    return (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-7 w-7">
        <rect width="28" height="28" fill="#2C5FF6"/>
        <path fillRule="evenodd" clipRule="evenodd" d="M14 23.8C19.4124 23.8 23.8 19.4124 23.8 14C23.8 8.58761 19.4124 4.2 14 4.2C8.58761 4.2 4.2 8.58761 4.2 14C4.2 19.4124 8.58761 23.8 14 23.8ZM11.55 10.8C11.1358 10.8 10.8 11.1358 10.8 11.55V16.45C10.8 16.8642 11.1358 17.2 11.55 17.2H16.45C16.8642 17.2 17.2 16.8642 17.2 16.45V11.55C17.2 11.1358 16.8642 10.8 16.45 10.8H11.55Z" fill="white"/>
      </svg>
    );
  }

  // Generic fallback for "Injected" or unknown
  return (
    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.66 0 3-4.03 3-9s-1.34-9-3-9m0 18c-1.66 0-3-4.03-3-9s1.34-9 3-9m-9 9a9 9 0 019-9" />
    </svg>
  );
}

interface CustomConnectButtonProps {
  className?: string;
}

export default function CustomConnectButton({ className }: CustomConnectButtonProps) {
  const { connectors, connect, isPending } = useConnect();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const [showModal, setShowModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [mounted, setMounted] = useState(false);
  

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!showModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowModal(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [showModal]);

  const walletDescription = (name: string): string => {
    const lower = name.toLowerCase();
    if (lower.includes("metamask")) return "Connect using MetaMask";
    if (lower.includes("rabby")) return "Connect using Rabby";
    if (lower.includes("binance")) return "Connect using Binance Wallet";
    if (lower.includes("zerion")) return "Connect using Zerion";
    if (lower.includes("okx")) return "Connect using OKX Wallet";
    if (lower.includes("coinbase")) return "Connect using Coinbase Wallet";
    if (lower.includes("trust")) return "Connect using Trust Wallet";
    if (lower.includes("brave")) return "Connect using Brave Wallet";
    if (lower.includes("injected")) return "Connect using browser wallet";
    return `Connect using ${name}`;
  };

  if (isConnected && address) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className={className || "min-h-[44px] flex items-center rounded-lg border border-white/10 bg-white/5 px-4 py-2 font-mono text-sm text-[#D7FAFC] transition-all hover:bg-white/10 cursor-pointer"}
        >
          {address.slice(0, 6)}...{address.slice(-4)}
        </button>
        <AnimatePresence>
          {showDropdown && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-white/10 bg-[#1E2526] p-2 shadow-xl z-50"
            >
              <button
                onClick={() => {
                  disconnect();
                  setShowDropdown(false);
                }}
                className="w-full rounded-lg px-4 py-2 text-left font-body text-sm text-[#E07A7A] transition-all hover:bg-[#E07A7A]/10 cursor-pointer"
              >
                Disconnect
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  const modal = (
    <AnimatePresence>
      {showModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70"
          style={{ margin: 0, padding: "16px" }}
          onClick={() => setShowModal(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[360px] rounded-2xl border border-white/10 bg-[#1E2526] p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg font-bold text-[#D7FAFC]">
                Connect Wallet
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-white/5 hover:text-[#D7FAFC] transition-all cursor-pointer"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-1.5">
              {connectors.map((connector: any) => (
                <button
                  key={connector.uid}
                  onClick={() => {
                    connect({ connector });
                    setShowModal(false);
                  }}
                  disabled={isPending}
                  className="w-full flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 transition-all duration-150 hover:border-[#19BEA4]/30 hover:bg-[#19BEA4]/[0.04] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer group"
                >
                  <div className="h-10 w-10 rounded-xl bg-white/[0.06] flex items-center justify-center overflow-hidden shrink-0">
                    <WalletIcon name={connector.name} />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="font-display text-sm font-bold text-[#D7FAFC] truncate">
                      {connector.name}
                    </p>
                    <p className="font-body text-xs text-gray-400 truncate">
                      {walletDescription(connector.name)}
                    </p>
                  </div>
                  <svg className="h-4 w-4 text-gray-600 shrink-0 group-hover:text-[#19BEA4] transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
              ))}
            </div>

            <p className="font-body text-[10px] text-gray-500 text-center mt-4">
              By connecting, you agree to Gambit&apos;s Terms of Service
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className={className || "min-h-[44px] min-w-[44px] flex items-center rounded-lg bg-[#19BEA4] px-5 py-2.5 font-display text-sm font-bold text-[#1E2526] transition-all duration-200 hover:bg-[#22D4B7] hover:shadow-lg hover:shadow-[#19BEA4]/25 active:scale-[0.97] cursor-pointer"}
      >
        Connect Wallet
      </button>
      {mounted && createPortal(modal, document.body)}
    </>
  );
}
