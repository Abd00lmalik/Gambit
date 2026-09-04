# Gambit — Handoff Document

**Last updated:** 2026-09-04  
**Current phase:** Live on Vercel (testnet). Full E2E 1v1 duels with reactive auto-settlement working. Squad Pools contract-ready but ParimutuelPoolFactory not yet deployed.

---

## Project Summary

Gambit is a **prediction game layer** on Somnia testnet with two modes:

1. **1v1 Duels** — Two players take opposite sides of a binary bet (e.g. "Will BTC go UP in 5 minutes?"), stake STT, winner takes the pot when DreamDEX resolves. Fully functional with reactive auto-settlement (~2s latency).
2. **Squad Pools** — Pool-style prediction where a creator sets up a market and multiple participants join sides. Contract logic complete (EIP-1167 clones, depositUp/Down, pool split, resolve, claim). ParimutuelPoolFactory not yet deployed.

Gambit reads DreamDEX Event Contracts as an oracle and leverages **Somnia reactivity** (`0x0100` precompile) for automatic settlement when markets resolve.

---

## Deployed Contracts

### Factory v6 (CURRENT — ACTIVE)
| Contract | Address |
|---|---|
| GambitFactory | `0x9e66dD3D9C75825bbe2f2D5B494cE89E08828a06` |
| Implementation | `0xEa6971C152341C0c92c292908b2215BE260114d5` |
| Balance | 50 STT |

### Stranded Factories (DO NOT USE)
| Version | Address | Balance |
|---|---|---|
| v5 | `0x9E2DA7c59259552FB79f8c32539F517219834919` | 15 STT |
| v4 | `0x9d10956Bb431Ad47dBf9Da207D81d4018814B464` | 50 STT |

### ParimutuelPoolFactory (NOT DEPLOYED)
| Contract | Address |
|---|---|
| ParimutuelPoolFactory | `0x0000000000000000000000000000000000000000` (placeholder) |
| ParimutuelPool (logic) | Not deployed |

---

## Accounts

| Role | Address | Private Key |
|---|---|---|
| Player A / Owner | `0x0022EC010030158cC27B283BA640706eDBa6080f` | `0x76d73b841d6b086cf98dda0f97588ec9f463472b6f016eae73f51b966be7aed7` |
| Player B / Deployer | `0x5E2D3BD4ad0aE1CDF49DdB0F0C9C6d55790199cE6` | `0xd9c246d4b642c0d95adf60a8a6e680352b996a9d139ca9d5d4fa1f545487095a` |
| Fee Recipient | `0x25265b9dBEb6c653b0CA281110Bb0697a9685107` | — |

---

## Infrastructure

| Resource | Details |
|---|---|
| Frontend | Next.js 14.1 + React 18, deployed on **Vercel** |
| GitHub | `https://github.com/Abd00lmalik/Gambit` (branch: `main`) |
| Vercel Install | `npm install && cd frontend && npm install` |
| Vercel Build | `cd frontend && npx next build` |
| Vercel Output | `frontend/.next` |
| RPC | `https://api.infra.testnet.somnia.network` |
| Chain ID | `50312` |
| Explorer | `https://shannon-explorer.somnia.network` |
| Faucet | `https://testnet.somnia.network/` |
| DreamDEX GraphQL | `https://dev.smk.somnia.host/v1/graphql` |
| DreamDEX REST API | `https://stg.api.dreamdex.io/v0` (testnet, `/v0` prefix required) |
| DreamDEX WebSocket | `wss://stg.api.dreamdex.io/v0/ws/public` |
| DreamDEX SDK | `@somnia-chain/markets-sdk@0.29.0` |
| DreamDEX SDK Contract | `BinaryMarketsModule` at `0x3ecC694Cef705358864a646142ac17A90E29e388` |
| Oracle Explorer | `https://prd.oracle.somnia.host/questions/{oracleQuestionId}?view=graph` |
| Supabase | Connected (PostgreSQL for profiles/pfps) |
| Vercel Blob | Connected (private store, for PFP uploads) |

---

## Key Quirks & Gotchas

### Somnia-Specific
| Issue | Details |
|---|---|
| `writeContract` with value reverts | Use plain `sendTransaction({ to, value })` to trigger `receive()` |
| `cast call` with `()(rettype)` syntax fails inline | Must use script files |
| Plain ETH transfers to contracts | Require `--gas-limit 2000000` |
| Factory deploy | Requires `--gas-limit 100000000` |
| EIP-1167 clone calls | Use `--gas-limit 5000000` minimum |
| Reactivity precompile | `0x0100`, min balance 32 native, `SUBSCRIPTION_FUND = 35 ether` |

