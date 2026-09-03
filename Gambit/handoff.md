# Gambit — Handoff Document

**Last updated:** 2026-08-29 17:30 UTC  
**Current phase:** Full E2E flow verified on Somnia testnet. Next: frontend, backend, demo video.

---

## Project Summary

Gambit is a social duel layer on DreamDEX Event Contracts (Somnia prediction market DEX). Two players take opposite sides of a binary bet (e.g. "BTC YES 15min"), stake STT (native token), and the winner takes the pot when DreamDEX resolves. Gambit only reads DreamDEX's on-chain resolution as an oracle — it does NOT interact with DreamDEX's order book or token system.

---

## Decisions Locked

| Decision | Value | Rationale |
|---|---|---|
| **Stake currency** | STT (native token) | tUSDC is non-standard: `approve()` and `transferFrom()` revert unconditionally; arbitrary contracts can't receive it. Verified via testnet spikes. |
| **Contract pattern** | EIP-1167 minimal proxy (clone) | ~40k gas per clone vs ~8M for full deploy. One logic contract + factory. |
| **Resolution oracle** | DreamDEX `payoutNumerators()` | Confirmed on-chain: `[nonzero, 0]` = YES/Up won, `[0, nonzero]` = NO/Down won, `[0,0]` = unresolved. |
| **Fee model** | Fee-on-payout, 250 bps (2.5%) | Single atomic calculation: `fee = pot * feeBps / 10000`, `winnerPayout = pot - fee`. |
| **Min stake** | 0.1 STT | Testnet placeholder — easy to change. |
| **Max stake** | 100 STT | Testnet placeholder — easy to change. |
| **Settlement** | Permissionless `settle()` | Anyone can call once market is resolved. No liveness dependency. |
| **Fee recipient** | Configurable at creation time | Factory passes `feeRecipient` to each clone. |
| **Join deadline** | Configurable per duel (uint256 timestamp) | If B doesn't join by deadline, A can cancel and reclaim. |
| **Framework** | Foundry, Solidity 0.8.28 | Confirmed: Somnia Shannon testnet supports solc 0.8.28. |
| **Infra** | Vercel (frontend+backend), no VPS | Polling for live updates, Vercel Cron for optional auto-settle. |

---

## Verified Testnet Facts

### Chain
| Parameter | Value |
|---|---|
| Chain name | Somnia Shannon Testnet |
| Chain ID | `50312` |
| RPC URL | `https://api.infra.testnet.somnia.network` |
| Block explorer | `https://shannon-explorer.somnia.network` |
| Native token | STT (Somnia Test Token) |
| Faucet | `https://testnet.somnia.network/` |

### DreamDEX Contracts
| Contract | Address |
|---|---|
| BinaryMarketsModule | `0x3ecC694Cef705358864a646142ac17A90E29e388` |
| MarketsCore | `0x2802504314685D89bF6C992CA5a8e7cC78bc0294` |
| BinarySettlement | `0xbF4a49e0Dfd092e5FBE8E5761064C49533e6Ed23` |
| OutcomeToken6909 | `0xB52c5934113Af5c0Bb20eb3C72290C8215f755b9` |
| OracleHub | `0xe40db387cC98601Dd11bd634fF2f3AD5686dE32b` |
| CollateralRouter | `0xbC0C9834B15ACE38bB50dDaa7d7f7C7CC4DC183C` |
| tUSDC (DO NOT USE) | `0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E` |

### Verified Interfaces (on-chain tested)
```solidity
interface IBinaryMarket {
    function isResolved() external view returns (bool);
    function isVoided() external view returns (bool);
    function payoutNumerators() external view returns (uint256[] memory);
    function status() external view returns (uint8); // 0=Listed,1=Trading,2=Locked,4=Resolved,5=Voided
}
```

**Resolution reading:** `payoutNumerators()` returns `[nonzero, 0]` if YES/Up won, `[0, nonzero]` if NO/Down won, `[0,0]` if unresolved. Tested on resolved market `0x89ed92fdb79e0f1ee6b753704b6fb5023ec8bb0e`.

### Somnia Gas Quirks
| Behavior | Value | Notes |
|---|---|---|
| `receive()` + storage write gas limit | **Must set ≥2,000,000** | Actual usage ~223k, but EIP-7702 intrinsic floor (~1.19M) requires headroom. `estimateGas()` under-predicts — do NOT rely on it. |
| `writeContract` with `value` | **Reverts** | Can't send native value via `writeContract`. Use plain `sendTransaction({ to, value })` to trigger `receive()`, then call functions separately. |
| Clone deploy gas | ~40k | EIP-1167 minimal proxy. |
| Logic contract deploy gas | ~8M | One-time cost. |

