// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IBinaryMarket} from "./interfaces/IBinaryMarket.sol";
import {IBinaryMarketsModule} from "./interfaces/IBinaryMarketsModule.sol";

/// @notice Per-duel escrow logic contract. Deployed once; cloned per wager via GambitFactory.
/// @dev Uses EIP-1167 clone pattern. State set via initialize(), not constructor.
///      Settlement is handled by the keeper (off-chain) calling settle() after market resolution.
contract Wager {
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

    /// @notice Resolved Market contract address (from BinaryMarketsModule.markets(marketId)).
    /// @dev Stored once at initialize() time. Used by settle(), refund() to read
    ///      isResolved/isVoided/payoutNumerators — never reads from raw marketAddress,
    ///      which may be a CLOB reactivity address with no EVM code.
    address public resolvedMarketContract;

    /// @notice Emitted when factory cancels an expired CREATED duel.
    event FactoryCancelled(uint256 timestamp);

    // ── Initialization ─────────────────────────────────────

    /// @notice Initialize a new duel instance (called by factory immediately after cloning).
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

    // ── Deposit functions ──────────────────────────────────

    /// @notice Record player A's deposit when factory forwards STT during createDuel().
    /// @dev Only callable by the factory. Overpayment is rejected.
    function recordDeposit(address player) external payable {
        require(msg.sender == factory, "!factory");
        require(deposits[player] + msg.value <= stakeAmount, "overpayment");
        deposits[player] += msg.value;
    }

    /// @notice Accepts STT deposits and tracks them per sender.
    /// @dev Used by player B to deposit.
    receive() external payable {
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

        // The payout vector is indexed by OUTCOME SLOT, and each outcome's slot
        // is the low byte of the market's own yesId/noId. Assuming payouts[0]
        // == YES is what paid the wrong player on Somnia testnet (these markets
        // settle [No, Yes]: verified on duels 0x267AAFb3… and 0x651d5be6…, 2026-09-10).
        uint256 yesSlot = uint8(uint256(market.yesId()));
        uint256 noSlot = uint8(uint256(market.noId()));
        require(yesSlot < p.length && noSlot < p.length && yesSlot != noSlot, "bad slots");

        uint256 pYes = p[yesSlot];
        uint256 pNo = p[noSlot];
        require(pYes != 0 || pNo != 0, "no payout set");

        // Split/void result: both outcomes paid equally → refund both players
        if (pYes == pNo) {
            _executeRefund();
            return;
        }

        state = WagerState.SETTLED;

        uint256 pot = address(this).balance;
        // Convention (factory-enforced): playerA is the market's YES side
        // (creator stakes the "above" leg; joiner takes NO).
        address winner = (pYes > pNo) ? playerA : playerB;

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

    /// @dev Core refund logic, callable from refund(), settle(), and factoryCancel().
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
    }

    /// @dev Refund Player A only when market resolves but B never joined.
    ///      Callable from cancel() (manual after deadline) or factoryCancel().
    function _executeCancelRefund() internal {
        uint256 aStake = deposits[playerA];
        if (aStake > 0) {
            (bool ok, ) = playerA.call{value: aStake}("");
            require(ok, "cancel refund failed");
            deposits[playerA] = 0;
        }
        state = WagerState.CANCELLED;
    }

    /// @notice Player A reclaims stake if B never joined before deadline.
    function cancel() external inState(WagerState.CREATED) onlyOwner {
        require(block.timestamp > joinDeadline, "deadline not reached");
        _executeCancelRefund();
    }

    /// @notice Factory-initiated cancel for expired CREATED duels.
    /// @dev Allows the keeper to automatically refund creators when:
    ///      (a) joinDeadline passed and nobody joined, OR
    ///      (b) market resolved before deadline — creator gets stake back immediately
    ///          since no one would join after resolution. Prevents stuck funds.
    function factoryCancel() external inState(WagerState.CREATED) {
        require(msg.sender == factory, "!factory");

        bool deadlinePassed = block.timestamp > joinDeadline;
        if (!deadlinePassed) {
            // Before deadline: only allow if market already resolved
            address marketAddr = resolvedMarketContract;
            if (!_hasCode(marketAddr)) {
                marketAddr = _resolveMarketContract(marketId);
            }
            if (_hasCode(marketAddr)) {
                IBinaryMarket market = IBinaryMarket(marketAddr);
                require(market.isResolved(), "deadline not reached");
            } else {
                require(false, "deadline not reached");
            }
        }

        _executeCancelRefund();
        emit FactoryCancelled(block.timestamp);
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
}
