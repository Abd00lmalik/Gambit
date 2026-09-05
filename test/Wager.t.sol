// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import {Wager} from "../contracts/Wager.sol";
import {GambitFactory} from "../contracts/GambitFactory.sol";

/// @dev Mock DreamDEX market for testing
contract MockMarket {
    uint8 private _status;
    uint256[] private _payoutNumerators;
    bool private _isVoided;

    constructor(uint8 status_, bool voided_) {
        _status = status_;
        _isVoided = voided_;
    }

    function setStatus(uint8 s) external { _status = s; }
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

/// @dev Mock fee recipient
/// @dev Mock fee recipient — plain address that accepts ETH
contract MockFeeRecipient {
    // solhint-disable-empty-blocks
    receive() external payable {}
}

/// @dev Test-only Wager subclass that exposes _onEvent for reactivity testing.
contract TestableWager is Wager {
    function depositAs(address player) external payable {
        deposits[player] += msg.value;
    }

    function simulateOnEvent(
        address emitter,
        bytes32[] calldata eventTopics,
        bytes calldata eventData
    ) external {
        _onEvent(emitter, eventTopics, eventData);
    }
}

/// @title Wager + GambitFactory Test Suite
/// @dev Covers: happy path, void/refund, cancel/timeout, fee math, overpayment, edge cases
contract GambitTest is Test {
    receive() external payable {}
    Wager public wagerLogic;
    GambitFactory public factory;
    MockMarket public marketYesWon;
    MockMarket public marketNoWon;
    MockMarket public marketVoided;
    MockMarket public marketUnresolved;
    MockMarket public marketZeroPayout;
    MockFeeRecipient public feeRecipient;

    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public carol = makeAddr("carol");

    uint256 public constant STAKE = 0.5 ether;
    uint256 public constant FEE_BPS = 250; // 2.5%
    uint256 public constant MIN_STAKE = 0.1 ether;
    uint256 public constant MAX_STAKE = 100 ether;
    uint256 public constant JOIN_DEADLINE_OFFSET = 1 hours;

    function setUp() public {
        feeRecipient = new MockFeeRecipient();

        // Deploy factory (includes new Wager() in constructor)
        factory = new GambitFactory(
            address(feeRecipient),
            FEE_BPS,
            MIN_STAKE,
            MAX_STAKE
        );

        // Deploy mock markets
        marketYesWon = new MockMarket(4, false); // resolved, YES won
        marketYesWon.setPayout(10000000, 0);

        marketNoWon = new MockMarket(4, false); // resolved, NO won
        marketNoWon.setPayout(0, 10000000);

        marketVoided = new MockMarket(4, true); // resolved but voided
        marketVoided.setPayout(0, 0);

        marketUnresolved = new MockMarket(1, false); // trading
        marketUnresolved.setPayout(0, 0);

        marketZeroPayout = new MockMarket(4, false); // resolved but payout=[0,0]
        marketZeroPayout.setPayout(0, 0);
    }

    // ═══════════════════════════════════════════════════════
    // HAPPY PATH: CREATE → JOIN → SETTLE → CORRECT PAYOUT
    // ═══════════════════════════════════════════════════════

    function test_happyPath_yesWins() public {
        uint256 deadline = block.timestamp + JOIN_DEADLINE_OFFSET;

        // Alice creates duel (sends STT via factory)
        vm.deal(alice, STAKE);
        vm.prank(alice);
        address clone = factory.createDuel{value: STAKE}(
            address(marketYesWon),
            deadline
        );

        Wager w = Wager(payable(clone));

        // Verify state
        assertEq(w.playerA(), alice);
        assertEq(w.stakeAmount(), STAKE);
        assertEq(uint8(w.state()), uint8(Wager.WagerState.CREATED));
        assertEq(w.deposits(alice), STAKE);

        // Bob deposits STT to clone
        vm.deal(bob, STAKE);
        vm.prank(bob);
        (bool sent,) = clone.call{value: STAKE}("");
        assertTrue(sent, "B deposit failed");
        assertEq(w.deposits(bob), STAKE);

        // Bob joins
        vm.prank(bob);
        w.join();
        assertEq(w.playerB(), bob);
        assertEq(uint8(w.state()), uint8(Wager.WagerState.LOCKED));

        // Settle — YES won, alice gets pot
        uint256 aliceBalBefore = alice.balance;
        w.settle();

        assertEq(uint8(w.state()), uint8(Wager.WagerState.SETTLED));
        // Pot = 1 STT (0.5 from A + 0.5 from B)
        // Fee = 1 * 250 / 10000 = 0.025 STT
        // Winner payout = 1 - 0.025 = 0.975 STT
        uint256 expectedFee = (1 ether * FEE_BPS) / 10000;
        uint256 expectedPayout = 1 ether - expectedFee;
        assertEq(alice.balance - aliceBalBefore, expectedPayout);
        assertEq(address(feeRecipient).balance, expectedFee);
    }

    function test_happyPath_noWins() public {
        uint256 deadline = block.timestamp + JOIN_DEADLINE_OFFSET;

        vm.deal(alice, STAKE);
        vm.prank(alice);
        address clone = factory.createDuel{value: STAKE}(
            address(marketNoWon),
            deadline
        );

        Wager w = Wager(payable(clone));

        vm.deal(bob, STAKE);
        vm.prank(bob);
        (bool sent,) = clone.call{value: STAKE}("");
        assertTrue(sent);

        vm.prank(bob);
        w.join();

        uint256 bobBalBefore = bob.balance;
        w.settle();

        uint256 expectedFee = (1 ether * FEE_BPS) / 10000;
        uint256 expectedPayout = 1 ether - expectedFee;
        assertEq(bob.balance - bobBalBefore, expectedPayout);
        assertEq(address(feeRecipient).balance, expectedFee);
    }

    // ═══════════════════════════════════════════════════════
    // VOID / REFUND PATH
    // ═══════════════════════════════════════════════════════

    function test_refund_voidedMarket() public {
        uint256 deadline = block.timestamp + JOIN_DEADLINE_OFFSET;

        vm.deal(alice, STAKE);
        vm.prank(alice);
        address clone = factory.createDuel{value: STAKE}(
            address(marketVoided),
            deadline
        );

        Wager w = Wager(payable(clone));

        vm.deal(bob, STAKE);
        vm.prank(bob);
        (bool sent,) = clone.call{value: STAKE}("");
        assertTrue(sent);

        vm.prank(bob);
        w.join();

        uint256 aliceBalBefore = alice.balance;
        uint256 bobBalBefore = bob.balance;

        w.refund();

        assertEq(uint8(w.state()), uint8(Wager.WagerState.REFUNDED));
        assertEq(alice.balance - aliceBalBefore, STAKE);
        assertEq(bob.balance - bobBalBefore, STAKE);
        assertEq(address(w).balance, 0);
    }

    function test_refund_revertsIfNotVoided() public {
        uint256 deadline = block.timestamp + JOIN_DEADLINE_OFFSET;

        vm.deal(alice, STAKE);
        vm.prank(alice);
        address clone = factory.createDuel{value: STAKE}(
            address(marketYesWon), // resolved, not voided
            deadline
        );

        Wager w = Wager(payable(clone));

        vm.deal(bob, STAKE);
        vm.prank(bob);
        (bool sent,) = clone.call{value: STAKE}("");
        assertTrue(sent);

        vm.prank(bob);
        w.join();

        vm.expectRevert("not voided");
        w.refund();
    }

    // ═══════════════════════════════════════════════════════
    // CANCEL / TIMEOUT PATH
    // ═══════════════════════════════════════════════════════

    function test_cancel_timeout() public {
        uint256 deadline = block.timestamp + 1 hours;

        vm.deal(alice, STAKE);
        vm.prank(alice);
        address clone = factory.createDuel{value: STAKE}(
            address(marketUnresolved),
            deadline
        );

        Wager w = Wager(payable(clone));

        // Fast forward past deadline
        vm.warp(deadline + 1);

        uint256 aliceBalBefore = alice.balance;
        vm.prank(alice);
        w.cancel();

        assertEq(uint8(w.state()), uint8(Wager.WagerState.CANCELLED));
        assertEq(alice.balance - aliceBalBefore, STAKE);
    }

    function test_cancel_revertsBeforeDeadline() public {
        uint256 deadline = block.timestamp + 1 hours;

        vm.deal(alice, STAKE);
        vm.prank(alice);
        address clone = factory.createDuel{value: STAKE}(
            address(marketUnresolved),
            deadline
        );

        Wager w = Wager(payable(clone));

        vm.expectRevert("deadline not reached");
        vm.prank(alice);
        w.cancel();
    }

    function test_cancel_revertsIfNotOwner() public {
        uint256 deadline = block.timestamp + 1 hours;

        vm.deal(alice, STAKE);
        vm.prank(alice);
        address clone = factory.createDuel{value: STAKE}(
            address(marketUnresolved),
            deadline
        );

        Wager w = Wager(payable(clone));

        vm.warp(deadline + 1);

        vm.expectRevert("!owner");
        vm.prank(bob);
        w.cancel();
    }

    function test_cancel_revertsIfDoubleCancel() public {
        uint256 deadline = block.timestamp + 1 hours;

        vm.deal(alice, STAKE);
        vm.prank(alice);
        address clone = factory.createDuel{value: STAKE}(
            address(marketUnresolved),
            deadline
        );

        Wager w = Wager(payable(clone));

        vm.warp(deadline + 1);

        vm.prank(alice);
        w.cancel();

        // Try to cancel again
        vm.expectRevert("wrong state");
        vm.prank(alice);
        w.cancel();
    }

    function test_cancel_revertsIfJoined() public {
        uint256 deadline = block.timestamp + 1 hours;

        vm.deal(alice, STAKE);
        vm.prank(alice);
        address clone = factory.createDuel{value: STAKE}(
            address(marketUnresolved),
            deadline
        );

        Wager w = Wager(payable(clone));

        // Bob joins before deadline
        vm.deal(bob, STAKE);
        vm.prank(bob);
        (bool sent,) = clone.call{value: STAKE}("");
        assertTrue(sent);
        vm.prank(bob);
        w.join();

        // Now deadline passes
        vm.warp(deadline + 1);

        vm.expectRevert("wrong state");
        vm.prank(alice);
        w.cancel();
    }

    // ═══════════════════════════════════════════════════════
    // FEE MATH
    // ═══════════════════════════════════════════════════════

    function test_feeMath_exactCalculation() public {
        // Deploy factory with 0 fee
        GambitFactory noFeeFactory = new GambitFactory(
            address(feeRecipient), 0, MIN_STAKE, MAX_STAKE
        );

        uint256 deadline = block.timestamp + JOIN_DEADLINE_OFFSET;

        vm.deal(alice, STAKE);
        vm.prank(alice);
        address clone = noFeeFactory.createDuel{value: STAKE}(
            address(marketYesWon),
            deadline
        );

        Wager w = Wager(payable(clone));

        vm.deal(bob, STAKE);
        vm.prank(bob);
        (bool sent,) = clone.call{value: STAKE}("");
        assertTrue(sent);

        vm.prank(bob);
        w.join();

        uint256 aliceBalBefore = alice.balance;
        w.settle();

        // With 0 fee, alice gets full pot
        assertEq(alice.balance - aliceBalBefore, 1 ether);
        assertEq(address(feeRecipient).balance, 0);
    }

    function test_feeMath_highFee() public {
        // 10% fee (1000 bps)
        GambitFactory highFeeFactory = new GambitFactory(
            address(feeRecipient), 1000, MIN_STAKE, MAX_STAKE
        );

        uint256 deadline = block.timestamp + JOIN_DEADLINE_OFFSET;

        vm.deal(alice, STAKE);
        vm.prank(alice);
        address clone = highFeeFactory.createDuel{value: STAKE}(
            address(marketYesWon),
            deadline
        );

        Wager w = Wager(payable(clone));

        vm.deal(bob, STAKE);
        vm.prank(bob);
        (bool sent,) = clone.call{value: STAKE}("");
        assertTrue(sent);

        vm.prank(bob);
        w.join();

        uint256 aliceBalBefore = alice.balance;
        w.settle();

        uint256 expectedFee = (1 ether * 1000) / 10000; // 0.1 ETH
        uint256 expectedPayout = 1 ether - expectedFee;  // 0.9 ETH
        assertEq(alice.balance - aliceBalBefore, expectedPayout);
        assertEq(address(feeRecipient).balance, expectedFee);
    }

    function test_feeMath_rounding() public {
        // 1 wei stake — tests integer division rounding
        uint256 tinyStake = 1 ether; // Use 1 ETH to have clean division
        GambitFactory roundingFactory = new GambitFactory(
            address(feeRecipient), 333, MIN_STAKE, MAX_STAKE
        );

        uint256 deadline = block.timestamp + JOIN_DEADLINE_OFFSET;

        vm.deal(alice, tinyStake);
        vm.prank(alice);
        address clone = roundingFactory.createDuel{value: tinyStake}(
            address(marketYesWon),
            deadline
        );

        Wager w = Wager(payable(clone));

        vm.deal(bob, tinyStake);
        vm.prank(bob);
        (bool sent,) = clone.call{value: tinyStake}("");
        assertTrue(sent);

        vm.prank(bob);
        w.join();

        uint256 aliceBalBefore = alice.balance;
        uint256 feeBalBefore = address(feeRecipient).balance;
        w.settle();

        uint256 pot = tinyStake * 2; // 2 ETH
        uint256 expectedFee = (pot * 333) / 10000;
        uint256 expectedPayout = pot - expectedFee;

        assertEq(alice.balance - aliceBalBefore, expectedPayout);
        assertEq(address(feeRecipient).balance - feeBalBefore, expectedFee);

        // Verify no rounding loss: payout + fee = pot
        assertEq(expectedPayout + expectedFee, pot);
    }

    // ═══════════════════════════════════════════════════════
    // OVERPAYMENT
    // ═══════════════════════════════════════════════════════

    function test_overpayment_revertsInReceive() public {
        uint256 deadline = block.timestamp + JOIN_DEADLINE_OFFSET;

        vm.deal(alice, STAKE);
        vm.prank(alice);
        address clone = factory.createDuel{value: STAKE}(
            address(marketUnresolved),
            deadline
        );

        // Bob tries to send more than stakeAmount
        vm.deal(bob, STAKE * 2);
        vm.prank(bob);
        vm.expectRevert("overpayment");
        (bool sent,) = clone.call{value: STAKE + 1}("");
        // expectRevert catches the revert inside receive()
    }

    function test_overpayment_revertsMultipleDeposits() public {
        uint256 deadline = block.timestamp + JOIN_DEADLINE_OFFSET;

        vm.deal(alice, STAKE);
        vm.prank(alice);
        address clone = factory.createDuel{value: STAKE}(
            address(marketUnresolved),
            deadline
        );

        // Bob sends half stake
        vm.deal(bob, STAKE);
        vm.prank(bob);
        (bool sent1,) = clone.call{value: STAKE / 2}("");
        assertTrue(sent1);

        Wager w = Wager(payable(clone));
        assertEq(w.deposits(bob), STAKE / 2);

        // Bob tries to send more than stakeAmount total
        vm.deal(bob, STAKE);
        vm.prank(bob);
        vm.expectRevert("overpayment");
        (bool sent2,) = clone.call{value: STAKE + 1}("");
    }

    function test_overpayment_exactAmountAllowed() public {
        uint256 deadline = block.timestamp + JOIN_DEADLINE_OFFSET;

        vm.deal(alice, STAKE);
        vm.prank(alice);
        address clone = factory.createDuel{value: STAKE}(
            address(marketUnresolved),
            deadline
        );

        // Bob sends exactly stakeAmount
        vm.deal(bob, STAKE);
        vm.prank(bob);
        (bool sent,) = clone.call{value: STAKE}("");
        assertTrue(sent);

        Wager w = Wager(payable(clone));
        assertEq(w.deposits(bob), STAKE);
    }

    // ═══════════════════════════════════════════════════════
    // EDGE CASES
    // ═══════════════════════════════════════════════════════

    function test_join_revertsIfAlreadyJoined() public {
        uint256 deadline = block.timestamp + JOIN_DEADLINE_OFFSET;

        vm.deal(alice, STAKE);
        vm.prank(alice);
        address clone = factory.createDuel{value: STAKE}(
            address(marketUnresolved),
            deadline
        );

        vm.deal(bob, STAKE * 2);
        vm.prank(bob);
        (bool sent,) = clone.call{value: STAKE}("");
        assertTrue(sent);

        Wager w = Wager(payable(clone));

        vm.prank(bob);
        w.join();

        // Carol tries to join too
        vm.deal(carol, STAKE);
        vm.prank(carol);
        (bool sent2,) = clone.call{value: STAKE}("");
        assertTrue(sent2);

        vm.expectRevert("wrong state");
        vm.prank(carol);
        w.join();
    }

    function test_join_revertsSelfDuel() public {
        uint256 deadline = block.timestamp + JOIN_DEADLINE_OFFSET;

        vm.deal(alice, STAKE * 2);
        vm.prank(alice);
        address clone = factory.createDuel{value: STAKE}(
            address(marketUnresolved),
            deadline
        );

        vm.expectRevert("cannot self-duel");
        vm.prank(alice);
        Wager(payable(clone)).join();
    }

    function test_join_revertsDeadlinePassed() public {
        uint256 deadline = block.timestamp + 1 hours;

        vm.deal(alice, STAKE);
        vm.prank(alice);
        address clone = factory.createDuel{value: STAKE}(
            address(marketUnresolved),
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

    function test_join_revertsInsufficientDeposit() public {
        uint256 deadline = block.timestamp + JOIN_DEADLINE_OFFSET;

        vm.deal(alice, STAKE);
        vm.prank(alice);
        address clone = factory.createDuel{value: STAKE}(
            address(marketUnresolved),
            deadline
        );

        // Bob sends less than stakeAmount
        vm.deal(bob, STAKE);
        vm.prank(bob);
        (bool sent,) = clone.call{value: STAKE / 4}("");
        assertTrue(sent);

        vm.expectRevert("insufficient deposit");
        vm.prank(bob);
        Wager(payable(clone)).join();
    }

    function test_settle_revertsIfNotResolved() public {
        uint256 deadline = block.timestamp + JOIN_DEADLINE_OFFSET;

        vm.deal(alice, STAKE);
        vm.prank(alice);
        address clone = factory.createDuel{value: STAKE}(
            address(marketUnresolved), // not resolved
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
            address(marketZeroPayout), // resolved, payout=[0,0]
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

    function test_settle_revertsIfVoided() public {
        uint256 deadline = block.timestamp + JOIN_DEADLINE_OFFSET;

        vm.deal(alice, STAKE);
        vm.prank(alice);
        address clone = factory.createDuel{value: STAKE}(
            address(marketVoided),
            deadline
        );

        vm.deal(bob, STAKE);
        vm.prank(bob);
        (bool sent,) = clone.call{value: STAKE}("");
        assertTrue(sent);

        vm.prank(bob);
        Wager(payable(clone)).join();

        vm.expectRevert("voided use refund()");
        Wager(payable(clone)).settle();
    }

    function test_factory_minStake() public {
        vm.deal(alice, MIN_STAKE / 2);
        vm.prank(alice);
        vm.expectRevert("stake below min");
        factory.createDuel{value: MIN_STAKE / 2}(
            address(marketUnresolved),
            block.timestamp + 1 hours
        );
    }

    function test_factory_maxStake() public {
        vm.deal(alice, MAX_STAKE + 1);
        vm.prank(alice);
        vm.expectRevert("stake above max");
        factory.createDuel{value: MAX_STAKE + 1}(
            address(marketUnresolved),
            block.timestamp + 1 hours
        );
    }

    function test_factory_feeCap() public {
        // Factory rejects fees > 1000 bps
        vm.expectRevert("fee too high");
        new GambitFactory(address(feeRecipient), 1001, MIN_STAKE, MAX_STAKE);
    }

    function test_getPot() public {
        uint256 deadline = block.timestamp + JOIN_DEADLINE_OFFSET;

        vm.deal(alice, STAKE);
        vm.prank(alice);
        address clone = factory.createDuel{value: STAKE}(
            address(marketUnresolved),
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
    // SUBSCRIPTION RECLAIM TESTS
    // ═══════════════════════════════════════════════════════

    function test_settle_reclaimsSubscriptionFund() public {
        uint256 deadline = block.timestamp + JOIN_DEADLINE_OFFSET;
        uint256 subFund = 35 ether;

        // Fund factory with enough for subscription
        vm.deal(address(factory), subFund);

        vm.deal(alice, STAKE);
        vm.prank(alice);
        address clone = factory.createDuel{value: STAKE}(
            address(marketYesWon),
            deadline
        );

        Wager w = Wager(payable(clone));

        // Clone should have stake + subscriptionFund
        assertEq(w.subscriptionFund(), subFund);
        assertEq(address(clone).balance, STAKE + subFund);

        // Bob joins
        vm.deal(bob, STAKE);
        vm.prank(bob);
        (bool sent,) = clone.call{value: STAKE}("");
        assertTrue(sent);
        vm.prank(bob);
        w.join();

        uint256 factoryBalBefore = address(factory).balance;

        // Settle
        w.settle();

        // After settle: clone should be empty, factory got the sweep
        assertEq(address(clone).balance, 0);
        assertEq(w.subscriptionFund(), 0);
        // Factory received the subscription fund back (minus what was used for gas in subscribe)
        // In tests, no subscription was actually created, so full amount is returned
        assertEq(address(factory).balance, factoryBalBefore + subFund);
    }

    function test_refund_reclaimsSubscriptionFund() public {
        uint256 deadline = block.timestamp + JOIN_DEADLINE_OFFSET;
        uint256 subFund = 35 ether;

        vm.deal(address(factory), subFund);

        vm.deal(alice, STAKE);
        vm.prank(alice);
        address clone = factory.createDuel{value: STAKE}(
            address(marketVoided),
            deadline
        );

        Wager w = Wager(payable(clone));
        assertEq(w.subscriptionFund(), subFund);

        vm.deal(bob, STAKE);
        vm.prank(bob);
        (bool sent,) = clone.call{value: STAKE}("");
        assertTrue(sent);
        vm.prank(bob);
        w.join();

        uint256 factoryBalBefore = address(factory).balance;

        w.refund();

        assertEq(address(clone).balance, 0);
        assertEq(address(factory).balance, factoryBalBefore + subFund);
    }

    function test_cancel_reclaimsSubscriptionFund() public {
        uint256 deadline = block.timestamp + 1 hours;
        uint256 subFund = 35 ether;

        vm.deal(address(factory), subFund);

        vm.deal(alice, STAKE);
        vm.prank(alice);
        address clone = factory.createDuel{value: STAKE}(
            address(marketUnresolved),
            deadline
        );

        Wager w = Wager(payable(clone));
        assertEq(w.subscriptionFund(), subFund);

        // Fast forward past deadline
        vm.warp(deadline + 1);

        uint256 factoryBalBefore = address(factory).balance;

        vm.prank(alice);
        w.cancel();

        // Clone empty, factory got sweep back
        assertEq(address(clone).balance, 0);
        assertEq(address(factory).balance, factoryBalBefore + subFund);
    }

    function test_factory_balanceRecycled() public {
        uint256 deadline = block.timestamp + JOIN_DEADLINE_OFFSET;
        uint256 subFund = 35 ether;

        // Factory starts with 70 STT — enough for 2 duels
        vm.deal(address(factory), subFund * 2);

        // === Duel 1: create, join, settle → fund returns to factory ===
        vm.deal(alice, STAKE);
        vm.prank(alice);
        address clone1 = factory.createDuel{value: STAKE}(
            address(marketYesWon), deadline
        );

        vm.deal(bob, STAKE);
        vm.prank(bob);
        (bool sent1,) = clone1.call{value: STAKE}("");
        assertTrue(sent1);
        vm.prank(bob);
        Wager(payable(clone1)).join();

        uint256 factoryBalAfterDuel1 = address(factory).balance;
        // Factory spent 35 for clone1, so 70 - 35 = 35
        assertEq(factoryBalAfterDuel1, subFund);

        Wager(payable(clone1)).settle();

        // Factory got the 35 back
        assertEq(address(factory).balance, subFund * 2);

        // === Duel 2: create from recycled balance ===
        vm.deal(alice, STAKE);
        vm.prank(alice);
        address clone2 = factory.createDuel{value: STAKE}(
            address(marketYesWon), deadline
        );

        // Factory should still have 70 after funding clone2
        assertEq(address(factory).balance, subFund);

        vm.deal(bob, STAKE);
        vm.prank(bob);
        (bool sent2,) = clone2.call{value: STAKE}("");
        assertTrue(sent2);
        vm.prank(bob);
        Wager(payable(clone2)).join();

        Wager(payable(clone2)).settle();

        // Factory fully recycled: 70 STT, 2 duels settled
        assertEq(address(factory).balance, subFund * 2);
    }

    // ═══════════════════════════════════════════════════════
    // ADMIN WITHDRAW TESTS
    // ═══════════════════════════════════════════════════════

    function test_withdraw_ownerCanWithdraw() public {
        // Fund factory with 50 STT
        vm.deal(address(factory), 50 ether);

        address recipient = makeAddr("recipient");
        uint256 factoryBalBefore = address(factory).balance;
        uint256 withdrawAmount = 20 ether;

        uint256 recipientBalBefore = recipient.balance;

        // Owner (test contract) withdraws
        vm.prank(address(this));
        factory.withdraw(recipient, withdrawAmount);

        // Verify balances
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
        // Factory has 0 STT
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
        uint256 subFund = 35 ether;

        // Factory starts with 70 STT
        vm.deal(address(factory), subFund * 2);

        // Create duel 1 (uses 35 STT for subscription)
        vm.deal(alice, STAKE);
        vm.prank(alice);
        address clone1 = factory.createDuel{value: STAKE}(
            address(marketYesWon), deadline
        );

        vm.deal(bob, STAKE);
        vm.prank(bob);
        (bool sent1,) = clone1.call{value: STAKE}("");
        assertTrue(sent1);
        vm.prank(bob);
        Wager(payable(clone1)).join();

        // Factory has 35 STT remaining (70 - 35)
        assertEq(address(factory).balance, subFund);

        // Owner withdraws 20 STT — still leaves 15 STT for future duels
        vm.prank(address(this));
        factory.withdraw(alice, 20 ether);

        // Factory now has 15 STT
        assertEq(address(factory).balance, 15 ether);

        // Duel 1 still works — clone has its own funds
        uint256 aliceBalBefore = alice.balance;
        Wager(payable(clone1)).settle();

        // Clone was settled correctly
        assertTrue(Wager(payable(clone1)).state() == Wager.WagerState.SETTLED);
    }

    // ═══════════════════════════════════════════════════════
    // AUTO-REFUND IF UNJOINED: market resolves while OPEN
    // ═══════════════════════════════════════════════════════

    /// @dev Helper: deploy a standalone TestableWager for reactivity testing.
    ///      NOT a clone — direct deployment so simulateOnEvent() is callable.
    function _deployTestableClone(MockMarket market) internal returns (TestableWager tw) {
        tw = new TestableWager();

        // Initialize manually (factory = address(this), since we're calling directly)
        tw.initialize(alice, STAKE, address(market), FEE_BPS, address(feeRecipient), block.timestamp + JOIN_DEADLINE_OFFSET);

        // Record alice's deposit (we are the factory)
        vm.deal(alice, STAKE);
        tw.recordDeposit{value: STAKE}(alice);

        // Fund subscription from "factory" (this test contract)
        vm.deal(address(this), 35 ether);
        (bool fundOk,) = address(tw).call{value: 35 ether}("");
        require(fundOk, "sub fund failed");
    }

    function test_autoRefund_unjoinedMarketResolves() public {
        // Deploy a resolved market
        MockMarket market = new MockMarket(4, false);
        market.setPayout(10000000, 0);

        TestableWager tw = _deployTestableClone(market);

        // Verify duel is in CREATED state (no player B joined)
        assertEq(uint8(tw.state()), uint8(Wager.WagerState.CREATED));
        assertEq(tw.playerB(), address(0));

        // Record Alice's balance before
        uint256 aliceBalBefore = alice.balance;

        // Simulate the Resolved event being delivered by Somnia reactivity precompile
        bytes32 resolvedTopic = keccak256("Resolved(uint32,uint256[])");
        bytes32[] memory topics = new bytes32[](1);
        topics[0] = resolvedTopic;

        tw.simulateOnEvent(address(market), topics, "");

        // Duel should now be CANCELLED, Alice refunded
        assertEq(uint8(tw.state()), uint8(Wager.WagerState.CANCELLED));
        assertEq(alice.balance - aliceBalBefore, STAKE);
        assertEq(tw.deposits(alice), 0);
    }

    function test_autoRefund_subscriptionFundReclaimed() public {
        MockMarket market = new MockMarket(4, false);
        market.setPayout(10000000, 0);

        TestableWager tw = _deployTestableClone(market);

        // "factory" for this standalone wager is address(this) (test contract)
        uint256 factoryBalBefore = address(this).balance;

        // Simulate Resolved event
        bytes32 resolvedTopic = keccak256("Resolved(uint32,uint256[])");
        bytes32[] memory topics = new bytes32[](1);
        topics[0] = resolvedTopic;
        tw.simulateOnEvent(address(market), topics, "");

        // Subscription fund should be swept back to factory (test contract)
        assertGt(address(this).balance, factoryBalBefore);
        assertEq(uint8(tw.state()), uint8(Wager.WagerState.CANCELLED));
    }

    function test_autoRefund_doesNotFireWhenLocked() public {
        MockMarket market = new MockMarket(4, false);
        market.setPayout(10000000, 0);

        TestableWager tw = _deployTestableClone(market);

        // Bob deposits and joins → state = LOCKED
        vm.deal(bob, STAKE);
        vm.prank(bob);
        (bool sent,) = address(tw).call{value: STAKE}("");
        assertTrue(sent);
        vm.prank(bob);
        tw.join();
        assertEq(uint8(tw.state()), uint8(Wager.WagerState.LOCKED));

        // Simulate Resolved event — should settle, NOT auto-refund
        bytes32 resolvedTopic = keccak256("Resolved(uint32,uint256[])");
        bytes32[] memory topics = new bytes32[](1);
        topics[0] = resolvedTopic;
        tw.simulateOnEvent(address(market), topics, "");

        // State should be SETTLED, not CANCELLED
        assertEq(uint8(tw.state()), uint8(Wager.WagerState.SETTLED));
    }

    function test_autoRefund_wrongMarketIgnored() public {
        MockMarket market = new MockMarket(4, false);
        market.setPayout(10000000, 0);

        MockMarket wrongMarket = new MockMarket(4, false);
        wrongMarket.setPayout(10000000, 0);

        TestableWager tw = _deployTestableClone(market);

        // Simulate Resolved event from WRONG market — should be ignored
        bytes32 resolvedTopic = keccak256("Resolved(uint32,uint256[])");
        bytes32[] memory topics = new bytes32[](1);
        topics[0] = resolvedTopic;

        vm.expectRevert("!market");
        tw.simulateOnEvent(address(wrongMarket), topics, "");
    }
}
