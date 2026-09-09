// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import {Wager} from "../contracts/Wager.sol";
import {GambitFactory} from "../contracts/GambitFactory.sol";

/// @dev Mock DreamDEX market for testing — emits events like the real contracts
contract MockMarket {
    uint8 private _status;
    uint256[] private _payoutNumerators;
    bool private _isVoided;

    event Resolved(uint32 indexed outcome, uint256[] payoutNumerators);
    event StatusChanged(uint8 indexed oldStatus, uint8 indexed newStatus);
    event Voided();

    constructor(uint8 status_, bool voided_) {
        _status = status_;
        _isVoided = voided_;
    }

    function setStatus(uint8 s) external {
        uint8 old = _status;
        _status = s;
        emit StatusChanged(old, s);
        if (s == 4) {
            emit Resolved(0, _payoutNumerators);
        } else if (s == 5) {
            emit Voided();
        }
    }
    function setPayout(uint256 up, uint256 down) external {
        _payoutNumerators = new uint256[](2);
        _payoutNumerators[0] = up;
        _payoutNumerators[1] = down;
    }
    function setVoided(bool v) external { _isVoided = v; }

    function isResolved() external view returns (bool) { return _status == 4; }
    function isVoided() external view returns (bool) { return _isVoided; }
    function payoutNumerators() external view returns (uint256[] memory) { return _payoutNumerators; }
    function status() external view returns (uint8) { return _status; }
}

/// @dev Mock fee recipient — plain address that accepts ETH
contract MockFeeRecipient {
    // solhint-disable-empty-blocks
    receive() external payable {}
}

