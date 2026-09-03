import { type Address } from "viem";
import { fetchMarketsByInterval, fetchAvailableMarkets, type DreamDexMarket } from "./dreamdex";

export interface SystemChallenge {
  id: string;
  marketAddress: Address;
  asset: string;
  interval: string;
  openingPrice: number;
  expiry: number;
  suggestedStake: number;
  side: null;
  isSystemGenerated: true;
  createdAt: number;
}

const DEFAULT_STAKE = 0.5;
const CHECK_INTERVAL_MS = 15000;

let activeChallenges: SystemChallenge[] = [];
let lastCheckTime = 0;

function isMarketExpiringSoon(expiry: number, bufferSeconds: number): boolean {
  const now = Math.floor(Date.now() / 1000);
  const timeUntilExpiry = expiry - now;
  return timeUntilExpiry > 0 && timeUntilExpiry <= bufferSeconds;
}

function createSystemChallenge(
  market: DreamDexMarket,
  intervalLabel: string
): SystemChallenge {
  return {
    id: `system-${market.marketAddress}-${market.expiry}`,
    marketAddress: market.marketAddress,
    asset: market.asset,
    interval: intervalLabel,
    openingPrice: market.openingPrice ?? 0,
    expiry: market.expiry,
    suggestedStake: DEFAULT_STAKE,
    side: null,
    isSystemGenerated: true,
    createdAt: Math.floor(Date.now() / 1000),
  };
}

function getBufferSeconds(intervalSec: number): number {
  if (intervalSec <= 300) return 60;    // 5m: 1 min buffer
  if (intervalSec <= 900) return 120;   // 15m: 2 min buffer
  if (intervalSec <= 3600) return 300;  // 1h: 5 min buffer
  return 600;                           // 4h+: 10 min buffer
}

export async function updateSystemChallenges(): Promise<SystemChallenge[]> {
  const now = Math.floor(Date.now() / 1000);
  if (now - lastCheckTime < CHECK_INTERVAL_MS / 1000) {
    return activeChallenges;
  }
  lastCheckTime = now;

  // Dynamically discover available asset/interval combos from DreamDEX
  const combos = await fetchAvailableMarkets();
  const newChallenges: SystemChallenge[] = [];

  for (const combo of combos) {
    try {
      const markets = await fetchMarketsByInterval(
        combo.asset,
        combo.intervalSec,
        5
      );

      // Only markets that haven't expired yet, sorted by expiry ascending
      const active = markets
        .filter((m) => m.expiry > now)
        .sort((a, b) => a.expiry - b.expiry);

      if (active.length === 0) continue;

      // Only show the soonest-to-expire market (the one currently tradeable)
      const currentMarket = active[0];
      const challengeId = `system-${currentMarket.marketAddress}-${currentMarket.expiry}`;

      const hasChallenge = activeChallenges.some(
        (c) => c.id === challengeId
      );

      if (!hasChallenge) {
        newChallenges.push(
          createSystemChallenge(currentMarket, combo.label)
        );
      }
    } catch (e) {
      console.error(
        `Failed to fetch markets for ${combo.asset} ${combo.label}:`,
        e
      );
    }
  }

  // Only keep challenges that haven't expired, then add new ones
  activeChallenges = [
    ...activeChallenges.filter((c) => c.expiry > now),
    ...newChallenges.filter((c) => c.expiry > now),
  ];

  return activeChallenges;
}

export function getSystemChallenges(): SystemChallenge[] {
  const now = Math.floor(Date.now() / 1000);
  return activeChallenges.filter((c) => c.expiry > now);
}

export function removeSystemChallenge(id: string): void {
  activeChallenges = activeChallenges.filter((c) => c.id !== id);
}
