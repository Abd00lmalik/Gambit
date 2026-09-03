import { type Duel, type User, type LivePrice } from "./types";

const NOW = Math.floor(Date.now() / 1000);

export const mockUsers: User[] = [
  {
    address: "0xF241F1A68878996aB1484f27099395c46796bC90",
    name: "Satoshi",
    avatar: "/avatars/avatar1.png",
    wins: 23,
    losses: 8,
    streak: 4,
    biggestWin: 9.5,
    favoriteAsset: "BTC",
    recentDuels: [],
  },
  {
    address: "0x0022EC010030158cC27B283BA640706eDBa6080f",
    name: "Vitalik",
    avatar: "/avatars/avatar2.png",
    wins: 17,
    losses: 12,
    streak: -2,
    biggestWin: 7.2,
    favoriteAsset: "ETH",
    recentDuels: [],
  },
  {
    address: "0x3A86bf9F36Bf9a5cF3C7C2b93e17C2c8f6A4dE12",
    name: "Whale_0x",
    avatar: "/avatars/avatar3.png",
    wins: 41,
    losses: 19,
    streak: 7,
    biggestWin: 25.0,
    favoriteAsset: "BTC",
    recentDuels: [],
  },
  {
    address: "0x7B2c9e8F4aD1234567890abcdef1234567890AB",
    name: "DegenTrader",
    avatar: "/avatars/avatar4.png",
    wins: 9,
    losses: 14,
    streak: -5,
    biggestWin: 4.8,
    favoriteAsset: "ETH",
    recentDuels: [],
  },
  {
    address: "0x9F4567890AbCdEf1234567890aBcDeF123456789",
    name: "CryptoKnight",
    avatar: "/avatars/avatar5.png",
    wins: 31,
    losses: 11,
    streak: 3,
    biggestWin: 15.0,
    favoriteAsset: "BTC",
    recentDuels: [],
  },
];

