# Gambit — Architecture Research: DreamDEX Deep Integration

## Executive Summary

Three features were evaluated to deepen Gambit's dependency on DreamDEX event contracts. One is **not recommended** (odds-weighted payouts), one is **blocked** (builder fees), and one is **recommended with modifications** (live WebSocket odds).

| Feature | Verdict | Reason |
|---|---|---|
| Odds-Weighted Payouts | **Don't build** | Fundamentally incompatible with Gambit's peer-to-peer model; creates insolvency risk; requires architectural redesign |
| Builder Fee Revenue | **Blocked / Don't build** | No attachment point in Gambit's current flow; requires orders placed on DreamDEX CLOB, which Gambit doesn't do |
| Live WebSocket Odds | **Build with modifications** | Low risk, genuine UX improvement, but only for display — not for settlement or odds calculations |

---

## 1. Odds-Weighted Payouts

### 1.1 Timing Question: Lock at Creation vs. Calculate at Settlement

**Option A — Lock at creation (snapshot odds):**

When a duel is posted, snapshot DreamDEX's order book and lock the payout multiplier:

```
Duel created at 14:32:00
DreamDEX BTC 15m book: Up = $0.45, Down = $0.55
Locked multipliers: Up = 2.22x, Down = 1.82x
```

**Manipulation risk:**
- A user creates a duel when odds are favorable (e.g., Up is temporarily cheap at $0.42 → 2.38x multiplier)
- The real market moves to $0.55 by settlement
- The user bet the underdog side at inflated odds
- This is **not manipulation** — it's the same as buying a cheap option before a move. But it creates an asymmetry: the creator gets to pick their entry odds while the joiner accepts whatever's available.

**More critically:** If odds are locked at creation, the joiner sees the multiplier before joining. An underdog bet at 3x is attractive, but the joiner doesn't know if the odds will shift. This creates a **information asymmetry** favoring the creator.

**Option B — Calculate at settlement (live odds):**

Read DreamDEX's order book at settlement time to determine the payout multiplier.

**Manipulation risk:**
- Late-stage markets (last 1-2 minutes) can be thin
- A attacker could place and cancel large orders to shift the midpoint
- This could inflate the underdog's payout multiplier

**Mitigation:** Use `getMidpointEmaState()` (EMA-smoothed mark price) instead of raw book. The EMA advances at most once per second with alpha=0.2, making single-block manipulation nearly impossible. The docs explicitly state: "must not be used as a trigger feed" for raw midpoint, but the EMA IS designed for this.

**Recommendation: Option B (settlement-time EMA)**
- Manipulation-resistant via EMA
- Reflects "true" odds at resolution
- No stale data problem
- But: see insolvency analysis below — this may be moot

### 1.2 Impact on Reactive Auto-Settlement

**Current settlement gas profile:**
- `_onEvent()` → `settle()` → `IBinaryMarket(marketAddress).payoutNumerators()` (~5k gas external call)
- Total settlement: ~50-100k gas

**Adding `getMidpointEmaState()`:**
- Single storage read: ~2.5-5k gas
- **Negligible impact** on 2-second auto-settlement

**Adding `getBookLevels(true, 1)` + `getBookLevels(false, 1)`:**
- ~30-50k gas total (2 external calls + array allocation)
- Adds ~30-50% to settlement gas
- Still within Somnia's 2M gas limit for reactive transactions
- **Not recommended** — use EMA instead

**Critical architectural concern:**
The Wager contract currently only knows `marketAddress` (the BinaryMarket). To call `getMidpointEmaState()`, it needs the **pool address** for that market. The pool address is stored in `BinaryMarketsModule.markets(marketId)`, not in the BinaryMarket contract itself. This means:
1. Wager must call `BinaryMarketsModule` to get the pool address
2. Then call the pool's `getMidpointEmaState()`
3. That's 2 additional external calls vs. current 1

This is feasible but adds complexity and ~10k gas. Not a dealbreaker.

### 1.3 Fee Interaction

