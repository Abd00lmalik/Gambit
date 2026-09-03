# Gambit — Architecture Research V2: Deepening DreamDEX Without Breaking What Works

## Research Summary

Five directions investigated from the prior prompt, plus three original ideas proposed. Each evaluated against six ground rules.

---

## PART ONE: The Five Directions

---

### Direction 1: On-Chain Market Verification / Registry Check

**Does DreamDEX expose a way to verify a `marketAddress` is legitimate?**

Yes. `BinaryMarketsModule.markets(bytes32 marketId)` returns a 14-field tuple including `market` (the clone address). If `market == address(0)`, the marketId is unknown. The SDK provides `getBinaryMarketByAddress(marketAddress)` which queries the indexer, then `getMarketOnchain(marketId)` which reads the chain to confirm the address matches.

**Is this currently being done?**

No. Gambit's `Wager.sol` accepts `_marketAddress` as a constructor parameter and trusts it. There is no on-chain or off-chain verification that the address is a real DreamDEX BinaryMarket.

**How would it be implemented?**

Two-layer verification at duel creation:

```
1. Indexer check (off-chain, ~0 gas):
   Market(where: { marketAddress: { _eq: $addr } }, limit: 1)
   → If null, reject

2. On-chain verification (optional, ~30k gas via staticcall):
   BinaryMarketsModule.markets(marketId)
   → record[8] (market) must equal the supplied address
   → record[13] (expiry) must be in the future
```

**Verdict: BUILD — This is the single best option on this list.**

- **Dependency level:** HIGH — Gambit literally cannot create a valid duel without querying DreamDEX's registry
- **Risk to auto-settlement:** ZERO — read-only check at creation time, no changes to settle()
- **Complexity:** LOW — ~50 lines of frontend code (GraphQL query + optional staticcall)
- **Economic implications:** None — pure validation
- **DreamDEX-specific:** YES — cannot verify a market address without DreamDEX's registry
- **What it changes:** Duel creation becomes trustless. Users can't create duels on fake/nonexistent markets.

---

### Direction 2: Deeper Oracle Audit Trail

**Can oracle data be pulled and displayed inline?**

On-chain readable:
- `oracleQuestionId` per market (from `BinaryMarketsModule.markets()`)
- Final answer via `OracleHub.pullAnswer(qid)` or `OracleHub.pullNumericAnswer(qid)`
- Payout vector via `BinaryMarket.payoutNumerators()`
- `AnswerDelivered` event carries resolution result

NOT on-chain readable (indexer/off-chain only):
- Question text
- Price source URLs/params
- Individual source receipts
- Median calculation
- Subcommittee details
- Resolution timeline

The oracle explorer (`https://prd.oracle.somnia.host`) shows rich data, but it's powered by DreamDEX's off-chain indexer, not on-chain reads.

**Verdict: FEASIBLE BUT LOW VALUE**

- **Dependency level:** MEDIUM — reads from DreamDEX's indexer (off-chain), not the chain itself
- **Risk to auto-settlement:** ZERO
- **Complexity:** MEDIUM — need to query indexer API, parse response, build UI components
- **Economic implications:** None
- **DreamDEX-specific:** YES — but the data is from their indexer, not the chain. Could be replicated by any indexer.
- **What it changes:** Shows more oracle detail inline. The existing link-out to oracle explorer already provides this.
- **Honest assessment:** This is a UX polish, not a dependency deepener. The current link-out is sufficient. Building a full inline oracle viewer duplicates what DreamDEX already provides. **Not worth the engineering time.**

---

### Direction 3: Full Asset/Interval Market Coverage

**What does DreamDEX actually offer?**

Confirmed on testnet:

| Asset | 1m | 5m | 15m | 1h |
|-------|----|----|-----|-----|
| BTC | Yes | Yes | Yes | Yes |
| ETH | Yes | Yes | Yes | Yes |
| SOL | — | Yes | — | — |