### Known Token Issues
- **tUSDC (`0x70a86...`):** `approve()` always reverts (even reset-to-zero). `transferFrom()` always reverts. `transfer()` to arbitrary contracts reverts — only Pool/BinaryModule/BinarySettlement whitelisted. EOA→EOA works (62k gas).
- **Conclusion: tUSDC is completely unusable for escrow. STT is the only viable stake currency.**

### Player A Deposit Flow (Factory + recordDeposit)
Player A's stake is sent when the duel is created. Factory `createDuel()` is `payable`. Since Somnia reverts `writeContract+value`, the factory uses a two-step approach:
1. Factory calls `Wager(clone).initialize(playerA, stakeAmount, ...)` — sets all params
2. Factory calls `Wager(clone).recordDeposit{value: msg.value}(playerA)` — writes `deposits[playerA]`
3. `recordDeposit()` checks `msg.sender == factory` (trusted caller only)

This avoids the `writeContract+value` revert because the factory is a contract making a regular `CALL` with value, not a wallet client using `writeContract`.

### Overpayment Prevention
**Decision:** `receive()` and `recordDeposit()` both revert if `deposits[msg.sender] + msg.value > stakeAmount`. No stuck STT, no excess reclaim logic, no attack surface.

**Rationale:** Preventing overpayment is simpler and safer than allowing it and building reclaim mechanisms. A player who sends too much STT gets an immediate revert — they can correct the amount and retry. This eliminates the risk of permanently stuck funds.

### Known Limitations
- **Fee rounding dust:** `fee = (pot * feeBps) / 10000` truncates to integer. The winner gets `pot - fee`, so up to 9999 wei of dust stays in the contract permanently with no sweep function. Acceptable for hackathon; a production version would add a `sweepDust()` callable by feeRecipient after settlement.
- **No cancel-after-join:** `cancel()` requires `state == CREATED`. Once B calls `join()`, state transitions to `LOCKED`, and `cancel()` reverts with `"wrong state"`. This is intentional — B's deposit is protected. Tested explicitly in `test_cancel_revertsIfJoined`.

### Gas Limit Rules for Scripts/Tests
- Any call that triggers `receive()` or writes to storage on first touch: **explicitly set gas ≥2,000,000**
- Never rely on `estimateGas()` — confirmed unreliable on Somnia
- `settle()` and `cancel()` use `.call{value}` which is fine at standard gas
- `join()` (read-only mapping check + one storage write): 500k is sufficient

---

## Pre-build Research

### OpenZeppelin Clones.sol
- **Version:** v5.5.0+ (included in v5.6.1)
- **Pragma:** `^0.8.20` — compatible with Solidity 0.8.28
- **Import:** `import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";`
- **Pattern:** `address clone = Clones.clone(impl);` then `IWager(clone).initialize(...)` in same tx.
- **Safety:** Call `_disableInitializers()` in implementation constructor to prevent logic contract initialization.
- **No storage collision risk** — clones delegatecall to fixed implementation.
- **Non-upgradeable** — acceptable for per-duel escrows.

### DreamDEX Resolution
- `payoutNumerators()` confirmed on-chain — returns `uint256[]`.
- `isResolved()`, `isVoided()`, `status()` also confirmed.
- Voided markets: both sides redeem at 0.5 on DreamDEX. For Gambit: `refund()` returns each player their own stake.
- Markets have unique, stable addresses per resolution window.

### Foundry Deploy Commands
```bash
forge create --rpc-url https://api.infra.testnet.somnia.network \
  --private-key $PRIVATE_KEY \
  src/Wager.sol:Wager

forge script script/Deploy.s.sol \
  --rpc-url https://api.infra.testnet.somnia.network \
  --private-key $PRIVATE_KEY \
  --broadcast -vvv
```

---

## What's Done

- [x] Research phase (Due diligence report, spike tests)
- [x] tUSDC blocker confirmed — STT chosen as stake currency
- [x] DreamDEX resolution reading verified on-chain
- [x] STT escrow end-to-end spike test passed (deploy → deposit → join → settle → payout)
- [x] SPIKE-REPORT.md updated with all findings
- [x] OpenZeppelin Clones.sol verified for Solidity 0.8.28
- [x] DreamDEX interface signatures re-verified on-chain (`payoutNumerators` exists, `winningOutcome` does not)
- [x] Somnia Shannon RPC/chain ID/Foundry commands confirmed
- [x] Gambit/ folder structure created
- [x] handoff.md created
- [x] Wager.sol written (EIP-1167 logic contract, 11,209 bytes compiled)
- [x] GambitFactory.sol written (clone factory, 15,074 bytes compiled)
- [x] IBinaryMarket.sol interface written
- [x] Foundry project config (foundry.toml, remappings.txt)
- [x] OpenZeppelin contracts installed (npm)
- [x] forge-std installed (lib/)
- [x] Contracts compile clean (solc 0.8.28, no errors, no warnings)
- [x] Overpayment prevention: receive() and recordDeposit() revert if deposit exceeds stakeAmount
- [x] Factory deposit flow: recordDeposit() writes deposits[playerA] during createDuel()
- [x] Owner = playerA (not factory) — cancel() works for the right actor
- [x] Foundry test suite written (test/Wager.t.sol) — 22 test cases covering:
  - Happy path (YES win, NO win)
  - Void/refund path
  - Cancel/timeout path
  - Fee math (zero fee, high fee, rounding)
  - Overpayment (single, multiple deposits, exact amount)
  - Edge cases (already joined, self-duel, deadline, insufficient deposit, not resolved, fee cap, getPot)