### DreamDEX-Specific
| Issue | Details |
|---|---|
| **Does NOT support SOL or SOMI** | Only BTC and ETH markets exist |
| **Supports 5m markets** | App uses 5m/15m/1h intervals |
| **`expiry: {_gt: now}` filter broken** | Returns empty results. Must sort by `expiry: desc` and filter client-side |
| **`strike` = opening price** | Label renamed to "Opening Price" across codebase |
| **`isGuaranteed: true` required** | Despite docs saying "Reserved. Pass false" |
| **`Asset`/`Interval` types are `string`** | Not literal unions — dynamic market discovery |

### Next.js / Frontend
| Issue | Details |
|---|---|
| **Next.js 14.1 + React 18** | `use()` hook NOT available (React 19 only). Params are plain objects. |
| **`setInterval` global clash** | State renamed to `selectedInterval` in create/page.tsx |
| **`@vercel/postgres` SSR crash** | `db.ts` uses `require()` with try/catch to avoid SSR failures |
| **Vercel Blob is PRIVATE** | PFP upload uses `access: "private"`, stored signed URL in DB |
| **Room code system** | 6-char code derived from pool address (`poolAddress.slice(2,8)`) |
| **Repo structure** | `frontend/` directory at root. Vercel: install/build in nested dir |

---

## Test Status

**53 Forge tests passing** (36 Wager + 17 ParimutuelPool)

### Wager Tests (36)
- Happy path (YES win, NO win)
- Void/refund path
- Cancel/timeout path
- Fee math (zero fee, high fee, rounding)
- Overpayment prevention
- Edge cases (already joined, self-duel, deadline, insufficient deposit, not resolved, fee cap, getPot)
- Admin withdraw() — owner-gated, 6 tests
- Subscription reclaim logic — `_reclaimSubscriptionFund()` in settle/refund/cancel paths
- Void-aware auto-refund — `_onEvent()` checks `isVoided()`, refunds both stakes

### ParimutuelPool Tests (17)
- Pool creation, depositUp, depositDown
- Resolve, claim, refund
- Deadline and join limits

---

## Frontend Architecture

### Pages
| Route | Description |
|---|---|
| `/` | Landing page |
| `/arena` | Duel lobby — shows active on-chain duels, 1v1 vs Squad creation selector |
| `/create` | Duel creation — 1v1 or Squad Pool mode, BTC/ETH, 5m/15m/1h, real order book sentiment |
| `/pool` | Squad Pool creation — hardcoded BTC/ETH, 5m/15m/1h intervals |
| `/pool/[address]` | Squad Pool detail — invite banner, room code, participant identities, pool split bar, squad tally |
| `/duel/[id]` | Live duel view — countdown, settlement, real-time price chart |
| `/u/[address]` | Profile page — PFP upload, username, bio, duel history |
| `/portfolio` | User's duel portfolio |
| `/stats` | Global stats |

### Key Components
| Component | File | Description |
|---|---|---|
| `MarketSentimentBar` | `components/MarketSentimentBar.tsx` | DreamDEX order book sentiment with 15s refresh |
| `OracleVerification` | `components/OracleVerification.tsx` | Deep-link to DreamDEX oracle explorer |
| `SettlementLatency` | `components/SettlementLatency.tsx` | Color-coded auto-settlement latency display |
| `LiveChart` | `components/LiveChart.tsx` | TradingView chart |
| `CountdownTimer` | `components/CountdownTimer.tsx` | Countdown to market expiry |
| `AssetIcon` | `components/AssetIcon.tsx` | Real Bitcoin/Ethereum SVGs + generic fallback |
| `CustomConnectButton` | `components/CustomConnectButton.tsx` | Wagmi-based wallet connection (injected connector) |
| `PfpUpload` | `components/PfpUpload.tsx` | PFP upload component |

### Key Hooks
| Hook | File | Description |
|---|---|---|
| `useLivePrices` | `hooks/useLivePrices.ts` | Live ticker price from DreamDEX GraphQL |
| `useMarketSentiment` | `hooks/useMarketSentiment.ts` | Real order book sentiment (UP/DOWN %) |
| `useDuelEvents` | `hooks/useDuelEvents.ts` | Duel event polling with `isInitialLoad` ref (prevents flickering) |
| `useContracts` | `hooks/useContracts.ts` | Contract read/write hooks |
| `useIntervalTimer` | `hooks/useMarkets.ts` | Countdown timer for market intervals |
| `useSupabaseProfile` | `hooks/useSupabaseProfile.ts` | Profile fetch via `/api/profile` |

