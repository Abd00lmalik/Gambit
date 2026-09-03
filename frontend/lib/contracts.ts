export const FACTORY_ADDRESS = "0x9e66dD3D9C75825bbe2f2D5B494cE89E08828a06" as const;
export const IMPLEMENTATION_ADDRESS = "0xEa6971C152341C0c92c292908b2215BE260114d5" as const;
export const FEE_RECIPIENT = "0x25265b9dBEb6c653b0CA281110Bb0697a9685107" as const;
export const DEX_EVENT_CONTRACTS_ADDRESS = "0x3ecC694Cef705358864a646142ac17A90E29e388" as const;
export const VENUE_ID_TESTNET = "0x679795a0195a1b76cdebb7c51d74e058aee92919b8c3389af86ef24535e8a28c" as const;
export const POOL_FACTORY_ADDRESS = "0x0000000000000000000000000000000000000000" as const; // Deploy after contract deployment

export const FACTORY_ABI = [
  {
    type: "function",
    name: "createDuel",
    inputs: [
      { name: "_marketAddress", type: "address" },
      { name: "_joinDeadline", type: "uint256" },
    ],
    outputs: [{ name: "clone", type: "address" }],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "feeRecipient",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "defaultFeeBps",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "minStake",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "maxStake",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "implementation",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "DuelCreated",
    inputs: [
      { name: "clone", type: "address", indexed: true },
      { name: "playerA", type: "address", indexed: true },
      { name: "stakeAmount", type: "uint256", indexed: false },
      { name: "marketAddress", type: "address", indexed: false },
      { name: "joinDeadline", type: "uint256", indexed: false },
    ],
  },
] as const;

export const WAGER_ABI = [
  {
    type: "function",
    name: "join",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "settle",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "refund",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "cancel",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getPot",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "joinDeadlineRemaining",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "playerA",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "playerB",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "stakeAmount",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "marketAddress",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "state",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "settlementTriggeredAt",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isReactiveSettlement",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "owner",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "feeBps",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "joinDeadline",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "deposits",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

export const POOL_FACTORY_ABI = [
  {
    type: "function",
    name: "createPool",
    inputs: [
      { name: "_marketAddress", type: "address" },
      { name: "_deadline", type: "uint256" },
    ],
    outputs: [{ name: "pool", type: "address" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "isKnownPool",
    inputs: [{ name: "pool", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "PoolCreated",
    inputs: [
      { name: "pool", type: "address", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "marketAddress", type: "address", indexed: false },
      { name: "deadline", type: "uint256", indexed: false },
      { name: "feeBps", type: "uint256", indexed: false },
    ],
  },
] as const;

export const POOL_ABI = [
  {
    type: "function",
    name: "depositUp",
    inputs: [],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "depositDown",
    inputs: [],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "resolve",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "claim",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "claimRefund",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "refund",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getPoolSplit",
    inputs: [],
    outputs: [
      { name: "upPercent", type: "uint256" },
      { name: "downPercent", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getUserDeposit",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "up", type: "uint256" },
      { name: "down", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "state",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isActive",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "upPool",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "downPool",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalPool",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "deadline",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "marketAddress",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "Deposited",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "isUp", type: "bool", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Resolved",
    inputs: [
      { name: "upWon", type: "bool", indexed: false },
      { name: "totalPool", type: "uint256", indexed: false },
      { name: "upPool", type: "uint256", indexed: false },
      { name: "downPool", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Claimed",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;

export const DREAMDEX_ABI = [
  {
    type: "function",
    name: "isResolved",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isVoided",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "payoutNumerators",
    inputs: [],
    outputs: [{ name: "", type: "uint256[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "status",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
  },
] as const;

export enum DuelState {
  CREATED = 0,
  LOCKED = 1,
  SETTLED = 2,
  REFUNDED = 3,
  CANCELLED = 4,
}

export const DUEL_STATE_LABELS: Record<DuelState, string> = {
  [DuelState.CREATED]: "Open",
  [DuelState.LOCKED]: "Locked",
  [DuelState.SETTLED]: "Settled",
  [DuelState.REFUNDED]: "Refunded",
  [DuelState.CANCELLED]: "Cancelled",
};

export const DUEL_STATE_COLORS: Record<DuelState, string> = {
  [DuelState.CREATED]: "text-[#19BEA4]",
  [DuelState.LOCKED]: "text-yellow-400",
  [DuelState.SETTLED]: "text-[#6fcf97]",
  [DuelState.REFUNDED]: "text-gray-400",
  [DuelState.CANCELLED]: "text-[#e07a7a]",
};
