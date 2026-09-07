// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IBinaryMarket} from "./interfaces/IBinaryMarket.sol";
import {IBinaryMarketsModule} from "./interfaces/IBinaryMarketsModule.sol";
import {SomniaEventHandler, SomniaExtensions} from "./interfaces/somnia/SomniaExtensions.sol";

/// @notice Per-duel escrow logic contract. Deployed once; cloned per wager via GambitFactory.
/// @dev Uses EIP-1167 clone pattern. State set via initialize(), not constructor.
///      Inherits SomniaEventHandler for reactive auto-settlement: when the DreamDEX
///      market resolves, Somnia's reactivity precompile delivers the event to _onEvent()
///      in the same block, which calls settle() automatically — no keeper needed.
contract Wager is SomniaEventHandler {
    // ── State ──────────────────────────────────────────────

    enum WagerState { CREATED, LOCKED, SETTLED, REFUNDED, CANCELLED }

    /// @notice BinaryMarketsModule — the registry that maps marketId → Market contract.
    address public constant BINARY_MARKETS_MODULE = 0x3ecC694Cef705358864a646142ac17A90E29e388;

    address public factory;
    address public owner;
    address public playerA;
    address public playerB;
    uint256 public stakeAmount;
    address public marketAddress;
    bytes32 public marketId;
    uint256 public feeBps;
    address public feeRecipient;
    uint256 public joinDeadline;
    WagerState public state;
    mapping(address => uint256) public deposits;
    bool private _initialized;
    uint256 public subscriptionFund;

    /// @notice The reactivity subscription ID for this duel's market resolution.
    uint256 public subscriptionId;

    /// @notice Block timestamp when _onEvent() triggered settlement.
    uint256 public settlementTriggeredAt;

    /// @notice Resolved Market contract address (from BinaryMarketsModule.markets(marketId)).
    /// @dev Stored once at initialize() time. Used by settle(), refund(), and _onEvent()
    ///      to read isResolved/isVoided/payoutNumerators — never reads from raw marketAddress,
    ///      which may be a CLOB reactivity address with no EVM code.
    address public resolvedMarketContract;

    /// @notice Emitted when reactive settlement fires.
    event ReactiveSettled(uint256 timestamp, uint256 blockNumber);
    /// @notice Emitted when reactive void-refund fires.
    event ReactiveVoided(uint256 timestamp, uint256 blockNumber);
    /// @notice Emitted when reactive auto-refund fires for unjoined duel.
    event ReactiveAutoRefunded(uint256 timestamp, uint256 blockNumber);
    /// @notice Emitted when subscription is created.
    event SubscriptionCreated(uint256 subscriptionId);
    /// @notice Emitted when subscription is cancelled.
    event SubscriptionCancelled(uint256 subscriptionId);
    /// @notice Emitted when factory cancels an expired CREATED duel.
    event FactoryCancelled(uint256 timestamp);

    // ── Initialization ─────────────────────────────────────

    /// @notice Initialize a new duel instance (called by factory immediately after cloning).
    /// @dev Creates a Somnia reactivity subscription to auto-settle when the DreamDEX
    ///      market resolves. Requires the contract to hold >= 32 SOMI for subscription.
    function initialize(
        address _playerA,
        uint256 _stakeAmount,
        address _marketAddress,
        bytes32 _marketId,
        uint256 _feeBps,
        address _feeRecipient,
        uint256 _joinDeadline
    ) external {
        require(!_initialized, "already initialized");
        _initialized = true;

        require(_playerA != address(0), "zero address");
        require(_stakeAmount > 0, "zero stake");
        require(_marketAddress != address(0), "zero market");
        require(_feeBps <= 1000, "fee too high");
        require(_joinDeadline > block.timestamp, "deadline past");

        factory = msg.sender;
        owner = _playerA;
        playerA = _playerA;
        stakeAmount = _stakeAmount;
        marketAddress = _marketAddress;
        marketId = _marketId;
        feeBps = _feeBps;
        feeRecipient = _feeRecipient;
        joinDeadline = _joinDeadline;
        state = WagerState.CREATED;

        // Resolve the canonical Market contract ONCE and store it.
        // In production: BinaryMarketsModule exists → resolves to the real Market contract.
        // In tests: no module → fallback to marketAddress (the MockMarket address).
        address resolved = _resolveMarketContract(_marketId);
        if (resolved == address(0)) {
            resolved = _marketAddress;
        }
        resolvedMarketContract = resolved;
        // Note: reactivity subscription is created AFTER factory funds this clone
        // via createSubscription(), because the precompile requires >= 32 SOMI balance.
    }

    /// @notice Create a Somnia reactivity subscription for DreamDEX market resolution.
    /// @dev Called by the factory AFTER funding this clone with subscription SOMI.
    ///      Uses the resolved Market contract stored at initialize() time — never
    ///      trusts the directly-supplied marketAddress, which may be a CLOB reactivity
    ///      address with no EVM code.
    /// @return success True if subscription was created, false if it failed (non-critical).
    function createSubscription() external returns (bool success) {
        require(msg.sender == factory, "!factory");
        require(subscriptionId == 0, "already subscribed");

        // Use the pre-resolved Market contract (set at initialize() time).
        address marketContract = resolvedMarketContract;
        require(marketContract != address(0), "market not found");
        require(_hasCode(marketContract), "market has no code");

        // keccak256("Resolved(uint32,uint256[])")
        // Emitted by BinaryMarket when oracle resolves the market.
        bytes32 resolvedTopic = keccak256("Resolved(uint32,uint256[])");

        SomniaExtensions.SubscriptionFilter memory filter = SomniaExtensions.SubscriptionFilter({
            eventTopics: [
                resolvedTopic,
                bytes32(0),
                bytes32(0),
                bytes32(0)
            ],
            origin: address(0),
            emitter: marketContract // resolved Market contract, not marketAddress
        });

        SomniaExtensions.SubscriptionOptions memory options = SomniaExtensions.SubscriptionOptions({
            priorityFeePerGas: 10_000_000_000, // 10 gwei
            maxFeePerGas: 50_000_000_000,       // 50 gwei
            gasLimit: 2_000_000
        });

        subscriptionId = SomniaExtensions.subscribe(address(this), filter, options);
        emit SubscriptionCreated(subscriptionId);
        return true;
    }

    // ── Modifiers ──────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "!owner");
        _;
    }

    modifier inState(WagerState _state) {
        require(state == _state, "wrong state");
        _;
    }

    // ── Somnia Reactivity Handler ─────────────────────────

    /// @dev Called by Somnia's reactivity precompile when the subscribed DreamDEX event fires.
    ///      This is the "hero mechanic" — settlement happens in the same block as resolution,
    ///      with zero manual transactions or off-chain keepers.
    ///      Handles both normal resolution (settle) and voided markets (refund).
    function _onEvent(
        address emitter,
        bytes32[] calldata eventTopics,
        bytes calldata
    ) internal override {
        // Security: verify this is a Resolved event.
        // The emitter address is already filtered by the precompile subscription —
        // only events from the resolved Market contract reach here.
        require(
            eventTopics[0] == keccak256("Resolved(uint32,uint256[])"),
            "!Resolved"
        );

        // If market resolves while duel is still open (no Player B joined),
        // automatically refund Player A's stake — zero manual intervention.
        if (state == WagerState.CREATED) {
            _executeCancelRefund();
            emit ReactiveAutoRefunded(block.timestamp, block.number);
            return;
        }

        // Only process if we're in LOCKED state (both players joined, waiting for resolution)
        if (state != WagerState.LOCKED) return;

        // Record the exact block timestamp for latency measurement
        settlementTriggeredAt = block.timestamp;

        // Check if the market was voided (oracle failure, dispute, etc.)
        IBinaryMarket market = IBinaryMarket(resolvedMarketContract);
        if (market.isVoided()) {
            // Voided: both players get their stake back
            _executeRefund();
            emit ReactiveVoided(block.timestamp, block.number);
        } else {
            // Normal resolution: determine winner and distribute pot
            settle();
            emit ReactiveSettled(block.timestamp, block.number);
        }
    }

    // ── Deposit functions ──────────────────────────────────

    /// @notice Record player A's deposit when factory forwards STT during createDuel().
    /// @dev Only callable by the factory. Overpayment is rejected.
    function recordDeposit(address player) external payable {
        require(msg.sender == factory, "!factory");
        require(deposits[player] + msg.value <= stakeAmount, "overpayment");
        deposits[player] += msg.value;
    }

    /// @notice Accepts STT deposits and tracks them per sender.
    /// @dev Used by player B to deposit. Factory also sends subscription fund.
    ///      Limit is stakeAmount + SUBSCRIPTION_FUND to allow factory funding.
    ///      IMPORTANT on Somnia: gas limit must be >=2,000,000 for calls triggering this.
    receive() external payable {
        if (msg.sender == factory) {
            // Factory's transfers after recordDeposit are subscription funds.
            // Tracked in subscriptionFund, not deposits[] (doesn't affect pot).
            subscriptionFund += msg.value;
            return;
        }
        require(deposits[msg.sender] + msg.value <= stakeAmount, "overpayment");
        deposits[msg.sender] += msg.value;
    }

    // ── External functions ─────────────────────────────────

    /// @notice Player B joins by confirming their deposit is sufficient.
    /// @dev B must send a plain STT transfer to this contract BEFORE calling join().
    ///      The receive() function tracks deposits per address.
    function join() external inState(WagerState.CREATED) {
        require(block.timestamp <= joinDeadline, "deadline passed");
        require(playerB == address(0), "already joined");
        require(msg.sender != playerA, "cannot self-duel");
        require(deposits[msg.sender] >= stakeAmount, "insufficient deposit");

        playerB = msg.sender;
        state = WagerState.LOCKED;
    }

    /// @notice Permissionless settlement once DreamDEX market is resolved.
    /// @dev Reads payoutNumerators() to determine winner. Pays out pot minus fee.
    ///      Can be called manually OR triggered automatically by _onEvent().
    ///      After settlement, unsubscribes from reactivity and sweeps leftover
    ///      subscription fund back to the factory for reuse.
    function settle() public inState(WagerState.LOCKED) {
        IBinaryMarket market = IBinaryMarket(resolvedMarketContract);
        require(market.isResolved(), "not resolved");
        require(!market.isVoided(), "voided use refund()");

        uint256[] memory p = market.payoutNumerators();
        require(p.length >= 2, "bad payout");
        require(p[0] != 0 || p[1] != 0, "no payout set");
        require(p[0] != p[1], "split/voided");

        state = WagerState.SETTLED;

        uint256 pot = address(this).balance - subscriptionFund;
        address winner = (p[0] > 0) ? playerA : playerB;

        if (feeBps > 0 && feeRecipient != address(0)) {
            uint256 fee = (pot * feeBps) / 10000;
            uint256 winnerPayout = pot - fee;

            (bool feeOk, ) = feeRecipient.call{value: fee}("");
            require(feeOk, "fee transfer failed");

            (bool winOk, ) = winner.call{value: winnerPayout}("");
            require(winOk, "winner transfer failed");
        } else {
            (bool ok, ) = winner.call{value: pot}("");
            require(ok, "payout failed");
        }

        _reclaimSubscriptionFund();
    }

    /// @notice Refund both players when market is voided.
    function refund() external inState(WagerState.LOCKED) {
        IBinaryMarket market = IBinaryMarket(resolvedMarketContract);
        require(market.isVoided(), "not voided");
        _executeRefund();
    }

    // ── Internal helpers ───────────────────────────────────

    /// @dev Resolve the canonical Market contract address from BinaryMarketsModule.
    ///      The Market contract emits Resolved events — it is NOT the same as marketAddress
    ///      (which may be a CLOB reactivity address with no EVM code).
    function _resolveMarketContract(bytes32 _marketId) internal view returns (address) {
        (bool ok, bytes memory result) = BINARY_MARKETS_MODULE.staticcall(
            abi.encodeWithSignature("markets(bytes32)", _marketId)
        );
        if (!ok || result.length < 320) return address(0); // 10 words * 32 bytes

        // Decode the MarketRecord struct. The `market` field is at word index 8.
        // In memory, result = <32-byte length><word0><word1>...<word13>
        // Word 8 starts at result + 32 + (8 * 32) = result + 288
        // The address occupies the last 20 bytes of the word (bytes 12-31).
        address marketAddr;
        assembly {
            // Read word 8 and mask to get the address (lower 20 bytes)
            marketAddr := and(
                mload(add(result, 288)),
                0xffffffffffffffffffffffffffffffffffffffff
            )
        }
        return marketAddr;
    }

    /// @dev Check if an address has contract code deployed.
    function _hasCode(address addr) internal view returns (bool) {
        uint256 codeSize;
        assembly { codeSize := extcodesize(addr) }
        return codeSize > 0;
    }

    /// @dev Core refund logic, callable from _onEvent() and refund().
    function _executeRefund() internal {
        state = WagerState.REFUNDED;

        uint256 aStake = deposits[playerA];
        uint256 bStake = deposits[playerB];

        if (aStake > 0) {
            deposits[playerA] = 0;
            (bool okA, ) = playerA.call{value: aStake}("");
            require(okA, "refund A failed");
        }
        if (bStake > 0) {
            deposits[playerB] = 0;
            (bool okB, ) = playerB.call{value: bStake}("");
            require(okB, "refund B failed");
        }

        _reclaimSubscriptionFund();
    }

    /// @dev Refund Player A only when market resolves but B never joined.
    ///      Callable from _onEvent() (reactive) or cancel() (manual after deadline).
    /// @dev IMPORTANT: State is set AFTER the transfer succeeds.
    ///      If the transfer fails, state stays CREATED so cancel() can be retried.
    function _executeCancelRefund() internal {
        uint256 aStake = deposits[playerA];
        if (aStake > 0) {
            (bool ok, ) = playerA.call{value: aStake}("");
            require(ok, "cancel refund failed");
            deposits[playerA] = 0;
        }

        state = WagerState.CANCELLED;
        _reclaimSubscriptionFund();
    }

    /// @notice Player A reclaims stake if B never joined before deadline.
    function cancel() external inState(WagerState.CREATED) onlyOwner {
        require(block.timestamp > joinDeadline, "deadline not reached");
        _executeCancelRefund();
    }

    /// @notice Factory-initiated cancel for expired CREATED duels.
    /// @dev Allows the keeper to automatically refund creators when deadline passes
    ///      and nobody joined. Permissionless after deadline — prevents stuck funds.
    function factoryCancel() external inState(WagerState.CREATED) {
        require(msg.sender == factory, "!factory");
        require(block.timestamp > joinDeadline, "deadline not reached");
        _executeCancelRefund();
        emit FactoryCancelled(block.timestamp);
    }

    /// @notice Cancel the reactivity subscription (e.g. if duel is cancelled/refunded).
    function cancelSubscription() external {
        require(
            msg.sender == factory || msg.sender == owner,
            "!authorized"
        );
        if (subscriptionId != 0) {
            SomniaExtensions.unsubscribe(subscriptionId);
            emit SubscriptionCancelled(subscriptionId);
            subscriptionId = 0;
        }
    }

    /// @dev Cancel reactivity subscription and sweep remaining fund back to factory.
    ///      Called at the end of settle() and refund(). Non-critical: if unsubscribe
    ///      fails, the fund stays in the clone (can be swept manually later).
    function _reclaimSubscriptionFund() internal {
        // 1. Cancel the subscription (stops future charges)
        if (subscriptionId != 0) {
            SomniaExtensions.unsubscribe(subscriptionId);
            emit SubscriptionCancelled(subscriptionId);
            subscriptionId = 0;
        }

        // 2. Sweep remaining balance back to factory
        uint256 remaining = address(this).balance;
        if (remaining > 0) {
            subscriptionFund = 0;
            (bool ok, ) = factory.call{value: remaining}("");
            require(ok, "sweep failed");
        }
    }

    // ── Views ──────────────────────────────────────────────

    function getPot() external view returns (uint256) {
        return address(this).balance;
    }

    /// @notice Returns seconds remaining until the join deadline. 0 if expired.
    function joinDeadlineRemaining() external view returns (uint256) {
        if (block.timestamp >= joinDeadline) return 0;
        return joinDeadline - block.timestamp;
    }

    /// @notice Returns true if reactive settlement has been triggered.
    function isReactiveSettlement() external view returns (bool) {
        return settlementTriggeredAt > 0;
    }
}
