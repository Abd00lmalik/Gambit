# Gambit

**A decentralized prediction market platform built on blockchain for peer-to-peer wagering and parimutuel betting on DreamDEX events.**

🌐 **Live Demo**: [gambit-orpin.vercel.app](https://playgambit.vercel.app)

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Core Features](#core-features)
- [Technical Stack](#technical-stack)
- [Smart Contracts](#smart-contracts)
- [Frontend](#frontend)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Development](#development)
- [Testing](#testing)
- [Deployment](#deployment)
- [API Reference](#api-reference)
- [Investigation & Findings](#investigation--findings)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

Gambit is a blockchain-based prediction market protocol that enables users to:

1. **Create Binary Duels**: Two players bet on prediction market outcomes on opposite sides (UP/DOWN)
2. **Join Duels**: Accept existing wagers from other players
3. **Participate in Parimutuel Pools**: Bet alongside multiple players on the same event
4. **Auto-Settlement**: Markets resolve automatically via DreamDEX integration with fallback oracle settlement

The platform leverages DreamDEX (a binary prediction market protocol) for market data and resolution, while Gambit adds a social, accessible layer for peer-to-peer and pooled betting experiences.

### Key Value Propositions

- **Trustless Settlement**: Smart contracts verify and execute payouts automatically
- **Two Betting Models**: Duel (1v1) or Pool (many participants)
- **Fallback Oracle**: If market slot registration becomes stale, oracle attestation ensures settlement
- **Low Overhead**: Minimal fees (configurable basis points)
- **Multi-Chain Ready**: Deployed on Somnia testnet (extensible to other EVM chains)

---

## Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js/React)                 │
│  ✓ Create duels  ✓ Join duels  ✓ Create pools  ✓ Claim     │
└──────────────────────────┬──────────────────────────────────┘
                           │ Wagmi + viem
                           ↓
        ┌──────────────────────────────────────┐
        │    GambitFactory                     │
        │  • Creates Wager clones              │
        │  • Verifies markets on-chain         │
        │  • Manages lifecycle                 │
        └──────────────┬───────────────────────┘
                       │
        ┌──────────────┴────────────────────────┐
        ↓                                       ↓
    ┌─────────────────────────┐        ┌──────────────────────┐
    │  Wager (Clone)          │        │ ParimutuelPool       │
    │  1v1 Betting            │        │ Many-to-Many Betting │
    │  • Player A vs Player B │        │                      │
    │  • Escrows deposits     │        │ • UP/DOWN sides      │
    │  • Settles on outcome   │        │ • Proportional payout│
    │  • Oracle fallback      │        │ • Refund or claim    │
    └────────────┬────────────┘        └──────────────────────┘
                 │
                 └──────────────┬─────────────────────┐
                                ↓                     ↓
                    ┌──────────────────────┐  ┌─────────────┐
                    │ DreamDEX Markets     │  │ Keeper Bot  │
                    │ BinaryMarketsModule  │  │ (Off-Chain) │
                    │ • Market resolution  │  │ • Settles   │
                    │ • Payout numerators  │  │   duels     │
                    └──────────────────────┘  └─────────────┘
```

### Contract Interaction Flow

#### Duel Flow (1v1 Betting)

```
User A                 GambitFactory            Wager Clone           DreamDEX
   │                        │                       │                    │
   ├─ createDuel()──────────>│                       │                    │
   │   (sends stake)         │                       │                    │
   │                         ├─ verify market───────────────────────────>│
   │                         │                       │                    │
   │                         ├─ clone Wager─────────>│                    │
   │                         ├─ initialize()─────────>│                    │
   │                         ├─ recordDeposit()─────>│ (tracks deposit)  │
   │                         │                       │                    │
   │                    [Duel Created]               │                    │
   │<──── clone address ────<│                       │                    │
   │                         │                       │                    │
User B                       │                       │                    │
   ├─ join()──────────────────────────────────────────>│ (sends stake)     │
   │                                                  │                    │
   │                                             [LOCKED]                 │
   │                                                  │                    │
                                              [Time passes...]
                                                  │                    │
                                                  │                    │
User or Keeper                                      │                    │
   ├─ settle()────────────────────────────────────────>│                  │
   │                                                  ├─ Check isResolved─>
   │                                                  │                    │
   │                                                  ├─ Get payout────────>
   │                                                  │                    │
   │                                                  ├─ Pay winner◄───────┤
   │                                                  │                    │
   │                                             [SETTLED]                │
   │<───── payout confirmation ─────────────────────<
```

#### Pool Flow (Many-to-Many Betting)

```
User A
   ├─ depositUp()─────> ParimutuelPool
   │   (sends stake)    [ACTIVE]
   │                       │
User B                      ├─ Tracks deposits
   ├─ depositDown()────>    │ (UP side, DOWN side)
   │   (sends stake)        │
   │                        ├─ Accumulates pools
User C                       │
   ├─ depositUp()─────>     │
   │   (sends stake)     [Market Expires]
   │                        │
   │                        ├─ resolve()
   │                        │ (reads DreamDEX outcome)
   │                        │
   │                    [RESOLVED]
   │                        │
User A, C (Winners)         │
   ├─ claim()──────────>    ├─ Calculate payout
   │                        │ payout = deposit × (totalPool/winningPool) - fee
   │                        │
   │<─ Receive payout ◄─────┤
```

### State Management

**Wager Contract States:**
- `CREATED`: Waiting for Player B to join
- `LOCKED`: Both players funded, awaiting market resolution
- `SETTLED`: Winner paid out
- `REFUNDED`: Both players refunded (market voided or split result)
- `CANCELLED`: Duel expired before Player B joined

**ParimutuelPool Contract States:**
- `ACTIVE`: Accepting deposits before deadline
- `RESOLVED`: Market resolved, winners can claim
- `REFUNDED`: Pool cancelled/voided, users can claim refunds

---

## Core Features

### 1. **Duel System (1v1 Betting)**
- **Peer-to-peer binary wagers** on DreamDEX market outcomes
- **Symmetric stakes**: Both players deposit equal amounts
- **Automatic winner determination** based on market resolution (UP vs DOWN)
- **Fee capture**: Configurable platform fee (basis points)
- **Timeout recovery**: Creator can reclaim stake if opponent never joins

### 2. **Parimutuel Pool System**
- **Multiple participants** on UP or DOWN side
- **Proportional payouts**: Winners split pool proportional to their stake
- **Flexible entry**: Deposit any amount before deadline
- **Refund support**: Automatic refund if market voided or deadline expires

### 3. **Market Integration**
- **DreamDEX Sync**: Reads binary market contracts for resolution data
- **Module Registry**: Looks up canonical Market contracts via `BinaryMarketsModule`
- **Market Verification**: On-chain check that markets use correct implementation
- **Expiry Guards**: Prevents settlement on stale market registrations

### 4. **Oracle Settlement (Fallback)**
- **Stale Market Recovery**: If market slot registration becomes outdated (DreamDEX recycles slots), oracle attestation settles the duel
- **Signature Verification**: ECDSA-recovered oracle signer attests outcome
- **Window-Bound**: Oracle signature bound to the specific contest window (joinDeadline)
- **Identical Payout Math**: Same fee and winner derivation as on-chain settlement

### 5. **Fee Management**
- **Configurable rates**: Set per-factory or per-duel/pool
- **Safe withdrawal**: Owner can withdraw accumulated fees
- **Recipient flexibility**: Fees go to configured address

---

## Technical Stack

### **Smart Contracts**
| Component | Version | Purpose |
|-----------|---------|---------|
| Solidity | ^0.8.28 | Smart contract language |
| OpenZeppelin | ^5.6.1 | Secure imports (ECDSA, Clones) |
| Foundry | Latest | Testing & development |
| forge-std | ^1.16.2 | Standard library for tests |

### **Frontend**
| Component | Version | Purpose |
|-----------|---------|---------|
| Next.js | 14.1.0 | React framework & SSR |
| React | ^18.2.0 | UI library |
| TypeScript | ^5.3.0 | Type safety |
| Tailwind CSS | ^3.4.0 | Utility-first styling |
| wagmi | ^2.19.5 | React hooks for wallet interaction |
| viem | ^2.56.1 | Ethereum client library |
| RainbowKit | ^2.2.11 | Wallet connection UI |
| TanStack Query | ^5.102.8 | Server state management |
| Supabase | ^2.116.0 | Backend database |
| Framer Motion | ^11.0.0 | Animation library |
| Lightweight Charts | ^5.2.1 | Chart rendering |

### **Infrastructure**
| Component | Purpose |
|-----------|---------|
| Vercel | Frontend hosting & deployment |
| Vercel Postgres | Relational database |
| Vercel Blob | File storage |
| Somnia Testnet | EVM-compatible blockchain |

### **Development Tools**
| Tool | Purpose |
|------|---------|
| Node.js | Runtime (v18+) |
| npm | Package manager |
| tsx | TypeScript executor for scripts |

---

## Smart Contracts

### **GambitFactory.sol**
**Responsibilities:**
- Factory pattern for deploying Wager clones (EIP-1167 minimal proxy)
- Market verification on-chain
- Lifecycle management (create, cancel)
- Fee configuration

**Key Functions:**
```solidity
createDuel(
    address _marketAddress,
    bytes32 _marketId,
    uint256 _joinDeadline,
    bool _creatorIsUp
) external payable returns (address clone)
```
Creates a new duel clone and initializes with Player A's stake.

```solidity
cancelDuel(address clone) external
```
Cancels expired CREATED duels permissionlessly.

```solidity
isReactiveMarket(bytes32 _marketId) external view returns (bool)
```
Checks if market uses the newer (reactive) DreamDEX implementation.

**State:**
- `implementation`: Address of Wager logic contract
- `owner`: Factory owner (can withdraw fees)
- `feeRecipient`: Address receiving protocol fees
- `defaultFeeBps`: Default fee rate (basis points)
- `minStake`, `maxStake`: Stake bounds per duel

---

### **Wager.sol**
**Responsibilities:**
- Per-duel escrow logic (Player A vs Player B)
- Deposit tracking
- Settlement (on-chain or oracle-attested)
- Market resolution verification

**Key Functions:**
```solidity
initialize(
    address _playerA,
    uint256 _stakeAmount,
    address _marketAddress,
    bytes32 _marketId,
    uint256 _feeBps,
    address _feeRecipient,
    uint256 _joinDeadline,
    bool _creatorIsUp
) external
```
Called by factory immediately after cloning.

```solidity
join() external inState(WagerState.CREATED)
```
Player B joins the duel (must pre-fund via `receive()`).

```solidity
settle() public inState(WagerState.LOCKED)
```
Permissionless settlement once market resolves. Guards against:
- Stale market registration (Era 3 DreamDEX slot recycling)
- Wrong payout detection
- Re-resolves from module if stored address is dead

```solidity
settleByOracle(bool upWon, uint256 windowEnd, bytes calldata sig) external
```
Oracle-attested settlement for stale market registrations. Signature proves outcome for the specific contest window.

```solidity
refund() external inState(WagerState.LOCKED)
```
Refund both players if market is voided.

**State:**
- `playerA`, `playerB`: Participants
- `stakeAmount`, `deposits`: Tracking
- `marketAddress`, `marketId`: DreamDEX reference
- `resolvedMarketContract`: Cached canonical Market contract
- `creatorIsUp`: Tracks which side Player A chose
- `state`: Current lifecycle state
- `joinDeadline`: Deadline for Player B to join
- `feeBps`, `feeRecipient`: Fee config

**Critical Guards:**
```solidity
// Prevents settlement before market is final
require(block.timestamp >= marketExpiry, "market not final");

// Prevents settlement if market registration is stale
require(marketExpiry + 1 hours > joinDeadline, "stale market record");

// Detects and prevents split/void results
if (p[0] == p[1]) {
    _executeRefund();
    return;
}
```

---

### **ParimutuelPool.sol**
**Responsibilities:**
- Pool-based betting (multiple players, same or opposite sides)
- Deposit management (UP/DOWN sides)
- Proportional payout calculation
- Refund handling

**Key Functions:**
```solidity
initialize(
    address _owner,
    address _marketAddress,
    uint256 _feeBps,
    address _feeRecipient,
    uint256 _deadline
) external
```
Called by factory after cloning.

```solidity
depositUp() external payable
depositDown() external payable
receive() external payable (defaults to UP)
```
Players deposit on UP or DOWN side.

```solidity
resolve() external
```
Resolves pool after market resolves (sets RESOLVED state).

```solidity
claim() external
```
Winners claim payout: `deposit × (totalPool / winningPool) - fee`

```solidity
refund() external
claimRefund() external
```
Refund all deposits if market voided or deadline expired.

**State:**
- `upPool`, `downPool`, `totalPool`: Track total deposits per side
- `upDeposits[user]`, `downDeposits[user]`: Per-user tracking
- `claimed[user]`: Prevent double-claims
- `state`: Current lifecycle (ACTIVE → RESOLVED → REFUNDED)

---

### **Interfaces**

#### **IBinaryMarket.sol**
```solidity
interface IBinaryMarket {
    function isResolved() external view returns (bool);
    function isVoided() external view returns (bool);
    function payoutNumerators() external view returns (uint256[] memory);
}
```
Represents DreamDEX's binary market contract API.

#### **IBinaryMarketsModule.sol**
```solidity
interface IBinaryMarketsModule {
    function markets(bytes32 marketId) external view returns (...);
}
```
Registry that maps `marketId` → Market contract address and metadata.

---

## Frontend

### **Architecture**

```
frontend/
├── app/                          # Next.js app directory
│   ├── layout.tsx               # Root layout (providers)
│   ├── page.tsx                 # Landing page
│   └── [dynamic-routes]/        # Route groups
├── components/                  # Reusable React components
│   ├── DuelCreator.tsx          # Create duel UI
│   ├── DuelList.tsx             # Display active duels
│   ├── PoolCreator.tsx          # Create pool UI
│   ├── PoolParticipant.tsx      # Pool deposit UI
│   └── ...
├── hooks/                       # Custom React hooks
│   ├── useWagmi.ts             # Wallet connection
│   ├── useGambitContract.ts    # Contract interaction
│   └── ...
├── lib/                        # Utilities & helpers
│   ├── abi.ts                 # Contract ABIs
│   ├── addresses.ts           # Contract addresses
│   ├── market.ts              # Market helpers
│   └── format.ts              # Formatting utilities
├── public/                    # Static assets
├── scripts/                   # Client-side scripts
│   ├── test-pfp.mts          # PFP script
│   ├── test-chart-data.mts   # Chart data script
│   ├── test-duel-state.mts   # Duel state script
│   └── test-revert-reason.mts # Error investigation
├── next.config.js            # Next.js configuration
├── tailwind.config.ts        # Tailwind CSS config
├── tsconfig.json             # TypeScript config
└── package.json              # Dependencies
```

### **Key Features**

1. **Wallet Integration**
   - RainbowKit for multi-wallet support
   - wagmi hooks for contract interaction
   - viem for low-level Ethereum operations

2. **Market Display**
   - Lightweight Charts for live price charts
   - Real-time market data via indexer/graphql
   - Market status indicators

3. **Duel Management**
   - Create new duels (set stake, deadline, side)
   - Join existing duels (confirm opponent, deposit)
   - View active & resolved duels
   - Settle/claim winnings

4. **Pool Participation**
   - Create pools for specific markets
   - Deposit on UP or DOWN side
   - View pool splits and participation
   - Claim proportional winnings

5. **Error Handling & Scripts**
   - `test-revert-reason.mts`: Extracts revert reasons from failed tx
   - `test-duel-state.mts`: Verifies duel state on-chain
   - `test-chart-data.mts`: Validates chart data format
   - `test-pfp.mts`: Tests profile picture resolution

### **Environment Configuration**

Frontend uses environment variables (`.env.local` or Vercel):
```
NEXT_PUBLIC_WAGMI_PROJECT_ID=<your-walletconnect-project-id>
NEXT_PUBLIC_FACTORY_ADDRESS=0x...
NEXT_PUBLIC_POOL_FACTORY_ADDRESS=0x...
NEXT_PUBLIC_RPC_URL=https://api.infra.testnet.somnia.network
```

---

## Getting Started

### **Prerequisites**
- Node.js v18+ (check `.node-version`)
- npm or yarn
- Git

### **Installation**

#### 1. Clone Repository
```bash
git clone https://github.com/Abd00lmalik/Gambit.git
cd Gambit
```

#### 2. Install Dependencies
```bash
# Install root dependencies (Solidity tools)
npm install

# Install frontend dependencies
cd frontend
npm install
cd ..
```

#### 3. Build Smart Contracts (Optional)
```bash
# Compile Solidity contracts
npm run build
# or use foundry directly
forge build
```

#### 4. Run Frontend Locally
```bash
cd frontend
npm run dev
```
Opens at [http://localhost:3000](http://localhost:3000)

#### 5. Set Environment Variables
Create `frontend/.env.local`:
```
NEXT_PUBLIC_WAGMI_PROJECT_ID=<your-walletconnect-id>
NEXT_PUBLIC_FACTORY_ADDRESS=0x...
NEXT_PUBLIC_RPC_URL=https://api.infra.testnet.somnia.network
```

---

## Configuration

### **Smart Contract Configuration**

#### **GambitFactory Deployment Parameters**
```javascript
constructor(
    address _feeRecipient,      // Where protocol fees go
    uint256 _defaultFeeBps,     // Fee rate (e.g., 250 = 2.5%)
    uint256 _minStake,          // Minimum stake (wei)
    uint256 _maxStake,          // Maximum stake (wei)
    address _implementation,    // Wager logic contract
    address _oracleSigner      // Trusted oracle signer
)
```

#### **ParimutuelPoolFactory (Similar)**
```javascript
constructor(
    address _feeRecipient,
    uint256 _defaultFeeBps,
    address _implementation,
)
```

### **Frontend Configuration**

**Tailwind CSS**: `frontend/tailwind.config.ts`
- Defines custom color schemes
- Extends breakpoints
- Configures animations

**Next.js**: `frontend/next.config.js`
- Image optimization
- Build configuration
- Environment exports

---

## Development

### **Project Structure**
```
├── contracts/                 # Smart contracts (Solidity)
│   ├── GambitFactory.sol
│   ├── Wager.sol
│   ├── ParimutuelPool.sol
│   ├── ParimutuelPoolFactory.sol
│   ├── MinimalWager.sol
│   └── interfaces/
│       ├── IBinaryMarket.sol
│       └── IBinaryMarketsModule.sol
├── test/                      # Foundry tests
├── script/                    # Deployment scripts
├── frontend/                  # Next.js app
├── foundry.toml              # Foundry config
└── vercel.json               # Vercel config
```

### **Common Development Tasks**

#### **Add a New Component**
```bash
cd frontend
# Create a new component
touch components/MyComponent.tsx
```

#### **Modify Solidity Contract**
```bash
# Edit contract
vim contracts/Wager.sol

# Recompile
forge build

# Run tests
forge test
```

#### **Add Frontend Script**
```bash
# Create new script in frontend/scripts
touch frontend/scripts/my-script.mts

# Run it
npm run --prefix frontend my-script
```

---

## Testing

### **Smart Contract Tests**

Run all tests:
```bash
forge test
```

Run specific test:
```bash
forge test --match-contract WagerTest
```

Run with logs:
```bash
forge test -vv
```

### **Frontend Testing**

Client-side test scripts in `frontend/scripts/`:
- `test-pfp.mts`: Tests profile picture resolution
- `test-chart-data.mts`: Validates chart data format
- `test-duel-state.mts`: Checks duel state on-chain
- `test-revert-reason.mts`: Extracts error reasons from failed transactions

Run:
```bash
cd frontend
npm run test:pfp
npm run test:chart
npm run test:duel-state
npm run test:revert-reason
```

---

## Deployment

### **Smart Contracts**

#### **Deploy to Somnia Testnet**
```bash
# Set RPC endpoint in foundry.toml
# Then run deployment script

forge script script/Deploy.s.sol --rpc-url somnia --broadcast
```

#### **Verify on Explorer**
```bash
forge verify-contract <contract-address> ContractName \
  --rpc-url https://api.infra.testnet.somnia.network \
  --etherscan-api-key <api-key>
```

### **Frontend**

#### **Deploy to Vercel**
```bash
cd frontend
npm run build
vercel deploy --prod
```

Or connect GitHub repo to Vercel for automatic deployments on push to `main`.

---

## API Reference

### **Wager Contract**

#### **Write Functions**
| Function | Parameters | Returns | Notes |
|----------|-----------|---------|-------|
| `initialize` | `(_playerA, _stakeAmount, _marketAddress, ...)` | - | Called by factory only |
| `join` | - | - | Player B joins duel |
| `settle` | - | - | Settles after market resolution |
| `settleByOracle` | `(upWon, windowEnd, sig)` | - | Oracle-backed settlement |
| `refund` | - | - | Refund if market voided |
| `cancel` | - | - | Player A cancels if B never joined |
| `factoryCancel` | - | - | Factory-initiated cancel |
| `recordDeposit` | `(player)` | - | Factory records Player A's deposit |

#### **Read Functions**
| Function | Returns | Notes |
|----------|---------|-------|
| `getPot` | `uint256` | Current pot balance |
| `joinDeadlineRemaining` | `uint256` | Seconds until deadline (0 if expired) |
| `state` | `WagerState` | Current state (CREATED, LOCKED, SETTLED, ...) |
| `creatorIsUp` | `bool` | Did Player A choose UP side? |
| `payoutNumerators` | `uint256[]` | From resolved market |

### **GambitFactory Contract**

#### **Write Functions**
| Function | Parameters | Returns | Notes |
|----------|-----------|---------|-------|
| `createDuel` | `(_marketAddress, _marketId, _joinDeadline, _creatorIsUp)` | `address clone` | Creates Wager clone |
| `cancelDuel` | `(clone)` | - | Cancels expired duel |
| `withdraw` | `(to, amount)` | - | Owner withdraws fees |

#### **Read Functions**
| Function | Returns | Notes |
|----------|---------|-------|
| `isReactiveMarket` | `bool` | Market uses newer DreamDEX impl? |
| `predictDuelAddress` | `address` | Pre-computed clone address |

### **ParimutuelPool Contract**

#### **Write Functions**
| Function | Parameters | Returns | Notes |
|----------|-----------|---------|-------|
| `depositUp` | - | - | Deposit on UP side (sends ETH) |
| `depositDown` | - | - | Deposit on DOWN side (sends ETH) |
| `resolve` | - | - | Resolves pool after market resolves |
| `claim` | - | - | Winner claims payout |
| `refund` | - | - | Initiates refund (market voided) |
| `claimRefund` | - | - | User claims refund |
| `cancel` | - | - | Cancel one-sided pool |

#### **Read Functions**
| Function | Returns | Notes |
|----------|---------|-------|
| `getPot` | `uint256` | Total pool balance |
| `getUserDeposit` | `(address)` | `(up, down)` | User's deposits per side |
| `getPoolSplit` | - | `(upPercent, downPercent)` | Pool split (basis points) |
| `isActive` | `bool` | Pool still accepting deposits? |

---

## Investigation & Findings

The repository includes detailed investigation reports on DreamDEX market mechanics and ERA 3 issues:

### **Key Findings** (from `investigation-report.md` & `investigation-resolution.md`)

1. **Market Registration Staleness**: 
   - DreamDEX recycles slot IDs across time windows
   - `BinaryMarketsModule` holds ONE-TIME registration (doesn't rotate)
   - Result: Stale market records after slot rotation → old payouts returned

2. **Resolution Guards Implemented**:
   - `settle()` guards: Check `marketExpiry + 1 hour > joinDeadline` to detect stale records
   - Fall back to re-resolving from module if stored address is dead
   - Alternative path: `settleByOracle()` for duels on recycled slots

3. **Pool Address Complications**:
   - Some DreamDEX market slots have **pool contracts that revert** (Era 3 issue)
   - Wager resolves to market contract (index 8), falls back to pool (index 9)
   - ParimutuelPool reads market directly (assumes it's healthy)

4. **Wrong Payout Detection**:
   - Markets report `isResolved() == true` with placeholder payouts `[1e7, 0]` while still trading
   - Implementation: Never settle before market's expiry timestamp

### **Proof Points**
- 5 live markets probed showing the pattern
- Clone duel state verified on-chain
- Indexer data cross-checked with on-chain resolution
- Revert reasons documented for troubleshooting

---

## Contributing

Contributions welcome! Please:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/my-feature`)
3. **Commit** changes with clear messages
4. **Push** to your fork
5. **Submit** a Pull Request with description

### **Development Guidelines**
- Follow Solidity style guide (spaces, naming)
- Write tests for new contracts
- Add JSDoc comments to smart contracts
- Test frontend components before submitting
- Update README if adding features

---

## License

Unlicensed (or specify your preferred license)

---

## Support & Resources

- **Live App**: [gambit-orpin.vercel.app](https://gambit-orpin.vercel.app)
- **Somnia Testnet**: [shannon-explorer.somnia.network](https://shannon-explorer.somnia.network)
- **DreamDEX**: [Binary prediction markets on Somnia](https://dreamdex.somnia.network)
- **RainbowKit Docs**: [rainbowkit.com](https://rainbowkit.com)
- **wagmi Docs**: [wagmi.sh](https://wagmi.sh)
- **Foundry Book**: [book.getfoundry.sh](https://book.getfoundry.sh)

---

## Acknowledgments

- **DreamDEX** for binary market infrastructure
- **Somnia** for EVM-compatible blockchain
- **OpenZeppelin** for secure smart contract libraries
- **Vercel** for frontend hosting
- **Community** for feedback and testing

---

**Last Updated**: September 2026  
**Repository**: [Abd00lmalik/Gambit](https://github.com/Abd00lmalik/Gambit)