SDK also defines 4h and 24h intervals (may not have live testnet markets yet).

Currently supported on Gambit: BTC/ETH at 15m/1h only.

**Programmatic listing:** `client.listLiveBinaryMarkets({ limit: 100 })` returns all active markets with asset, interval, expiry, status.

**Verdict: BUILD — Easy win, meaningful dependency deepening**

- **Dependency level:** HIGH — Gambit dynamically discovers what DreamDEX offers instead of hardcoding
- **Risk to auto-settlement:** ZERO — frontend-only change
- **Complexity:** LOW — replace hardcoded ASSETS/INTERVALS arrays with dynamic discovery
- **Economic implications:** None
- **DreamDEX-specific:** YES — market list comes entirely from DreamDEX
- **What it changes:** When DreamDEX adds SOL, 5m, 4h, or any new asset/interval, Gambit automatically shows it. Gambit becomes a reflection of DreamDEX's actual product, not a fixed subset.
- **Implementation sketch:**
  ```
  // On app load + every 60s
  const markets = await client.listLiveBinaryMarkets({ limit: 100 });
  const assetIntervals = [...new Set(markets.map(m => `${m.asset}-${m.intervalSec}`))];
  // Populate arena cards from this list instead of hardcoded arrays
  ```

---

### Direction 4: Parimutuel Pool as Optional Mode

**Can this coexist with the existing 1v1 duel without touching it?**

Yes. Research confirms:

- Parimutuel pool would be a separate contract type (`ParimutuelPool.sol` + `ParimutuelPoolFactory.sol`)
- It reads `IBinaryMarket.payoutNumerators()` for resolution — same as Wager.sol
- It does NOT modify or interact with the existing Wager contract
- The two game modes share only the resolution oracle, nothing else

**Contract design:**
```
ParimutuelPoolFactory (single deploy)
  └── ParimutuelPool clones (EIP-1167) per DreamDEX market
        ├── upPool / downPool / totalPool
        ├── per-user per-side deposit tracking
        ├── resolve() reads payoutNumerators()
        └── claim() distributes proportionally
```

**Financial walk-through (10 users, $10 total pool):**

```
6 users bet UP ($6 total), 4 users bet DOWN ($4 total)
BTC goes UP
UP winners share entire pool minus fee:
  Fee: $10 * 0.025 = $0.25
  Remaining: $9.75
  Each UP bettor gets: ($6 / 6 users) * ($9.75 / $6) = $1.625
  Each DOWN bettor gets: $0

No insolvency — total payouts always equal pot minus fee.
```

**Gas costs:**
- Pool deployment: ~5-8M (factory clone pattern)
- Each deposit: ~223k
- Resolve: ~36k
- Claim per user: ~150k
- Full lifecycle (10 users): ~3.5M

**Regulatory considerations:**
- Parimutuel is generally more favorably classified than fixed-odds betting
- Bettors wager against each other, not the house
- House takes only a fee, not counterparty risk
- On-chain transparency satisfies auditability requirements

**Builder fees:** Would NOT apply — parimutuel pools don't place orders on DreamDEX's CLOB. The pool holds native STT deposits and reads resolution from `payoutNumerators()`. No DreamDEX order placement = no builder fee attachment.

**Verdict: BUILD — Ambitious but genuinely feasible**

- **Dependency level:** VERY HIGH — parimutuel pool is structurally dependent on DreamDEX's resolution oracle
- **Risk to auto-settlement:** ZERO — completely separate contract, no shared state with Wager
- **Complexity:** MEDIUM-HIGH — ~250-350 lines Solidity + frontend UI + new game mode integration
- **Economic implications:** Clean math, no insolvency risk (unlike odds-weighted payouts)
- **DreamDEX-specific:** YES — resolution via `payoutNumerators()` is DreamDEX-specific
- **What it changes:** Adds a fundamentally new game mode. "Arena Pool" where multiple players compete, odds are determined by the crowd, payout is proportional. Coexists with existing 1v1 duels.
- **Timeline:** 2-3 days for contract + tests, 1-2 days for frontend. Realistic for a hackathon.

