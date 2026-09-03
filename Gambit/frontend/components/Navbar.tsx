"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useAccount } from "wagmi";
import CustomConnectButton from "./CustomConnectButton";

export default function Navbar() {
  const { address } = useAccount();

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", damping: 20, stiffness: 90 }}
      className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-carbon/70 backdrop-blur-xl"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal font-display text-lg font-bold text-carbon transition-all duration-200 group-hover:bg-teal-light group-hover:shadow-lg group-hover:shadow-teal/25">
            G
          </div>
          <span className="font-display text-xl font-bold text-foam">
            Gambit
          </span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          <NavLink href="/arena">Arena</NavLink>
          <NavLink href="/create">Create Duel</NavLink>
          {address && (
            <NavLink href={`/u/${address}`}>Profile</NavLink>
          )}
          <NavLink href="/portfolio">Portfolio</NavLink>
        </div>

        <div className="flex items-center gap-3">
          <CustomConnectButton />
        </div>
      </div>
    </motion.nav>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="min-h-[44px] min-w-[44px] flex items-center rounded-lg px-4 py-2 font-body text-sm text-gray-300 transition-all duration-200 hover:bg-white/5 hover:text-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal cursor-pointer"
    >
      {children}
    </Link>
  );
}
