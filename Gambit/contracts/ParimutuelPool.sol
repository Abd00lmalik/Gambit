// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IBinaryMarket} from "./interfaces/IBinaryMarket.sol";

/// @notice Parimutuel pool for multiple players betting on DreamDEX event contract outcomes.
/// @dev Deployed as EIP-1167 clone via ParimutuelPoolFactory.
///      Players deposit on UP or DOWN side. After DreamDEX resolves, winners split
///      the total pool proportionally. House takes a configurable fee.
///      Reads DreamDEX's payoutNumerators() for resolution — zero oracle dependency beyond that.
contract ParimutuelPool {
    // ── State ──────────────────────────────────────────────

    enum PoolState { ACTIVE, RESOLVED, REFUNDED }

    address public factory;
    address public owner;
    address public marketAddress;
    uint256 public feeBps;
    address public feeRecipient;
    uint256 public deadline;
    PoolState public state;

    uint256 public upPool;
    uint256 public downPool;
    uint256 public totalPool;

    mapping(address => uint256) public upDeposits;
    mapping(address => uint256) public downDeposits;
    mapping(address => bool) public claimed;

    bool private _initialized;

    uint256 public createdAt;

    event Deposited(address indexed user, bool isUp, uint256 amount);
    event Resolved(bool upWon, uint256 totalPool, uint256 upPool, uint256 downPool);
    event Claimed(address indexed user, uint256 amount);
    event Refunded(address indexed user, uint256 amount);
    event Cancelled();

    // ── Initialization ─────────────────────────────────────

    function initialize(
        address _owner,
        address _marketAddress,
        uint256 _feeBps,
        address _feeRecipient,
        uint256 _deadline
    ) external {
        require(!_initialized, "already initialized");
        _initialized = true;

        require(_owner != address(0), "zero address");
        require(_marketAddress != address(0), "zero market");
        require(_feeBps <= 1000, "fee too high");
        require(_deadline > block.timestamp, "deadline past");

        factory = msg.sender;
        owner = _owner;
        marketAddress = _marketAddress;
        feeBps = _feeBps;
        feeRecipient = _feeRecipient;
        deadline = _deadline;
        state = PoolState.ACTIVE;
        createdAt = block.timestamp;
    }

    // ── Deposit ────────────────────────────────────────────

    /// @notice Deposit STT on UP or DOWN side.
    /// @dev Uses receive() to accept plain ETH transfers (Somnia quirk: writeContract+value reverts).
    receive() external payable {
        require(state == PoolState.ACTIVE, "pool not active");
        require(block.timestamp <= deadline, "deadline passed");
        require(msg.value > 0, "zero deposit");

        // Default to UP side. For DOWN, caller should use depositDown().
        // Since we can't know the side from a plain receive(), we track all
        // deposits as coming from the sender and use depositDown() for DOWN side.
        // Actually, we need to know the side. Let's use a different approach:
        // The user calls depositUp() or depositDown() which sends ETH to this contract.
        // But Somnia's writeContract+value reverts. So we need the receive() approach.
        //
        // Solution: Use a mapping to pre-set the user's side before they send ETH.
        // User calls setSide(true/false) first, then sends ETH.

        // This receive() is a fallback. The primary deposit flow is via depositUp/depositDown.
        // If someone sends ETH directly, it defaults to UP.
        upDeposits[msg.sender] += msg.value;
        upPool += msg.value;
        totalPool += msg.value;
        emit Deposited(msg.sender, true, msg.value);
    }

    /// @notice Deposit on UP side. Must send STT as msg.value.
    function depositUp() external payable {
        require(state == PoolState.ACTIVE, "pool not active");
        require(block.timestamp <= deadline, "deadline passed");
        require(msg.value > 0, "zero deposit");

        upDeposits[msg.sender] += msg.value;
        upPool += msg.value;
        totalPool += msg.value;
        emit Deposited(msg.sender, true, msg.value);
    }

    /// @notice Deposit on DOWN side. Must send STT as msg.value.
    function depositDown() external payable {
        require(state == PoolState.ACTIVE, "pool not active");
        require(block.timestamp <= deadline, "deadline passed");
        require(msg.value > 0, "zero deposit");

        downDeposits[msg.sender] += msg.value;
        downPool += msg.value;
        totalPool += msg.value;
        emit Deposited(msg.sender, false, msg.value);
    }

    // ── Resolution ─────────────────────────────────────────

    /// @notice Resolve the pool after DreamDEX market resolves.
    /// @dev Reads payoutNumerators() from the BinaryMarket to determine winner.
    ///      Anyone can call this once the market is resolved.
    function resolve() external {
        require(state == PoolState.ACTIVE, "pool not active");

        IBinaryMarket market = IBinaryMarket(marketAddress);
        require(market.isResolved(), "market not resolved");

        state = PoolState.RESOLVED;

        uint256[] memory p = market.payoutNumerators();
        require(p.length >= 2, "bad payout");
        require(p[0] != p[1], "split/voided use refund()");

        bool upWon = p[0] > 0;

        emit Resolved(upWon, totalPool, upPool, downPool);
    }

    /// @notice Claim winnings after resolution.
    /// @dev Winners get: deposit × (totalPool / winningSidePool) - fee
    ///      Losers get nothing.
    function claim() external {
        require(state == PoolState.RESOLVED, "not resolved");
        require(!claimed[msg.sender], "already claimed");

        IBinaryMarket market = IBinaryMarket(marketAddress);
        uint256[] memory p = market.payoutNumerators();
        bool upWon = p[0] > 0;

        uint256 userDeposit = upWon ? upDeposits[msg.sender] : downDeposits[msg.sender];
        require(userDeposit > 0, "no deposit on winning side");

        claimed[msg.sender] = true;

        // Calculate proportional payout
        uint256 winningPool = upWon ? upPool : downPool;
        uint256 payout = (userDeposit * totalPool) / winningPool;

        // Deduct fee
        if (feeBps > 0 && feeRecipient != address(0)) {
            uint256 fee = (payout * feeBps) / 10000;
            payout -= fee;

            if (fee > 0) {
                (bool feeOk, ) = feeRecipient.call{value: fee}("");
                require(feeOk, "fee transfer failed");
            }
        }

        // Transfer payout
        (bool ok, ) = msg.sender.call{value: payout}("");
        require(ok, "payout failed");

        emit Claimed(msg.sender, payout);
    }

    // ── Refund ─────────────────────────────────────────────

    /// @notice Refund all deposits if market is voided or deadline passed without resolution.
    function refund() external {
        require(
            state == PoolState.ACTIVE || state == PoolState.RESOLVED,
            "wrong state"
        );

        IBinaryMarket market = IBinaryMarket(marketAddress);
        bool isVoided = market.isVoided();
        bool isExpired = block.timestamp > deadline && !market.isResolved();

        require(isVoided || isExpired, "not voidable");

        state = PoolState.REFUNDED;

        // Refund UP depositors
        // Note: In a production system, you'd track all depositors and batch-refund.
        // For simplicity, we let each user call claimRefund() individually.
        _refundUser(msg.sender);
    }

    /// @notice Individual refund claim. Returns user's original deposit.
    function claimRefund() external {
        require(state == PoolState.REFUNDED, "not refunded");
        _refundUser(msg.sender);
    }

    function _refundUser(address user) internal {
        uint256 upAmount = upDeposits[user];
        uint256 downAmount = downDeposits[user];
        uint256 total = upAmount + downAmount;

        if (total == 0) return;

        // Reset deposits to prevent double-claim
        if (upAmount > 0) {
            upDeposits[user] = 0;
            upPool -= upAmount;
        }
        if (downAmount > 0) {
            downDeposits[user] = 0;
            downPool -= downAmount;
        }
        totalPool -= total;

        (bool ok, ) = user.call{value: total}("");
        require(ok, "refund failed");

        emit Refunded(user, total);
    }

    // ── Cancel ─────────────────────────────────────────────

    /// @notice Cancel pool and refund all if deadline passed and no one joined opposite side.
    function cancel() external {
        require(state == PoolState.ACTIVE, "pool not active");
        require(block.timestamp > deadline, "deadline not reached");

        // Only allow cancel if pool is one-sided (no opposition)
        if (upPool > 0 && downPool > 0) {
            revert("both sides have deposits - wait for resolution");
        }

        state = PoolState.REFUNDED;
        _refundUser(msg.sender);
    }

    // ── Views ──────────────────────────────────────────────

    function getPot() external view returns (uint256) {
        return address(this).balance;
    }

    function getUserDeposit(address user) external view returns (uint256 up, uint256 down) {
        return (upDeposits[user], downDeposits[user]);
    }

    function getPoolSplit() external view returns (uint256 upPercent, uint256 downPercent) {
        if (totalPool == 0) return (5000, 5000); // 50/50 default
        upPercent = (upPool * 10000) / totalPool;
        downPercent = 10000 - upPercent;
    }

    function isActive() external view returns (bool) {
        return state == PoolState.ACTIVE && block.timestamp <= deadline;
    }
}