---

### Direction 5: Any Other DreamDEX Mechanics Not Yet Considered

New mechanics discovered in this research pass:

#### 5a. Pool Recycling Lifecycle

DreamDEX pools are recycled across time windows — the same pool address serves successive markets. The `marketNonce` tracks which generation a pool is on. Outcome token IDs encode the nonce: `(uint160(pool) << 72) | (nonce << 8) | idx`.

**Relevance to Gambit:** Minor. Gambit reads pool addresses from the module's `markets()` mapping, which already handles recycling. No action needed.

#### 5b. `pokeOracle` — Permissionless Oracle Retry

`pokeOracle(oracleQuestionId)` fans out to EVERY market bound to that oracle question. Multiple markets can share the same oracle question, so a single poke can resolve several markets simultaneously.

**Relevance to Gambit:** Could add a "poke" button if settlement is delayed. But this is an edge case, not a core feature.

#### 5c. `finalizeMarket` / `releasePool` — Permissionless Keepers

Anyone can call `finalizeMarket(marketId)` after resolution to sweep pool backing to the settlement singleton. This is a keeper function that could earn fees (though none are currently implemented).

**Relevance to Gambit:** Low. These are DreamDEX housekeeping functions.

#### 5d. Market `context` Field — Opaque Creator Metadata

Each market has an on-chain `context` field (bytes, set once at creation). Currently `'0x'` (empty). This could theoretically be used to embed Gambit-specific data in DreamDEX markets if Gambit were a market creator.