### Key Libs
| Lib | File | Description |
|---|---|---|
| `dreamdex.ts` | `lib/dreamdex.ts` | GraphQL queries, `fetchMarketsByInterval`, `fetchLatestIndexPrices`, `verifyMarketAddress`, `fetchOpeningPrices` |
| `orderbook.ts` | `lib/orderbook.ts` | `fetchMarketSentiment` with real order book data |
| `db.ts` | `lib/db.ts` | Resilient `@vercel/postgres` with try/catch wrappers |
| `contracts.ts` | `lib/contracts.ts` | v6 addresses + ABIs + POOL_FACTORY_ADDRESS placeholder |
| `config.ts` | `lib/config.ts` | Chain config, wagmi config (injected connector only) |
| `constants.ts` | `lib/constants.ts` | Colors, ASSET_INFO (BTC/ETH only), INTERVAL_OPTIONS (5m/15m/1h) |
| `types.ts` | `lib/types.ts` | `Asset = string`, `Interval = string` |

### API Routes
| Route | Method | Description |
|---|---|---|
| `/api/pfp` | POST | PFP upload (Vercel Blob private store, signed URL stored) |
| `/api/profile` | GET/POST | Profile CRUD |

---

## Completed Features

### Contracts
- [x] Wager.sol — Reactive settlement, void-aware auto-refund, subscription fund reclaim
- [x] GambitFactory.sol v6 — Create/join/settle/cancel duels, withdraw, subscription fund management
- [x] ParimutuelPool.sol — EIP-1167 clone, depositUp/Down, resolve, claim
- [x] ParimutuelPoolFactory.sol — Deploys pool clones
- [x] 53 Forge tests passing (36 + 17)
- [x] Full E2E test on v6 PASSED — Two duels settled reactively with 2s latency each
- [x] Recycling model confirmed — Factory starts/ends at 50 STT after each duel cycle

### Frontend
- [x] Wallet connection (MetaMask/injected)
- [x] DreamDEX live market discovery (5m/15m/1h, BTC/ETH)
- [x] Real order book sentiment (UP/DOWN %) on create page
- [x] TradingView chart integration
- [x] Auto-settlement latency display (color-coded)
- [x] Oracle transparency (deep-link to oracle explorer)
- [x] Market verification (off-chain indexer + on-chain staticcall)
- [x] Void-aware auto-refund in contract (reads `isVoided()`)
- [x] 1v1 vs Squad creation mode selector
- [x] Arena page with real on-chain duels (no mock data)
- [x] Invite link generation on duel creation success
- [x] Squad Pool creation (BTC/ETH, 5m/15m/1h)
- [x] Squad Pool detail page (invite banner, room code, participants, pool split, squad tally)
- [x] Room code system (6-char code from pool address)
- [x] Profile page with PFP upload
- [x] CoinGecko fallback for live BTC/ETH prices
- [x] Fixed Arena page flickering (isInitialLoad ref)
- [x] Fixed profile page React 19 crash (plain object params for Next.js 14)
- [x] Fixed DreamDEX GraphQL expiry filter (removed `_gt`, client-side filter)
- [x] Fixed PFP upload for private Vercel Blob store

---

## Known Issues / Not Working

1. **ParimutuelPoolFactory not deployed** — Placeholder address `0x0000...` in contracts.ts
2. **PFP signed URL expires** — Vercel Blob private store returns signed URLs that expire. Need to re-upload periodically or switch to public store.
3. **Previous GitHub repo content lost** — Force-pushed over original repo; old commits unrecoverable from remote

---

## Roadmap / Next Steps

1. **Deploy ParimutuelPoolFactory** — Needs STT for gas, deploy logic contract, then factory
2. **Replace expired PFP URLs** — Consider using a database-stored blob path with API route serving, or configure Vercel Blob store as public
3. **Polish UX** — Loading states, error handling, responsive design
4. **Demo video** — 2-3 minute walkthrough of full flow
5. **Mainnet considerations** — Fee tuning, min/max stake adjustments, rate limiting

---

## Key File Locations

| File | Path |
|---|---|
| handoff.md | `Gambit/handoff.md` |
| Wager.sol | `contracts/Wager.sol` |
| GambitFactory.sol | `contracts/GambitFactory.sol` |
| ParimutuelPool.sol | `contracts/ParimutuelPool.sol` |
| ParimutuelPoolFactory.sol | `contracts/ParimutuelPoolFactory.sol` |
| Wager.t.sol | `test/Wager.t.sol` |
| ParimutuelPool.t.sol | `test/ParimutuelPool.t.sol` |
| foundry.toml | `foundry.toml` |
| Frontend root | `frontend/` |
| DreamDEX integration | `frontend/lib/dreamdex.ts` |
| Order book sentiment | `frontend/lib/orderbook.ts` |
| Contract addresses | `frontend/lib/contracts.ts` |
| Create page | `frontend/app/create/page.tsx` |
| Arena page | `frontend/app/arena/page.tsx` |
| Profile page | `frontend/app/u/[address]/page.tsx` |