Current flow (lines 219-231 of Wager.sol):
```
pot = address(this).balance - subscriptionFund
fee = (pot * feeBps) / 10000  // 250 bps = 2.5%
winnerPayout = pot - fee
```

**With odds weighting, the fee question is:**
- Fee comes off the top BEFORE odds weighting: `fee = pot * 0.025`, then `winnerPayout = (pot - fee) * multiplier`
- This is the standard approach — the house always gets its cut first

**But this creates a problem:** If the multiplier is 2.5x and the pot is $2:
```
fee = $2 * 0.025 = $0.05
remaining = $1.95
winnerPayout = $1.95 * 2.5 = $4.875
```
The winner gets $4.875 from a $1.95 pool. **The contract is insolvent.**

### 1.4 Insolvency Analysis — The Fatal Flaw

**This is the core problem.** Gambit's model is:

```
Player A stakes X on UP
Player B stakes X on DOWN (equal stake)
Total pot = 2X
Winner gets pot minus fee
```

With fixed 2x payout, this is always solvent: winner gets ~1.95X from a 2X pot.

**With odds weighting, the math breaks:**

Example: DreamDEX shows Up = $0.45 (45% probability), Down = $0.55 (55%)
- Multiplier for Up = 1/0.45 = 2.22x
- Multiplier for Down = 1/0.55 = 1.82x

**Scenario 1: Up wins (the underdog)**
```
Alice bet $1 on Up (underdog at 2.22x)
Bob bet $1 on Down (favorite at 1.82x)
Pot = $2
Fee = $0.05
Remaining = $1.95
Alice's payout should be: $1 * 2.22 = $2.22
Contract only has: $1.95
INSOLVENCY: $0.27 short
```

**Scenario 2: Down wins (the favorite)**
```
Alice bet $1 on Up
Bob bet $1 on Down
Pot = $2
Fee = $0.05
Remaining = $1.95
Bob's payout should be: $1 * 1.82 = $1.82
Contract has: $1.95
SURPLUS: $0.13
```

**The fundamental issue:** In a 50/50 stake model, the underdog's multiplier always exceeds 2x when odds are not 50/50. The contract cannot pay more than the pot.

**Potential fixes (all have problems):**

1. **Cap multiplier at 2x:** Defeats the purpose — underdog always gets exactly 2x regardless of odds
2. **Asymmetric stakes:** Player A puts in `X * (1 - odds)`, Player B puts in `X * odds`. Changes UX completely — players bet different amounts
3. **Parimutuel pool:** Multiple players per side, pool splits proportionally. Complete architectural redesign — not a "feature add," it's a new product
4. **House edge as buffer:** Increase fee to cover worst-case insolvency. Requires complex actuarial modeling; not viable for a hackathon project

**None of these are clean.** The root cause is that Gambit's 50/50 peer-to-peer model is fundamentally at odds with odds-weighted payouts.

### 1.5 Verdict: Don't Build

**Reasoning:**
- Odds-weighted payouts are **architecturally incompatible** with Gambit's core model
- Every fix requires either: changing the UX (asymmetric stakes), redesigning the product (parimutuel), or defeating the purpose (capping at 2x)
- The insolvency risk is real and mathematically provable
- The reactive auto-settlement mechanism would need significant rework to handle variable payouts

**What to do instead:**
- Keep Gambit as a **pure peer-to-peer prediction market** with fixed 2x payouts
- Show DreamDEX odds as **informational only** (already implemented in MarketSentimentBar)
- For users who want odds-weighted trading, point them to DreamDEX's CLOB directly

---

## 2. Builder Fee Revenue

### 2.1 Is `approveBuilder` Permissionless?

**Yes, it's fully permissionless.** Evidence from SDK source code (`src/fees.ts`):

> "builder approval is the one write here — **a user authorizing a routing frontend** to attribute orders to itself and collect a per-order fee"

The contract ABI confirms no access control:
```solidity
function approveBuilder(address builder, uint256 maxFeeBpsTimes1k)
```
No `onlyOwner`, no admin check — just `msg.sender` is the approving user.