---

## In Progress

- [ ] Install Foundry via WSL/Git Bash
- [ ] Run `forge test` locally — ALL tests must pass before testnet
- [ ] Testnet deployment script (`Gambit/script/Deploy.s.sol`)
- [ ] Testnet integration test — same scenarios as local tests, with real transactions

---

## Next (after contracts)

1. **Install Foundry via WSL/Git Bash** — run `curl -L https://foundry.paradigm.xyz | bash && foundryup` in WSL Ubuntu
2. **Run `forge test` locally** — ALL 22 tests must pass before any testnet deployment
3. **Testnet deployment script** (`Gambit/script/Deploy.s.sol`) — deploy factory to Somnia Shannon
4. **Testnet integration test** — same scenarios as local tests, but with real transactions on testnet
5. Frontend (Vercel, Next.js or similar)
6. Backend (Vercel, API routes for duel creation/matching)
7. Demo video (2-3 min)

---

## Known Blockers / Open Questions

- **None currently.** Full E2E flow works on Somnia testnet. Next: frontend, backend, demo video.

---

## CRITICAL: Somnia-Specific Deployment & Gas Quirks

### Contract Creation Bug
- `cast send --create` and ethers.js `sendTransaction({data})` **silently drop the `data` field** on Somnia
- **Fix**: Use `forge create --broadcast` for all contract deployment
- Standalone Wager deployed at `0xc3A8865383Bd0Dcc15443522EEE247945E5e40e9` (via `forge create`)
- Factory deployed at `0x3E106bA72C3AdB511076Cf849c4A70bb132Be395` (via `forge create --constructor-args`)

### Gas Model Bug (CRITICAL)
- Somnia's custom EVM compiler charges **~1,000,000 extra gas** for DELEGATECALL to accounts not in the "hot set" (32M accounts)
- **Symptom**: `join()` and other function calls on EIP-1167 clones revert with `OUT_OF_GAS` when gas limit is < ~1M
- **`eth_call` (callStatic/cast call) succeeds** but **`eth_sendTransaction` (cast send) reverts** — Somnia simulates differently
- **Fix**: Use `--gas-limit 5000000` for ALL transactions that call functions on EIP-1167 clones
- Value transfers via `receive()` (no calldata) work with lower gas limits (~2.5M)

### Working Deployment
```
Factory: 0x3E106bA72C3AdB511076Cf849c4A70bb132Be395 (4-arg constructor)
  └─ implementation: 0x5090dD57479030a7d7F5EB4d4d11Ba31ba9bA885
Standalone Wager: 0xc3A8865383Bd0Dcc15443522EEE247945E5e40e9
```

### Working E2E Script
`Gambit/script/full-e2e.sh` — runs: createDuel → B deposit → B join → settle (all succeed with gas-limit 5000000)

---

## Key File Locations

| File | Path | Status |
|---|---|---|
| handoff.md | `Gambit/handoff.md` | Current |
| Wager.sol | `Gambit/contracts/Wager.sol` | Complete, compiles, OZ Initializable removed |
| GambitFactory.sol | `Gambit/contracts/GambitFactory.sol` | Complete, compiles, 4-arg constructor |
| MinimalWager.sol | `Gambit/contracts/MinimalWager.sol` | Test contract for deployment boundary |
| IBinaryMarket.sol | `Gambit/contracts/interfaces/IBinaryMarket.sol` | Complete |
| Wager.t.sol | `Gambit/test/Wager.t.sol` | Complete (24 tests), ALL PASSING |
| foundry.toml | `Gambit/foundry.toml` | evm_version = "paris", solc 0.8.28 |
| remappings.txt | `Gambit/remappings.txt` | Complete |
| full-e2e.sh | `Gambit/script/full-e2e.sh` | Working E2E script for Somnia testnet |
| run-scenario.sh | `Gambit/script/run-scenario.sh` | Scenario script (uses high gas limit) |
| OpenZeppelin | `Gambit/node_modules/@openzeppelin/contracts/` | Installed (npm) |
| forge-std | `Gambit/lib/forge-std/` | Installed (GitHub zip) |
| Compiled output | `Gambit/out/` | Wager: 11,209 bytes, Factory: 15,074 bytes |
| SPIKE-REPORT.md | `SPIKE-REPORT.md` | Current |
| RESEARCH-REPORT.md | `RESEARCH-REPORT.md` | Current |
