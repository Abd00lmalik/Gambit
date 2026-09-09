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

    /// @notice Event topic hash for the Resolved subscription.
    bytes32 public constant RESOLVED_TOPIC = keccak256("Resolved(uint32,uint256[])");

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

    /// @notice The reactivity subscription ID for Resolved events (newer DreamDEX impl).
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
    ///      Subscribes to ALL Resolved events (emitter=address(0)), then filters by
    ///      market ID in _onEvent(). This catches markets resolved by the newer DreamDEX
    ///      implementation (0x6b2fee58...) which emits Resolved(uint32,uint256[]).
    ///      Older-impl markets (0xd12ad05b...) never emit the event — the keeper
    ///      fallback handles those.
    /// @return success True if the subscription was created.
    function createSubscription() external returns (bool success) {
        require(msg.sender == factory, "!factory");
        require(subscriptionId == 0, "already subscribed");

        SomniaExtensions.SubscriptionOptions memory options = SomniaExtensions.SubscriptionOptions({
            priorityFeePerGas: 10_000_000_000,
            maxFeePerGas: 50_000_000_000,
            gasLimit: 2_000_000
        });

        // Subscribe to ALL Resolved events (emitter=address(0)).
        // _onEvent() filters by market ID to only react to our market's resolution.
        SomniaExtensions.SubscriptionFilter memory filter = SomniaExtensions.SubscriptionFilter({
            eventTopics: [
                keccak256("Resolved(uint32,uint256[])"),
                bytes32(0), bytes32(0), bytes32(0)
            ],
            origin: address(0),
            emitter: address(0)
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

    /// @dev Called by Somnia's reactivity precompile when a subscribed DreamDEX event fires.
    ///      Subscribes to ALL Resolved events (emitter=address(0)), then filters by market ID.
    ///      For older-impl markets that never emit Resolved, the keeper fallback handles settlement.
    function _onEvent(
        address emitter,
        bytes32[] calldata eventTopics,
        bytes calldata eventData
    ) internal override {
        bytes32 eventSignature = eventTopics[0];

        if (eventSignature == RESOLVED_TOPIC) {
            // Filter: only react if this Resolved event is for OUR market.
            // Event data layout: abi.encode(uint32 marketId, uint256[] payoutNumerators)
            if (eventData.length >= 32) {
                uint32 eventMarketId = uint32(uint256(bytes32(eventData[:32])));
                uint32 myMarketId = uint32(uint256(marketId));
                if (eventMarketId != myMarketId) return; // not our market, ignore
            }

            // If market resolves while duel is still open (no Player B joined),
            // automatically refund Player A's stake.
            if (state == WagerState.CREATED) {
                _executeCancelRefund();
                emit ReactiveAutoRefunded(block.timestamp, block.number);
                return;
            }

            if (state != WagerState.LOCKED) return;

            settlementTriggeredAt = block.timestamp;

            // Re-resolve if stored address is dead (Era 3 DreamDEX)
            address mktAddr = resolvedMarketContract;
            if (!_hasCode(mktAddr)) {
                mktAddr = _resolveMarketContract(marketId);
            }

            if (_hasCode(mktAddr)) {
                IBinaryMarket market = IBinaryMarket(mktAddr);
                if (market.isVoided()) {
                    _executeRefund();
                    emit ReactiveVoided(block.timestamp, block.number);
                } else {
                    settle();
                    emit ReactiveSettled(block.timestamp, block.number);
                }
            } else {
                // Market cannot be resolved — refund both players
                _executeRefund();
                emit ReactiveVoided(block.timestamp, block.number);
            }
            return;
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
    ///      If resolvedMarketContract has no code (Era 3 DreamDEX bug), re-resolves
    ///      from BinaryMarketsModule at settlement time to recover stuck duels.
    function settle() public inState(WagerState.LOCKED) {
        // If stored address is dead, re-resolve from the module
        address marketAddr = resolvedMarketContract;
        if (!_hasCode(marketAddr)) {
            marketAddr = _resolveMarketContract(marketId);
            require(_hasCode(marketAddr), "cannot resolve market");
        }

        IBinaryMarket market = IBinaryMarket(marketAddr);
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
    ///      If the market address (index 8) has no code (Era 3 DreamDEX), falls back
    ///      to the pool address (index 9) which does have code.
    function _resolveMarketContract(bytes32 _marketId) internal view returns (address) {
        uint256 moduleCodeSize;
        assembly { moduleCodeSize := extcodesize(BINARY_MARKETS_MODULE) }
        if (moduleCodeSize == 0) return address(0); // no module (tests)

        (bool ok, bytes memory result) = BINARY_MARKETS_MODULE.staticcall(
            abi.encodeWithSignature("markets(bytes32)", _marketId)
        );
        if (!ok || result.length < 320) return address(0); // need at least 10 fields (index 9)

        address marketAddr;
        assembly { marketAddr := mload(add(result, 288)) } // index 8 = market

        if (_hasCode(marketAddr)) return marketAddr;

        // Market address has no code (Era 3 DreamDEX) — fall back to pool address (index 9)
        address poolAddr;
        assembly { poolAddr := mload(add(result, 320)) } // index 9 = pool
        return poolAddr;
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
            (bool unsubOk, ) = address(0x0100).call(
                abi.encodeWithSignature("unsubscribe(uint256)", subscriptionId)
            );
            if (unsubOk) emit SubscriptionCancelled(subscriptionId);
            subscriptionId = 0;
        }
    }

    /// @dev Cancel the reactivity subscription and sweep remaining fund back to factory.
    ///      Called at the end of settle() and refund(). Non-critical: if unsubscribe
    ///      fails, we still sweep the fund — the subscription becomes orphaned but
    ///      the clone balance is recovered.
    function _reclaimSubscriptionFund() internal {
        if (subscriptionId != 0) {
            (bool unsubOk, ) = address(0x0100).call(
                abi.encodeWithSignature("unsubscribe(uint256)", subscriptionId)
            );
            if (unsubOk) emit SubscriptionCancelled(subscriptionId);
            subscriptionId = 0;
        }

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