export const mockDuels: Duel[] = [
  {
    id: "1",
    creator: mockUsers[0],
    asset: "BTC",
    interval: "15m",
    side: "UP",
    stake: 0.5,
    strike: 78665.63,
    status: "OPEN",
    joinDeadline: NOW + 3600,
    marketExpiry: NOW + 5400,
    contractAddress: "0xe9778d6c95eaf7479759a1f30de188aee09509cd",
    createdAt: NOW - 600,
  },
  {
    id: "2",
    creator: mockUsers[2],
    asset: "ETH",
    interval: "1h",
    side: "DOWN",
    stake: 2.5,
    strike: 3245.18,
    status: "OPEN",
    joinDeadline: NOW + 7200,
    marketExpiry: NOW + 9000,
    contractAddress: "0xa1b2c3d4e5f6789012345678abcdef1234567890",
    createdAt: NOW - 300,
  },
  {
    id: "3",
    creator: mockUsers[4],
    asset: "BTC",
    interval: "15m",
    side: "UP",
    stake: 1.0,
    strike: 78600.0,
    status: "OPEN",
    joinDeadline: NOW + 1800,
    marketExpiry: NOW + 3600,
    contractAddress: "0xb2c3d4e5f6789012345678abcdef012345678901",
    createdAt: NOW - 120,
  },
  {
    id: "4",
    creator: mockUsers[0],
    asset: "ETH",
    interval: "15m",
    side: "DOWN",
    stake: 0.5,
    strike: 3250.0,
    status: "OPEN",
    joinDeadline: NOW + 2400,
    marketExpiry: NOW + 4200,
    contractAddress: "0xc3d4e5f6789012345678abcdef0123456789012",
    createdAt: NOW - 90,
  },
  {
    id: "5",
    creator: mockUsers[1],
    asset: "BTC",
    interval: "1h",
    side: "UP",
    stake: 5.0,
    strike: 79000.0,
    status: "ACTIVE",
    joiner: mockUsers[3],
    joinDeadline: NOW - 1800,
    marketExpiry: NOW + 1800,
    contractAddress: "0xd4e5f6789012345678abcdef012345678901234",
    createdAt: NOW - 7200,
  },
  {
    id: "6",
    creator: mockUsers[3],
    asset: "ETH",
    interval: "15m",
    side: "UP",
    stake: 1.0,
    strike: 3240.0,
    status: "ACTIVE",
    joiner: mockUsers[4],
    joinDeadline: NOW - 600,
    marketExpiry: NOW + 600,
    contractAddress: "0xe5f6789012345678abcdef01234567890123456",
    createdAt: NOW - 3600,
  },
  {
    id: "7",
    creator: mockUsers[2],
    asset: "BTC",
    interval: "15m",
    side: "DOWN",
    stake: 2.5,
    strike: 78700.0,
    status: "ACTIVE",
    joiner: mockUsers[0],
    joinDeadline: NOW - 900,
    marketExpiry: NOW + 900,
    contractAddress: "0xf6789012345678abcdef01234567890123456789",
    createdAt: NOW - 5400,
  },
  {
    id: "8",
    creator: mockUsers[0],
    asset: "ETH",
    interval: "1h",
    side: "UP",
    stake: 0.5,
    strike: 3200.0,
    status: "SETTLED",
    joiner: mockUsers[1],
    winner: mockUsers[0].address,
    joinDeadline: NOW - 10800,
    marketExpiry: NOW - 7200,
    contractAddress: "0x6789012345678abcdef012345678901234567890",
    createdAt: NOW - 14400,
  },
  {
    id: "9",
    creator: mockUsers[1],
    asset: "BTC",
    interval: "15m",
    side: "DOWN",
    stake: 1.0,
    strike: 78500.0,
    status: "SETTLED",
    joiner: mockUsers[4],
    winner: mockUsers[4].address,
    joinDeadline: NOW - 12600,
    marketExpiry: NOW - 9000,
    contractAddress: "0x789012345678abcdef0123456789012345678901",
    createdAt: NOW - 16200,
  },
  {
    id: "10",
    creator: mockUsers[3],
    asset: "BTC",
    interval: "1h",
    side: "UP",
    stake: 0.1,
    strike: 79200.0,
    status: "SETTLED",
    joiner: mockUsers[2],
    winner: mockUsers[2].address,
    joinDeadline: NOW - 18000,
    marketExpiry: NOW - 14400,
    contractAddress: "0x89012345678abcdef01234567890123456789012",
    createdAt: NOW - 21600,
  },
  {
    id: "11",
    creator: mockUsers[4],
    asset: "ETH",
    interval: "15m",
    side: "DOWN",
    stake: 5.0,
    strike: 3280.0,
    status: "SETTLED",
    joiner: mockUsers[0],
    winner: mockUsers[0].address,
    joinDeadline: NOW - 20000,
    marketExpiry: NOW - 16000,
    contractAddress: "0x9012345678abcdef012345678901234567890123",
    createdAt: NOW - 24000,
  },
  {
    id: "12",
    creator: mockUsers[0],
    asset: "BTC",
    interval: "15m",
    side: "UP",
    stake: 0.5,
    strike: 78800.0,
    status: "CANCELLED",
    joinDeadline: NOW - 3600,
    marketExpiry: NOW - 1800,
    contractAddress: "0x012345678abcdef0123456789012345678901234",
    createdAt: NOW - 7200,
  },
  {
    id: "13",
    creator: mockUsers[1],
    asset: "ETH",
    interval: "1h",
    side: "UP",
    stake: 1.0,
    strike: 3300.0,
    status: "REFUNDED",
    joiner: mockUsers[3],
    joinDeadline: NOW - 25000,
    marketExpiry: NOW - 21000,
    contractAddress: "0x12345678abcdef01234567890123456789012345",
    createdAt: NOW - 28800,
  },
  {
    id: "14",
    creator: mockUsers[2],
    asset: "BTC",
    interval: "15m",
    side: "UP",
    stake: 0.5,
    strike: 78750.0,
    status: "OPEN",
    joinDeadline: NOW + 4800,
    marketExpiry: NOW + 6600,
    contractAddress: "0x2345678abcdef012345678901234567890123456",
    createdAt: NOW - 60,
  },
  {
    id: "15",
    creator: mockUsers[4],
    asset: "ETH",
    interval: "15m",
    side: "DOWN",
    stake: 2.5,
    strike: 3260.0,
    status: "OPEN",
    joinDeadline: NOW + 1200,
    marketExpiry: NOW + 3000,
    contractAddress: "0x345678abcdef0123456789012345678901234567",
    createdAt: NOW - 45,
  },
];

export const mockLivePrices: LivePrice[] = [
  { asset: "BTC", price: 78665.63, change24h: -215.3, changePercent: -0.27, upProbability: 0.46 },
  { asset: "ETH", price: 3245.18, change24h: 42.18, changePercent: 1.32, upProbability: 0.58 },
];

export function getDuelsByStatus(status: Duel["status"]): Duel[] {
  return mockDuels.filter((d) => d.status === status);
}

export function getDuelsByUser(address: string): Duel[] {
  return mockDuels.filter(
    (d) => d.creator.address === address || d.joiner?.address === address
  );
}

export function getDuelById(id: string): Duel | undefined {
  return mockDuels.find((d) => d.id === id);
}

export function getUserByAddress(address: string): User | undefined {
  return mockUsers.find((u) => u.address === address);
}

export function formatAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function formatStake(stake: number): string {
  return `${stake} STT`;
}

export function formatPrice(price: number, asset: string): string {
  if (asset === "BTC") return `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function getMarketQuestion(asset: string, interval: string, strike: number): string {
  if (interval === "15m") {
    const expiry = new Date(Date.now() + 15 * 60 * 1000);
    const timeStr = expiry.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "UTC", hour12: false });
    return `Will ${asset} settle above $${strike.toLocaleString("en-US", { minimumFractionDigits: 2 })} at ${timeStr} UTC?`;
  }
  return `${asset} closes at or above its opening price · settles in 1 hour`;
}
