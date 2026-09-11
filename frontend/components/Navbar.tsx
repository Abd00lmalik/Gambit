"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useAccount } from "wagmi";
import CustomConnectButton from "./CustomConnectButton";
import PlayerAvatar from "./PlayerAvatar";
import LogoMark from "./LogoMark";

export default function Navbar() {
  const { address } = useAccount();
  const pathname = usePathname();

  return (
    <>
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", damping: 20, stiffness: 90 }}
        className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-carbon/70 backdrop-blur-xl"
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2.5 group">
            <LogoMark className="h-9 w-9 transition-all duration-200 group-hover:scale-105" />
            <span className="font-display text-xl font-bold text-foam">
              Gambit
            </span>
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            <NavLink href="/arena" pathname={pathname}>Arena</NavLink>
            <NavLink href="/create" pathname={pathname}>Create Duel</NavLink>
            <NavLink href="/portfolio" pathname={pathname}>Portfolio</NavLink>
          </div>

          <div className="flex items-center gap-3">
            {address && (
              <Link href={`/u/${address}`} aria-label="Your profile" className="cursor-pointer transition-transform hover:scale-110">
                <PlayerAvatar address={address} size="sm" />
              </Link>
            )}
            <CustomConnectButton />
          </div>
        </div>
      </motion.nav>

      {/* Mobile bottom tab bar — the only nav surface on small screens */}
      <MobileTabBar pathname={pathname} address={address} />
    </>
  );
}

function NavLink({ href, pathname, children }: { href: string; pathname: string; children: React.ReactNode }) {
  const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
  return (
    <Link
      href={href}
      className={`min-h-[44px] min-w-[44px] flex items-center rounded-lg px-4 py-2 font-body text-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal cursor-pointer ${
        isActive
          ? "bg-teal/10 text-teal font-semibold"
          : "text-gray-300 hover:bg-white/5 hover:text-teal"
      }`}
    >
      {children}
    </Link>
  );
}

function MobileTabBar({ pathname, address }: { pathname: string; address?: string }) {
  const tabs = [
    { href: "/arena", label: "Arena", icon: IconArena },
    { href: "/create", label: "Create", icon: IconCreate },
    ...(address
      ? [{ href: `/u/${address}`, label: "Profile", icon: IconProfile }]
      : []),
    { href: "/portfolio", label: "Portfolio", icon: IconPortfolio },
  ];
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-carbon/90 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-stretch justify-around">
        {tabs.map((tab) => {
          const isActive =
            pathname === tab.href ||
            (tab.href !== "/" && pathname.startsWith(tab.href));
          const Icon = tab.icon;
          return (
            <Link
              key={tab.label}
              href={tab.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 font-body text-[10px] transition-colors cursor-pointer ${
                isActive ? "text-teal font-semibold" : "text-gray-400 hover:text-foam"
              }`}
            >
              <Icon active={isActive} />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function IconArena({ active }: { active?: boolean }) {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={active ? 2.2 : 1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  );
}

function IconCreate({ active }: { active?: boolean }) {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={active ? 2.2 : 1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

function IconProfile({ active }: { active?: boolean }) {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={active ? 2.2 : 1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  );
}

function IconPortfolio({ active }: { active?: boolean }) {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={active ? 2.2 : 1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  );
}
