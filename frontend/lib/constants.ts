export const COLORS = {
  carbon: { DEFAULT: "#1E2526", light: "#2A3334", lighter: "#354042" },
  teal: { DEFAULT: "#19BEA4", dark: "#149E89", light: "#22D4B7" },
  foam: { DEFAULT: "#D7FAFC", dark: "#B0F0F5" },
  up: { DEFAULT: "#22C55E", muted: "#16A34A" },
  down: { DEFAULT: "#EF4444", muted: "#DC2626" },
} as const;

export const STAKE_OPTIONS = [0.1, 0.5, 1, 2.5, 5] as const;

export const INTERVAL_OPTIONS = ["5m", "15m", "1h", "4h"] as const;

export const ASSET_INFO = {
  BTC: {
    name: "Bitcoin",
    symbol: "BTC",
    icon: "/icons/btc.svg",
    decimals: 8,
  },
  ETH: {
    name: "Ethereum",
    symbol: "ETH",
    icon: "/icons/eth.svg",
    decimals: 18,
  },
} as const;

export const DUELS_PER_PAGE = 12;

export const STATUS_LABELS = {
  OPEN: "Open",
  ACTIVE: "Live",
  SETTLED: "Settled",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
} as const;

export const STATUS_COLORS = {
  OPEN: "text-teal",
  ACTIVE: "text-foam animate-glow-pulse",
  SETTLED: "text-gray-400",
  CANCELLED: "text-gray-500",
  REFUNDED: "text-yellow-500",
} as const;
