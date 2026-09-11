# Feedback for DreamDEX Team

1. **Market contract discoverability is broken for reactive settlement**
   
   `markets(marketId).market` returns the old EIP-1167 clone that does NOT emit Resolved events. The actual resolving contract is only discoverable via `pool.getBinaryPoolParams().market`. This means any builder trying to build reactive settlement off-chain (Somnia reactivity) or on-chain cannot find the correct market contract through the documented registry. The MarketRecord struct should expose the per-window market contract directly, or `getBinaryPoolParams().market` should be documented as the canonical source.

2. **Market slot recycling breaks settlement for all production duels**
   
   Recycling market slot IDs across time windows while BinaryMarketsModule holds a one-time registration per slot means `settle()` permanently reverts with "stale market record" for every production duel. This is not a client-side fix. Either the registry needs to re-register on slot recycling, or `settle()` needs to handle recycled slots gracefully. At minimum, the recycle-and-reuse pattern needs a documented upgrade path for builders who escrow funds against these slots.

3. **Pool recycling creates confusion about which contract owns the market lifecycle**
   
   "Key your state by marketId or symbol, never by pool address — pools are recycled across successive windows" (Gotcha #12). This is well-documented, but the pool's `getBinaryPoolParams().market` changes per window while `markets(marketId).pool` stays the same. This means the pool returns a different market contract depending on the current window, not the marketId that was originally queried. Builders need a way to resolve "market X's resolving contract" that is stable and doesn't depend on which pool was last assigned.

4. **Old vs new implementation split creates a silent two-tier system**
   
   Markets registered before the implementation upgrade (`0xd12ad05b`) do not emit Resolved events. Markets after (`0x6b2fee58`) do. But both appear identically in `markets()`. There is no on-chain signal to tell a builder "this market will never emit events, don't bother subscribing." This creates a silent failure mode where reactive code works for new markets but silently does nothing for old ones, with no error or indication.

---

# Feedback for Somnia Team

1. **Reactivity is silently unavailable for pre-upgrade DreamDEX markets**
   
   Somnia reactivity (OracleHub callbacks) only fires on Resolved events. DreamDEX markets registered with the old implementation do not emit these events. There is no Somnia-level mechanism to detect this or fall back gracefully. The reactive infrastructure simply never triggers, with no error, no timeout, no indication. Reactivity should either work for all on-chain state changes or surface a clear "no events to subscribe to" response at registration time.

2. **Delegatecall gas pricing is not builder-friendly**
   
   Somnia charges delegatecall gas proportional to implementation contract size. This is non-standard EVM behavior. Standard EVM charges flat gas for delegatecall regardless of implementation size. Builders and wallets cannot reasonably estimate gas for these calls because the cost depends on the target contract's bytecode size, which is not available in standard gas estimation APIs. This causes wallets to estimate low and transactions to OOG. The gas model should either match standard EVM delegatecall pricing or provide a way for builders to query the true cost upfront.

3. **No on-chain signal for event emission capability**
   
   When a builder subscribes to reactive events for a contract, Somnia reactivity cannot distinguish between "this contract does not emit events" and "events are emitted but not yet." A simple on-chain flag or startup check (does this contract's ABI include the expected events?) would let reactive subscriptions fail fast instead of silently waiting forever. This is especially important for proxy contracts where the implementation determines event capability and can change across upgrade boundaries.

4. **Pool/market separation in DreamDEX creates a reactivity gap**
   
   DreamDEX's architecture (Pool for trading, Market for lifecycle, Market for events) means reactivity subscribers need to know which contract to watch. Somnia reactivity subscriptions take a contract address, but the "correct" contract depends on the builder's use case (trading = Pool, lifecycle = Market). There is no guidance in the Somnia docs for multi-contract patterns where one contract is the source of truth for some purposes and another for others.