**Relevance to Gambit:** Only relevant if Gambit creates its own markets (which it currently doesn't).

#### 5e. Stop Orders — SPOT/PERP Only

Binary event contracts have NO stop-order infrastructure. Stop orders are only available on spot and perp markets via `SpotStopOrderRegistry` and `PerpStopOrderRegistry`.

**Relevance to Gambit:** None. Confirms that binary market features are limited to the CLOB + resolution oracle.

---

## PART TWO: Original Ideas

---

### Idea 1: Market State-Aware Duel Timing

**The mechanic:**

DreamDEX markets have a 6-state lifecycle: `Listed → Trading → Locked → Settling → Resolved → Voided`. Currently, Gambit only cares about `Trading` (can create duels) and `Resolved` (can settle). But the intermediate states — especially `Locked` — are unused.

**What if Gambit used `Locked` state as a "no more duels" signal?**

Currently, a duel can be created as long as the DreamDEX market is `Trading`. But when the market transitions to `Locked` (window ended, no more orders), any new duel on that market becomes unjoinable (Player B can't join because the market is about to resolve). This creates "dead" duels that waste gas.

**Implementation:**
```
At duel creation: verify market.status == 1 (Trading)
At duel join: verify market.status == 1 (Trading)  
In arena: show market status badge (Trading = green, Locked = yellow)
```

**Ground rules:**
1. **Mechanically:** Read `BinaryMarket.status()` on-chain. ~3k gas.
2. **Fits existing model?** Yes — no changes to settlement math. Just adds a creation-time guard.
3. **Financial:** None — prevents dead duels, saves gas.
4. **Regulatory:** None.
5. **DreamDEX-specific:** YES — `status()` is a DreamDEX-specific lifecycle state.
6. **Complexity:** LOW — ~30 lines of code.

**Verdict: BUILD — Tiny change, genuine dependency.** Gambit now reads DreamDEX's lifecycle state to determine whether a duel can be created. Without DreamDEX, Gambit can't know if a market is tradeable.

---

### Idea 2: Void-Aware Refund Automation

**The mechanic:**

When a DreamDEX market is voided (oracle fails, dispute, etc.), Gambit currently requires a manual `refund()` call. But DreamDEX provides a `voidExpired()` permissionless function, and the void state is readable on-chain.

**What if Gambit automatically detected voided markets and triggered refunds?**

Using the same Somnia reactivity mechanism, subscribe to the `Voided` event (if DreamDEX emits one) or poll `isVoided()` after the settlement window passes. Auto-refund both players without manual intervention.

**Ground rules:**
1. **Mechanically:** `BinaryMarket.isVoided()` is readable on-chain. Could subscribe to state changes or poll after expiry + settlementWindow.
2. **Fits existing model?** Yes — `refund()` already exists, just needs auto-triggering.
3. **Financial:** Prevents stuck funds in voided markets.
4. **Regulatory:** None.
5. **DreamDEX-specific:** YES — void mechanics are DreamDEX-specific.
6. **Complexity:** LOW-MEDIUM — extend reactivity subscription or add time-based polling.

**Verdict: BUILD — Natural extension of the reactive auto-settlement.** Extends the "hero mechanic" to cover voids, not just resolutions. Same pattern, new event type.

---

### Idea 3: Cross-Market Oracle Reference Display

**The mechanic:**

DreamDEX's `MarketReferenceLink` connects markets to reference questions. Multiple markets can share the same reference question (e.g., 15m and 1h BTC markets both reference the same opening price question). This creates an implicit "market family" — markets that share an oracle question are economically related.

**What if Gambit showed this relationship?**

When creating a duel, show "This market shares its oracle with: BTC 1h (0x...)" — revealing the cross-market structure. This deepens understanding of how DreamDEX's oracle system works.

**Ground rules:**
1. **Mechanically:** Query `MarketReferenceLink` GraphQL table by `referenceQuestionId`. Off-chain, no gas.
2. **Fits existing model?** Yes — display-only.
3. **Financial:** None.
4. **Regulatory:** None.
5. **DreamDEX-specific:** YES — `MarketReferenceLink` is DreamDEX's indexer structure.
6. **Complexity:** LOW — GraphQL query + small UI component.

**Verdict: FEASIBLE BUT LOW VALUE.** Interesting technically, but users don't need to know about cross-market oracle references. The current display is sufficient. **Skip.**

---

### Idea 4: Live Market Status Dashboard (DreamDEX Lifecycle Viewer)

**The mechanic:**

Show users the full DreamDEX market lifecycle in real-time:

```
BTC 15m — Trading (expires in 12:34)
  ↳ Status: Trading
  ↳ Pool: 0x3ecC... (active)
  ↳ Oracle: Q#12345
  ↳ Trades today: 1,247

ETH 1h — Locked (awaiting resolution)
  ↳ Status: Locked
  ↳ Pool: 0x2802... (frozen)
  ↳ Oracle: Q#12346
  ↳ Last trade: $0.52
```

**Ground rules:**
1. **Mechanically:** Query `BinaryMarketsModule.markets()` for status, pool, oracleQuestionId. Off-chain GraphQL for trade counts.
2. **Fits existing model?** Yes — display-only, no settlement changes.
3. **Financial:** None.
4. **Regulatory:** None.
5. **DreamDEX-specific:** YES — all data comes from DreamDEX's on-chain state and indexer.
6. **Complexity:** MEDIUM — ~200 lines of frontend, multiple data sources.

**Verdict: FEASIBLE, MEDIUM VALUE.** Shows Gambit's deep integration with DreamDEX. But it's a display feature, not a dependency deepener in the structural sense. **Build if time permits.**

---

### Idea 5: Settlement Latency Benchmarking (On-Chain Metrics)

**The mechanic:**

The `SettlementLatency` component already displays latency. But what if Gambit tracked this over time and published on-chain metrics?

```
Average settlement latency: 2.3s (last 50 duels)
Fastest: 1.2s
Slowest: 4.1s
Success rate: 100% (50/50 reactive settlements)
```

This data proves the hero mechanic works and creates a verifiable track record.

**Ground rules:**
1. **Mechanically:** Store settlement timestamps in factory contract or off-chain database.
2. **Fits existing model?** Yes — no changes to settlement.
3. **Financial:** None.
4. **Regulatory:** None.
5. **DreamDEX-specific:** YES — latency is measured against DreamDEX's oracle resolution time.
6. **Complexity:** LOW — already tracking `settlementTriggeredAt`, just need to aggregate.

**Verdict: BUILD — Already partially implemented.** Just needs aggregation and display. Low effort, high proof-of-concept value.

---

## PART THREE: Final Ranking

### If I had to pick ONE idea to build:

**#1: On-Chain Market Verification (Direction 1)**

**Why:**
- Highest dependency depth — Gambit literally cannot create a valid duel without querying DreamDEX's registry
- Zero risk to auto-settlement
- Lowest complexity (~50 lines)
- Immediate user trust benefit (prevents fake market addresses)
- Cannot be replicated without DreamDEX

**If I could build TWO:**

**#2: Full Asset/Interval Coverage (Direction 3)**

**Why:**
- Dynamic discovery means Gambit grows with DreamDEX
- Low complexity, high structural dependency
- When DreamDEX adds SOL, 5m, or new assets, Gambit automatically supports them

**If I could build THREE:**

**#3: Parimutuel Pool (Direction 4)**

**Why:**
- Fundamentally new game mode
- Proven pattern on EVM
- Clean math (no insolvency risk)
- Highest long-term potential
- But: medium-high complexity, 3-5 days of work

### What NOT to build:

| Idea | Reason |
|---|---|
| Odds-weighted payouts | Proven insolvent |
| Builder fees | No attachment point |
| Deeper oracle audit trail | Duplicates existing oracle explorer |
| Cross-market reference display | Low user value |
| Market state-aware timing | Very small dependency, could be bundled with #1 |

### Ideas that are safe but optional:

| Idea | Value | Effort | Verdict |
|---|---|---|---|
| Void-aware auto-refund | Medium | Low | Build if time permits |
| Market status dashboard | Medium | Medium | Build if time permits |
| Settlement latency benchmarking | High (proof) | Low | Already partially done |

---

## Summary Table

| # | Idea | Dependency | Risk | Complexity | Verdict |
|---|---|---|---|---|---|
| D1 | Market verification | VERY HIGH | ZERO | LOW | **BUILD FIRST** |
| D3 | Full market coverage | HIGH | ZERO | LOW | **BUILD SECOND** |
| D4 | Parimutuel pool | VERY HIGH | ZERO | MED-HIGH | **BUILD IF TIME** |
| D2 | Oracle audit trail | MED | ZERO | MED | SKIP |
| D5 | Other mechanics | LOW | ZERO | LOW | SKIP |
| O1 | Market state timing | MED | ZERO | LOW | BUNDLE W/ D1 |
| O2 | Void auto-refund | MED | ZERO | LOW-MED | OPTIONAL |
| O3 | Cross-market display | LOW | ZERO | LOW | SKIP |
| O4 | Status dashboard | MED | ZERO | MED | OPTIONAL |
| O5 | Latency benchmarking | HIGH | ZERO | LOW | ALREADY DONE |

---

## Honest Final Assessment

The three features that genuinely deepen Gambit's DreamDEX dependency without risk are:

1. **Market verification** — small, immediate, high dependency
2. **Dynamic market coverage** — small, immediate, structural dependency
3. **Parimutuel pool** — large, high dependency, genuinely new game mode

The parimutuel pool is the most ambitious and the most "DreamDEX Event Contract-specific" — it's structurally impossible to build without DreamDEX's resolution oracle, it creates a new game mode, and it has clean math. But it's also the most work.

Market verification + dynamic coverage can be done in a day and make Gambit meaningfully dependent on DreamDEX's registry and market listings. They're the highest-ROI changes.

The existing hero mechanic (2-second reactive auto-settlement) remains Gambit's core differentiator. These additions deepen the DreamDEX dependency layer without touching or risking the settlement layer. That's the right architecture.
