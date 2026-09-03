export type Asset = string;
export type Interval = string;
export type Side = "UP" | "DOWN";
export type DuelStatus = "OPEN" | "ACTIVE" | "SETTLED" | "CANCELLED" | "REFUNDED";

export interface Duel {
  id: string;
  creator: User;
  joiner?: User;
  asset: Asset;
  interval: Interval;
  side: Side;
  stake: number;
  strike: number;
  status: DuelStatus;
  winner?: string;
  joinDeadline: number;
  marketExpiry: number;
  contractAddress: string;
  createdAt: number;
}

export interface User {
  address: string;
  name?: string;
  avatar: string;
  wins: number;
  losses: number;
  streak: number;
  biggestWin: number;
  favoriteAsset: Asset;
  recentDuels: Duel[];
}

export interface LivePrice {
  asset: Asset;
  price: number;
  change24h: number;
  changePercent: number;
  upProbability: number;
}

export interface MarketQuestion {
  text: string;
  asset: Asset;
  interval: Interval;
  strike: number;
  expiry: number;
}