**Key detail:** `maxBuilderFeeBpsTimes1k` for BinaryPool is **immutable** (set at deployment). On testnet, this cap is 0 (no builder fees allowed). On mainnet, it's 100 BPS (1%).

### 2.2 Is There an Attachment Point in Gambit's Flow?

**No.** Here's Gambit's actual flow:

```
1. Player A creates duel → sends STT to Wager contract
2. Player B joins → sends STT to Wager contract
3. DreamDEX market resolves → oracle emits Resolved event
4. Wager._onEvent() → settle() → sends STT to winner
```

**At no point does Gambit place an order on DreamDEX's CLOB.** Builder fees only trigger when:
```solidity
pool.placeOrder({
  builder: gambitAddress,
  builderFeeBpsTimes1k: 50
})
```

Gambit doesn't call `placeOrder()`. It doesn't interact with the CLOB at all. The only on-chain interaction is reading `payoutNumerators()` from the BinaryMarket contract.

**There is no natural attachment point for builder fees in Gambit's current architecture.**

### 2.3 Could We Invent an Attachment Point?

Theoretically, if Gambit routed trades through DreamDEX's CLOB (e.g., for odds-weighted payouts that execute actual trades), builder fees would apply. But:
- Odds-weighted payouts are not recommended (see Section 1)
- Even if they were, routing through the CLOB adds complexity, gas, and latency
- The builder fee would be ~0.5% on each trade, but Gambit already charges 2.5% on settlement — the incremental revenue doesn't justify the architectural cost

### 2.4 Verdict: Blocked / Don't Build

**Reasoning:**
- No attachment point in Gambit's current flow
- Would require either: (a) odds-weighted payouts that execute CLOB trades (not recommended), or (b) a completely new feature that places orders on DreamDEX
- BinaryPool's `maxBuilderFeeBpsTimes1k` is 0 on testnet — can't even test this
- Even on mainnet, the 1% cap is less than Gambit's existing 2.5% settlement fee

**What to do instead:**
- Focus on Gambit's own fee model (250 bps on settlement)
- If DreamDEX's builder fee system becomes relevant in the future (e.g., if Gambit adds a "trade through Gambit" feature), revisit

---

## 3. Live WebSocket Odds

### 3.1 Does DreamDEX Expose a Public WebSocket?

**Yes.** Confirmed from documentation:

| Environment | URL |
|---|---|
| Mainnet | `wss://api.dreamdex.io/v0/ws/public` |
| Testnet | `wss://stg.api.dreamdex.io/v0/ws/public` |

**Available channels:**
- `orderbook` — Real-time snapshots + incremental updates
- `trades` — Trade history and new trade feed
- `ohlcv` — Candlestick data
- `order` — Per-order lifecycle events

**Documentation:** `https://app.dreamdex.io/docs/developers/websocket-api`

**Message format:**
```json
// Subscribe
{"operation": "subscribe", "channel": "orderbook", "params": {"symbols": ["BTC:USDso"]}}

// Snapshot
{"channel": "orderbook", "type": "snapshot", "symbol": "BTC:USDso", "bids": [...], "asks": [...]}

// Delta update
{"channel": "orderbook", "type": "update", "symbol": "BTC:USDso", "bids": [...], "asks": [...]}

// Heartbeat
Send: {"operation": "ping"} → Receive: {"operation": "pong"}
// Connection closes after 60s inactivity
```

**SDK support:** CCXT Pro (`watchOrderBook`, `watchTrades`, `watchOHLCV`)

### 3.2 Real-World Difference: 15s Polling vs. Live WebSocket

**For Gambit's use case (15min-1hr duels):**

| Factor | 15s Polling | Live WebSocket |
|---|---|---|
| Odds freshness | Up to 15s stale | Sub-second |
| User perception | "Odds update every 15s" | "Odds are live" |
| Impact on decision-making | Minimal for 15min duels | Marginal improvement |
| Engineering complexity | Simple (already implemented) | Moderate (connection mgmt, reconnect, fallback) |