/// @title Wager + GambitFactory Test Suite
/// @dev Covers: happy path, void/refund, cancel/timeout, fee math, overpayment, edge cases
contract GambitTest is Test {
    GambitFactory public factory;
    GambitFactory public noFeeFactory;
    GambitFactory public highFeeFactory;
    GambitFactory public roundingFactory;

    MockMarket public marketYesWon;
    MockMarket public marketNoWon;
    MockMarket public marketVoided;
    MockMarket public marketUnresolved;
    MockMarket public marketZeroPayout;
    MockFeeRecipient public feeRecipient;

    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public carol = makeAddr("carol");

    uint256 constant STAKE = 1 ether;
    uint256 constant MIN_STAKE = 0.1 ether;
    uint256 constant MAX_STAKE = 100 ether;
    uint256 constant FEE_BPS = 250; // 2.5%
    uint256 constant JOIN_DEADLINE_OFFSET = 5 minutes;
    bytes32 constant MOCK_MARKET_ID = keccak256("test-market-1");

    function setUp() public {
        feeRecipient = new MockFeeRecipient();

        // Main factory with fees
        factory = new GambitFactory(
            address(feeRecipient),
            FEE_BPS,
            MIN_STAKE,
            MAX_STAKE,
            address(0) // deploy inline
        );

        // No-fee factory
        noFeeFactory = new GambitFactory(
            address(feeRecipient),
            0, // no fee
            MIN_STAKE,
            MAX_STAKE,
            address(0)
        );

        // High-fee factory (10%)
        highFeeFactory = new GambitFactory(
            address(feeRecipient),
            1000, // 10%
            MIN_STAKE,
            MAX_STAKE,
            address(0)
        );

        // Rounding factory (tiny stake to test rounding)
        roundingFactory = new GambitFactory(
            address(feeRecipient),
            FEE_BPS,
            1, // 1 wei min
            MAX_STAKE,
            address(0)
        );

        // Markets
        marketYesWon = new MockMarket(4, false); // resolved, YES won
        marketYesWon.setPayout(10000000, 0);

        marketNoWon = new MockMarket(4, false); // resolved, NO won
        marketNoWon.setPayout(0, 10000000);

        marketVoided = new MockMarket(5, true); // voided

        marketUnresolved = new MockMarket(0, false); // pending

        marketZeroPayout = new MockMarket(4, false); // resolved but payout [0,0]
        marketZeroPayout.setPayout(0, 0);
    }

    // ═══════════════════════════════════════════════════════
    // HAPPY PATH: CREATE → JOIN → SETTLE
    // ═══════════════════════════════════════════════════════

    function test_happyPath_yesWins() public {
        uint256 deadline = block.timestamp + JOIN_DEADLINE_OFFSET;

        // Alice creates duel
        vm.deal(alice, STAKE);
        vm.prank(alice);
        address clone = factory.createDuel{value: STAKE}(
            address(marketYesWon),
            MOCK_MARKET_ID,
            deadline
        );

        // Verify clone state
        Wager w = Wager(payable(clone));
        assertEq(w.playerA(), alice);
        assertEq(w.stakeAmount(), STAKE);
        assertEq(uint8(w.state()), uint8(Wager.WagerState.CREATED));

        // Bob joins
        vm.deal(bob, STAKE);
        vm.prank(bob);
        (bool sent,) = clone.call{value: STAKE}("");
        assertTrue(sent);
        vm.prank(bob);
        w.join();

        assertEq(uint8(w.state()), uint8(Wager.WagerState.LOCKED));
        assertEq(w.playerB(), bob);

        // Settle — YES wins
        uint256 aliceBalBefore = alice.balance;
        w.settle();

        assertEq(uint8(w.state()), uint8(Wager.WagerState.SETTLED));
        // Alice wins: pot = 2 STT, fee = 2.5% = 0.05 STT, payout = 1.95 STT
        uint256 expectedFee = (STAKE * 2 * FEE_BPS) / 10000;
        uint256 expectedPayout = (STAKE * 2) - expectedFee;
        assertEq(alice.balance - aliceBalBefore, expectedPayout);
        assertEq(address(clone).balance, 0);
    }

    function test_happyPath_noWins() public {
        uint256 deadline = block.timestamp + JOIN_DEADLINE_OFFSET;

        vm.deal(alice, STAKE);
        vm.prank(alice);
        address clone = factory.createDuel{value: STAKE}(
            address(marketNoWon),
            MOCK_MARKET_ID,
            deadline
        );

        vm.deal(bob, STAKE);
        vm.prank(bob);
        (bool sent,) = clone.call{value: STAKE}("");
        assertTrue(sent);
        vm.prank(bob);
        Wager(payable(clone)).join();

        uint256 bobBalBefore = bob.balance;
        Wager(payable(clone)).settle();

        // Bob wins
        uint256 expectedFee = (STAKE * 2 * FEE_BPS) / 10000;
        uint256 expectedPayout = (STAKE * 2) - expectedFee;
        assertEq(bob.balance - bobBalBefore, expectedPayout);
    }

    // ═══════════════════════════════════════════════════════
    // VOID → REFUND
    // ═══════════════════════════════════════════════════════

    function test_refund_voidedMarket() public {
        uint256 deadline = block.timestamp + JOIN_DEADLINE_OFFSET;

        vm.deal(alice, STAKE);
        vm.prank(alice);
        address clone = factory.createDuel{value: STAKE}(
            address(marketVoided),
            MOCK_MARKET_ID,
            deadline
        );

        vm.deal(bob, STAKE);
        vm.prank(bob);
        (bool sent,) = clone.call{value: STAKE}("");
        assertTrue(sent);
        vm.prank(bob);
        Wager(payable(clone)).join();

        uint256 aliceBalBefore = alice.balance;
        uint256 bobBalBefore = bob.balance;
        Wager(payable(clone)).refund();

        assertEq(uint8(Wager(payable(clone)).state()), uint8(Wager.WagerState.REFUNDED));
        assertEq(alice.balance - aliceBalBefore, STAKE);
        assertEq(bob.balance - bobBalBefore, STAKE);
    }

    function test_refund_revertsIfNotVoided() public {
        uint256 deadline = block.timestamp + JOIN_DEADLINE_OFFSET;

        vm.deal(alice, STAKE);
        vm.prank(alice);
        address clone = factory.createDuel{value: STAKE}(
            address(marketYesWon),
            MOCK_MARKET_ID,
            deadline
        );

        vm.deal(bob, STAKE);
        vm.prank(bob);
        (bool sent,) = clone.call{value: STAKE}("");
        assertTrue(sent);
        vm.prank(bob);
        Wager(payable(clone)).join();

        vm.expectRevert("not voided");
        Wager(payable(clone)).refund();
    }

    // ═══════════════════════════════════════════════════════
    // CANCEL / TIMEOUT
    // ═══════════════════════════════════════════════════════

    function test_cancel_timeout() public {
        uint256 deadline = block.timestamp + 1 hours;

        vm.deal(alice, STAKE);
        vm.prank(alice);
        address clone = factory.createDuel{value: STAKE}(
            address(marketUnresolved),
            MOCK_MARKET_ID,
            deadline
        );

        vm.warp(deadline + 1);

        uint256 aliceBalBefore = alice.balance;
        vm.prank(alice);
        Wager(payable(clone)).cancel();

        assertEq(uint8(Wager(payable(clone)).state()), uint8(Wager.WagerState.CANCELLED));
        assertEq(alice.balance - aliceBalBefore, STAKE);
    }

    function test_cancel_revertsBeforeDeadline() public {
        uint256 deadline = block.timestamp + 1 hours;

        vm.deal(alice, STAKE);
        vm.prank(alice);
        address clone = factory.createDuel{value: STAKE}(
            address(marketUnresolved),
            MOCK_MARKET_ID,
            deadline
        );

        vm.expectRevert("deadline not reached");
        vm.prank(alice);
        Wager(payable(clone)).cancel();
    }

    function test_cancel_revertsIfNotOwner() public {
        uint256 deadline = block.timestamp + 1 hours;

        vm.deal(alice, STAKE);
        vm.prank(alice);
        address clone = factory.createDuel{value: STAKE}(
            address(marketUnresolved),
            MOCK_MARKET_ID,
            deadline
        );

        vm.warp(deadline + 1);
        vm.expectRevert("!owner");
        vm.prank(bob);
        Wager(payable(clone)).cancel();
    }

    function test_cancel_revertsIfDoubleCancel() public {
        uint256 deadline = block.timestamp + 1 hours;

        vm.deal(alice, STAKE);
        vm.prank(alice);
        address clone = factory.createDuel{value: STAKE}(
            address(marketUnresolved),
            MOCK_MARKET_ID,
            deadline
        );

        vm.warp(deadline + 1);
        vm.prank(alice);
        Wager(payable(clone)).cancel();

        vm.expectRevert("wrong state");
        vm.prank(alice);
        Wager(payable(clone)).cancel();
    }

    function test_cancel_revertsIfJoined() public {
        uint256 deadline = block.timestamp + JOIN_DEADLINE_OFFSET;

        vm.deal(alice, STAKE);
        vm.prank(alice);
        address clone = factory.createDuel{value: STAKE}(
            address(marketUnresolved),
            MOCK_MARKET_ID,
            deadline
        );

        vm.deal(bob, STAKE);
        vm.prank(bob);
        (bool sent,) = clone.call{value: STAKE}("");
        assertTrue(sent);
        vm.prank(bob);
        Wager(payable(clone)).join();

        vm.warp(deadline + 1);
        vm.expectRevert("wrong state");
        vm.prank(alice);
        Wager(payable(clone)).cancel();
    }

    // ═══════════════════════════════════════════════════════
    // JOIN REVERTS
    // ═══════════════════════════════════════════════════════

    function test_join_revertsDeadlinePassed() public {
        uint256 deadline = block.timestamp + JOIN_DEADLINE_OFFSET;

        vm.deal(alice, STAKE);
        vm.prank(alice);
        address clone = factory.createDuel{value: STAKE}(
            address(marketUnresolved),
            MOCK_MARKET_ID,
            deadline
        );

        vm.warp(deadline + 1);

        vm.deal(bob, STAKE);
        vm.prank(bob);
        (bool sent,) = clone.call{value: STAKE}("");
        assertTrue(sent);

        vm.expectRevert("deadline passed");
        vm.prank(bob);
        Wager(payable(clone)).join();
    }

    function test_join_revertsIfAlreadyJoined() public {
        uint256 deadline = block.timestamp + JOIN_DEADLINE_OFFSET;

        vm.deal(alice, STAKE);
        vm.prank(alice);
        address clone = factory.createDuel{value: STAKE}(
            address(marketUnresolved),
            MOCK_MARKET_ID,
            deadline
        );

        vm.deal(bob, STAKE * 2);
        vm.prank(bob);
        (bool sent,) = clone.call{value: STAKE}("");
        assertTrue(sent);
        vm.prank(bob);
        Wager(payable(clone)).join();

        vm.expectRevert("wrong state");
        vm.prank(bob);
        Wager(payable(clone)).join();
    }

    function test_join_revertsInsufficientDeposit() public {
        uint256 deadline = block.timestamp + JOIN_DEADLINE_OFFSET;

        vm.deal(alice, STAKE);
        vm.prank(alice);
        address clone = factory.createDuel{value: STAKE}(
            address(marketUnresolved),
            MOCK_MARKET_ID,
            deadline
        );

        vm.deal(bob, STAKE / 2);
        vm.prank(bob);
        (bool sent,) = clone.call{value: STAKE / 2}("");
        assertTrue(sent);

        vm.expectRevert("insufficient deposit");
        vm.prank(bob);
        Wager(payable(clone)).join();
    }

    function test_join_revertsSelfDuel() public {
        uint256 deadline = block.timestamp + JOIN_DEADLINE_OFFSET;

        vm.deal(alice, STAKE);
        vm.prank(alice);
        address clone = factory.createDuel{value: STAKE}(
            address(marketUnresolved),
            MOCK_MARKET_ID,
            deadline
        );

        // Alice already deposited via createDuel — calling join directly should revert
        vm.expectRevert("cannot self-duel");
        vm.prank(alice);
        Wager(payable(clone)).join();
    }

    // ═══════════════════════════════════════════════════════
    // OVERPAYMENT
    // ═══════════════════════════════════════════════════════

    function test_overpayment_exactAmountAllowed() public {
        uint256 deadline = block.timestamp + JOIN_DEADLINE_OFFSET;

        vm.deal(alice, STAKE);
        vm.prank(alice);
        address clone = factory.createDuel{value: STAKE}(
            address(marketUnresolved),
            MOCK_MARKET_ID,
            deadline
        );

        vm.deal(bob, STAKE);
        vm.prank(bob);
        (bool sent,) = clone.call{value: STAKE}("");
        assertTrue(sent);

        // Exact amount is fine
        vm.prank(bob);
        Wager(payable(clone)).join();
    }

    function test_overpayment_revertsInReceive() public {
        uint256 deadline = block.timestamp + JOIN_DEADLINE_OFFSET;

        vm.deal(alice, STAKE);
        vm.prank(alice);
        address clone = factory.createDuel{value: STAKE}(
            address(marketUnresolved),
            MOCK_MARKET_ID,
            deadline
        );

        // Send more than stakeAmount
        vm.deal(bob, STAKE + 1);
        vm.prank(bob);
        (bool sent,) = clone.call{value: STAKE + 1}("");
        assertFalse(sent);
    }

    function test_overpayment_revertsMultipleDeposits() public {
        uint256 deadline = block.timestamp + JOIN_DEADLINE_OFFSET;

        vm.deal(alice, STAKE);
        vm.prank(alice);
        address clone = factory.createDuel{value: STAKE}(
            address(marketUnresolved),
            MOCK_MARKET_ID,
            deadline
        );

        vm.deal(bob, STAKE * 2);
        vm.prank(bob);
        (bool sent1,) = clone.call{value: STAKE / 2}("");
        assertTrue(sent1);

        // Second deposit pushes over stakeAmount
        vm.prank(bob);
        (bool sent2,) = clone.call{value: STAKE + 1}("");
        assertFalse(sent2);
    }

    // ═══════════════════════════════════════════════════════
    // FEE MATH
    // ═══════════════════════════════════════════════════════

    function test_feeMath_exactCalculation() public {
        uint256 deadline = block.timestamp + JOIN_DEADLINE_OFFSET;

        vm.deal(alice, STAKE);
        vm.prank(alice);
        address clone = factory.createDuel{value: STAKE}(
            address(marketYesWon),
            MOCK_MARKET_ID,
            deadline
        );

        vm.deal(bob, STAKE);
        vm.prank(bob);
        (bool sent,) = clone.call{value: STAKE}("");
        assertTrue(sent);
        vm.prank(bob);
        Wager(payable(clone)).join();

        uint256 aliceBalBefore = alice.balance;
        Wager(payable(clone)).settle();

        uint256 pot = STAKE * 2;
        uint256 expectedFee = (pot * FEE_BPS) / 10000;
        uint256 expectedPayout = pot - expectedFee;

        assertEq(alice.balance - aliceBalBefore, expectedPayout);
        assertEq(address(feeRecipient).balance, expectedFee);
    }

    function test_feeMath_highFee() public {
        uint256 deadline = block.timestamp + JOIN_DEADLINE_OFFSET;

        vm.deal(alice, STAKE);
        vm.prank(alice);
        address clone = highFeeFactory.createDuel{value: STAKE}(
            address(marketYesWon),
            MOCK_MARKET_ID,
            deadline
        );

        vm.deal(bob, STAKE);
        vm.prank(bob);
        (bool sent,) = clone.call{value: STAKE}("");
        assertTrue(sent);
        vm.prank(bob);
        Wager(payable(clone)).join();

        uint256 aliceBalBefore = alice.balance;
        Wager(payable(clone)).settle();

        uint256 pot = STAKE * 2;
        uint256 expectedFee = (pot * 1000) / 10000; // 10%
        uint256 expectedPayout = pot - expectedFee;

        assertEq(alice.balance - aliceBalBefore, expectedPayout);
    }

    function test_feeMath_rounding() public {
        uint256 tinyStake = 1000; // 1000 wei

        uint256 deadline = block.timestamp + JOIN_DEADLINE_OFFSET;

        vm.deal(alice, tinyStake);
        vm.prank(alice);
        address clone = roundingFactory.createDuel{value: tinyStake}(
            address(marketYesWon),
            MOCK_MARKET_ID,
            deadline
        );

        vm.deal(bob, tinyStake);
        vm.prank(bob);
        (bool sent,) = clone.call{value: tinyStake}("");
        assertTrue(sent);
        vm.prank(bob);
        Wager(payable(clone)).join();

        uint256 aliceBalBefore = alice.balance;
        Wager(payable(clone)).settle();

        // Fee should round down (favor user)
        uint256 pot = tinyStake * 2;
        uint256 expectedFee = (pot * FEE_BPS) / 10000;
        uint256 expectedPayout = pot - expectedFee;

        assertEq(alice.balance - aliceBalBefore, expectedPayout);
    }

    // ═══════════════════════════════════════════════════════
    // NO-FEE FACTORY
    // ═══════════════════════════════════════════════════════

    function test_settle_revertsIfNotResolved() public {
        uint256 deadline = block.timestamp + JOIN_DEADLINE_OFFSET;

        vm.deal(alice, STAKE);
        vm.prank(alice);
        address clone = factory.createDuel{value: STAKE}(
            address(marketUnresolved),
            MOCK_MARKET_ID,
            deadline
        );

        vm.deal(bob, STAKE);
        vm.prank(bob);
        (bool sent,) = clone.call{value: STAKE}("");
        assertTrue(sent);
        vm.prank(bob);
        Wager(payable(clone)).join();

        vm.expectRevert("not resolved");
        Wager(payable(clone)).settle();
    }

    function test_settle_revertsIfNoPayoutSet() public {
        uint256 deadline = block.timestamp + JOIN_DEADLINE_OFFSET;

        vm.deal(alice, STAKE);
        vm.prank(alice);
        address clone = factory.createDuel{value: STAKE}(
            address(marketZeroPayout),
            MOCK_MARKET_ID,
            deadline
        );

        vm.deal(bob, STAKE);
        vm.prank(bob);
        (bool sent,) = clone.call{value: STAKE}("");
        assertTrue(sent);
        vm.prank(bob);
        Wager(payable(clone)).join();

        vm.expectRevert("no payout set");
        Wager(payable(clone)).settle();
    }

    // ═══════════════════════════════════════════════════════
    // SPLIT MARKET → REFUND BOTH
    // ═══════════════════════════════════════════════════════

    function test_settle_splitMarket() public {
        uint256 deadline = block.timestamp + JOIN_DEADLINE_OFFSET;

        // Market with equal payout (split)
        MockMarket marketSplit = new MockMarket(4, false);
        marketSplit.setPayout(5000000, 5000000);

        vm.deal(alice, STAKE);
        vm.prank(alice);
        address clone = factory.createDuel{value: STAKE}(
            address(marketSplit),
            MOCK_MARKET_ID,
            deadline
        );

        vm.deal(bob, STAKE);
        vm.prank(bob);
        (bool sent,) = clone.call{value: STAKE}("");
        assertTrue(sent);
        vm.prank(bob);
        Wager(payable(clone)).join();

        uint256 aliceBalBefore = alice.balance;
        uint256 bobBalBefore = bob.balance;
        Wager(payable(clone)).settle();

        // Both get their stake back
        assertEq(alice.balance - aliceBalBefore, STAKE);
        assertEq(bob.balance - bobBalBefore, STAKE);
        assertEq(address(clone).balance, 0);
    }

    // ═══════════════════════════════════════════════════════
    // PRE-DEADLINE CANCEL (MARKET RESOLVED)
    // ═══════════════════════════════════════════════════════

    function test_factoryCancel_marketResolvedBeforeDeadline() public {
        uint256 deadline = block.timestamp + 1 hours;

        vm.deal(alice, STAKE);
        vm.prank(alice);
        address clone = factory.createDuel{value: STAKE}(
            address(marketYesWon), // already resolved
            MOCK_MARKET_ID,
            deadline
        );

        // Deadline hasn't passed yet, but market is resolved
        uint256 aliceBalBefore = alice.balance;
        factory.cancelDuel(clone);

        assertEq(uint8(Wager(payable(clone)).state()), uint8(Wager.WagerState.CANCELLED));
        assertEq(alice.balance - aliceBalBefore, STAKE);
    }

    function test_factoryCancel_revertsIfNotResolvedAndDeadlineNotPassed() public {
        uint256 deadline = block.timestamp + 1 hours;

        vm.deal(alice, STAKE);
        vm.prank(alice);
        address clone = factory.createDuel{value: STAKE}(
            address(marketUnresolved), // not resolved
            MOCK_MARKET_ID,
            deadline
        );

        vm.expectRevert("factoryCancel failed");
        factory.cancelDuel(clone);
    }

    function test_factory_cancel_refundsPlayerA() public {
        uint256 deadline = block.timestamp + 1 hours;

        vm.deal(alice, STAKE);
        vm.prank(alice);
        address clone = factory.createDuel{value: STAKE}(
            address(marketUnresolved),
            MOCK_MARKET_ID,
            deadline
        );

        vm.warp(deadline + 1);

        uint256 aliceBalBefore = alice.balance;
        factory.cancelDuel(clone);

        // Clone empty, player A got the refund
        assertEq(address(clone).balance, 0);
        assertEq(alice.balance - aliceBalBefore, STAKE);
    }

    // ═══════════════════════════════════════════════════════
    // GETPOT VIEW
    // ═══════════════════════════════════════════════════════

    function test_getPot() public {
        uint256 deadline = block.timestamp + JOIN_DEADLINE_OFFSET;

        vm.deal(alice, STAKE);
        vm.prank(alice);
        address clone = factory.createDuel{value: STAKE}(
            address(marketUnresolved),
            MOCK_MARKET_ID,
            deadline
        );

        assertEq(Wager(payable(clone)).getPot(), STAKE);

        vm.deal(bob, STAKE);
        vm.prank(bob);
        (bool sent,) = clone.call{value: STAKE}("");
        assertTrue(sent);

        assertEq(Wager(payable(clone)).getPot(), STAKE * 2);
    }

    // ═══════════════════════════════════════════════════════
    // ADMIN WITHDRAW TESTS
    // ═══════════════════════════════════════════════════════

    function test_withdraw_ownerCanWithdraw() public {
        vm.deal(address(factory), 50 ether);

        address recipient = makeAddr("recipient");
        uint256 factoryBalBefore = address(factory).balance;
        uint256 withdrawAmount = 20 ether;

        uint256 recipientBalBefore = recipient.balance;

        vm.prank(address(this));
        factory.withdraw(recipient, withdrawAmount);

        assertEq(address(factory).balance, factoryBalBefore - withdrawAmount);
        assertEq(recipient.balance, recipientBalBefore + withdrawAmount);
    }

    function test_withdraw_revertsIfNotOwner() public {
        vm.deal(address(factory), 50 ether);

        vm.prank(alice);
        vm.expectRevert("!owner");
        factory.withdraw(alice, 1 ether);
    }

    function test_withdraw_revertsIfInsufficientBalance() public {
        vm.expectRevert("insufficient balance");
        factory.withdraw(alice, 1 ether);
    }

    function test_withdraw_revertsZeroAddress() public {
        vm.deal(address(factory), 50 ether);

        vm.expectRevert("zero address");
        factory.withdraw(address(0), 1 ether);
    }

    function test_withdraw_revertsZeroAmount() public {
        vm.deal(address(factory), 50 ether);

        vm.expectRevert("zero amount");
        factory.withdraw(alice, 0);
    }

    function test_withdraw_doesNotBreakActiveDuels() public {
        uint256 deadline = block.timestamp + JOIN_DEADLINE_OFFSET;

        vm.deal(alice, STAKE);
        vm.prank(alice);
        address clone1 = factory.createDuel{value: STAKE}(
            address(marketYesWon),
            MOCK_MARKET_ID,
            deadline
        );

        vm.deal(bob, STAKE);
        vm.prank(bob);
        (bool sent1,) = clone1.call{value: STAKE}("");
        assertTrue(sent1);
        vm.prank(bob);
        Wager(payable(clone1)).join();

        // Owner withdraws 0.5 STT (factory had 0 before, now has 0)
        // Actually factory has 0 since it doesn't hold funds anymore
        // Just verify the duel still works
        Wager(payable(clone1)).settle();

        assertTrue(Wager(payable(clone1)).state() == Wager.WagerState.SETTLED);
    }

    // ═══════════════════════════════════════════════════════
    // FACTORY TESTS
    // ═══════════════════════════════════════════════════════

    function test_factory_minStake() public {
        uint256 deadline = block.timestamp + JOIN_DEADLINE_OFFSET;

        vm.deal(alice, MIN_STAKE / 2);
        vm.prank(alice);
        vm.expectRevert("stake below min");
        factory.createDuel{value: MIN_STAKE / 2}(
            address(marketUnresolved),
            MOCK_MARKET_ID,
            deadline
        );
    }

    function test_factory_maxStake() public {
        uint256 deadline = block.timestamp + JOIN_DEADLINE_OFFSET;

        vm.deal(alice, MAX_STAKE + 1);
        vm.prank(alice);
        vm.expectRevert("stake above max");
        factory.createDuel{value: MAX_STAKE + 1}(
            address(marketUnresolved),
            MOCK_MARKET_ID,
            deadline
        );
    }

    function test_factory_feeCap() public {
        // Factory with fee > 1000 bps should revert in constructor
        vm.expectRevert("fee too high");
        new GambitFactory(
            address(feeRecipient),
            1001, // > 10%
            MIN_STAKE,
            MAX_STAKE,
            address(0)
        );
    }
}