**Analysis:**
- A 15-minute duel has 900 seconds. 15-second polling gives ~60 data points. A live feed gives ~900+.
- The marginal value of data point #61 through #900 is low — odds don't move that fast in 15 minutes
- The UX improvement is **perceptual** — "live" feels better than "polled," even if the data is nearly identical
- For the "Closing Soon" phase (last 2 minutes), live odds ARE more valuable — that's when the most price discovery happens

**Recommendation:** The improvement is real but marginal. It's a **nice-to-have**, not a must-have.

### 3.3 Added Complexity and Fragility

**Connection handling:**
- WebSocket connections drop. Need reconnect logic.
- DreamDEX's WS closes after 60s inactivity — need heartbeat every <60s
- No sequence numbers in DreamDEX WS — "treat every reconnect as cold start; reconcile via REST"

**Fallback requirements:**
- If WS drops, fall back to 15s polling (already implemented)
- Need state reconciliation on reconnect (snapshot + delta)
- Need to handle duplicate/missed updates

**Fragility:**
- WebSocket is inherently less reliable than REST polling
- Network issues, DreamDEX server issues, browser tab backgrounding all affect WS
- Need robust error handling and reconnection logic

**Engineering cost:**
- ~200-400 lines of new code for WS client with reconnect/fallback
- Testing across network conditions
- Not trivial, but not massive either

### 3.4 Verdict: Build with Modifications

**Reasoning:**
- DreamDEX's WS API is confirmed and well-documented
- The UX improvement is real (especially for "Closing Soon" phase)
- Engineering cost is moderate but justified
- Must include: heartbeat, reconnect, fallback to polling, state reconciliation

**Modifications to original scope:**
1. **Display only** — WS data feeds the MarketSentimentBar and SystemDuelCard. Do NOT use WS data for settlement or any on-chain logic.
2. **Graceful degradation** — If WS fails, fall back to 15s polling silently. No error shown to user.
3. **No new attack surface** — WS data is read-only, off-chain, display-only. Cannot affect settlement.
4. **Priority:** Build after core features are polished. This is a UX enhancement, not a functional requirement.

**Implementation sketch:**
```
// WebSocket client with auto-reconnect
class DreamDEXWS {
  private ws: WebSocket | null;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private heartbeatInterval: NodeJS.Timer;
  
  connect() {
    this.ws = new WebSocket('wss://stg.api.dreamdex.io/v0/ws/public');
    this.ws.onmessage = this.handleMessage;
    this.ws.onclose = this.handleClose;
    this.startHeartbeat();
    this.subscribe(['BTC:USDso', 'ETH:USDso']);
  }
  
  handleClose() {
    // Exponential backoff reconnect
    setTimeout(() => this.connect(), this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
  }
  
  handleMessage(event) {
    const data = JSON.parse(event.data);
    if (data.channel === 'orderbook') {
      // Update local state, trigger React re-render
      this.onOrderBookUpdate(data);
    }
  }
  
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.ws?.send(JSON.stringify({ operation: 'ping' }));
    }, 30000); // Every 30s (well under 60s timeout)
  }
}
```

---

## Summary

| Feature | Verdict | Dependency | Risk to Auto-Settlement |
|---|---|---|---|
| Odds-Weighted Payouts | **Don't build** | Requires architectural redesign | Would break it |
| Builder Fee Revenue | **Blocked** | No attachment point | N/A |
| Live WebSocket Odds | **Build (display only)** | None | None |

**The honest answer:** Gambit's core innovation is the **peer-to-peer reactive auto-settlement** — the 2-second settlement via Somnia's reactivity precompile. That's what makes it unique. DreamDEX is the oracle, not the product.

Trying to force deep DreamDEX integration (odds weighting, CLOB routing, builder fees) fights against Gambit's architecture rather than enhancing it. The features that would make Gambit "impossible to build without DreamDEX" are the same features that would break Gambit's core model.

**What to focus on instead:**
1. Polish the existing auto-settlement UX (already proven)
2. Add live WebSocket odds for display (nice-to-have)
3. Improve the arena experience (system challenges, market discovery)
4. Build a compelling demo that showcases the 2-second settlement

The 2-second settlement IS the differentiator. Don't dilute it by bolting on incompatible features.
