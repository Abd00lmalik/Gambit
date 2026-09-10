// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import {Wager} from "../contracts/Wager.sol";
import {GambitFactory} from "../contracts/GambitFactory.sol";

/// @dev Mock DreamDEX market for testing — same shape as in Wager.t.sol
contract MockMarket {
    uint8 private _status;
    uint256[] private _payoutNumerators;
    bool private _isVoided;

    constructor(uint8 status_) {
        _status = status_;
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

contract MockFeeRecipient {
    receive() external payable {}
}

/// @title Creator-side coverage (Priority 2)
/// @dev Verifies that a creator can pick UP or DOWN at creation, that the side is
///      stored on the clone, and that settle() always pays the player who picked
///      the side that actually won — for BOTH creator choices and BOTH outcomes.
contract WagerSidesTest is Test {
    GambitFactory public factory;
    MockFeeRecipient public feeRecipient;

    MockMarket public marketUpWon;
    MockMarket public marketDownWon;
    MockMarket public marketSplit;

    address public alice = makeAddr("alice"); // creator
    address public bob = makeAddr("bob");     // joiner

    uint256 constant STAKE = 1 ether;
    uint256 constant MIN_STAKE = 0.1 ether;
    uint256 constant MAX_STAKE = 100 ether;
    uint256 constant FEE_BPS = 250; // 2.5%
    uint256 constant JOIN_DEADLINE_OFFSET = 5 minutes;
    bytes32 constant MOCK_MARKET_ID = keccak256("sides-test-market");

    function setUp() public {
        feeRecipient = new MockFeeRecipient();
        factory = new GambitFactory(
            address(feeRecipient),
            FEE_BPS,
            MIN_STAKE,
            MAX_STAKE,
            address(0)
        );

        marketUpWon = new MockMarket(4); // resolved
        marketUpWon.setPayout(10_000_000, 0); // UP won

        marketDownWon = new MockMarket(4); // resolved
        marketDownWon.setPayout(0, 10_000_000); // DOWN won

        marketSplit = new MockMarket(4); // resolved
        marketSplit.setPayout(5_000_000, 5_000_000); // split → refund
    }

    // ── helpers ────────────────────────────────────────────

    function _createAndJoin(address market, bool creatorIsUp) internal returns (Wager w) {
        vm.deal(alice, STAKE);
        vm.prank(alice);
        address clone = factory.createDuel{value: STAKE}(
            market,
            MOCK_MARKET_ID,
            block.timestamp + JOIN_DEADLINE_OFFSET,
            creatorIsUp
        );
        w = Wager(payable(clone));

        vm.deal(bob, STAKE);
        vm.prank(bob);
        (bool sent,) = clone.call{value: STAKE}("");
        assertTrue(sent);
        vm.prank(bob);
        w.join();
    }

    function _expectedWinnerPayout() internal pure returns (uint256) {
        uint256 pot = STAKE * 2;
        uint256 fee = (pot * FEE_BPS) / 10000;
        return pot - fee;
    }

    // ── side is stored exactly as passed ───────────────────

    function test_side_stored_creatorUp() public {
        vm.deal(alice, STAKE);
        vm.prank(alice);
        address clone = factory.createDuel{value: STAKE}(
            address(marketUpWon),
            MOCK_MARKET_ID,
            block.timestamp + JOIN_DEADLINE_OFFSET,
            true
        );
        assertTrue(Wager(payable(clone)).creatorIsUp(), "creatorIsUp should be true");
    }

    function test_side_stored_creatorDown() public {
        vm.deal(alice, STAKE);
        vm.prank(alice);
        address clone = factory.createDuel{value: STAKE}(
            address(marketUpWon),
            MOCK_MARKET_ID,
            block.timestamp + JOIN_DEADLINE_OFFSET,
            false
        );
        assertFalse(Wager(payable(clone)).creatorIsUp(), "creatorIsUp should be false");
    }

    // ── creator UP ─────────────────────────────────────────

    function test_creatorUp_upWins_creatorWins() public {
        Wager w = _createAndJoin(address(marketUpWon), true);
        assertTrue(w.creatorIsUp());

        uint256 aliceBalBefore = alice.balance;
        w.settle();
        assertEq(alice.balance - aliceBalBefore, _expectedWinnerPayout(), "alice (UP) should win");
        assertEq(address(w).balance, 0);
    }

    function test_creatorUp_downWins_joinerWins() public {
        Wager w = _createAndJoin(address(marketDownWon), true);

        uint256 bobBalBefore = bob.balance;
        w.settle();
        assertEq(bob.balance - bobBalBefore, _expectedWinnerPayout(), "bob (DOWN) should win");
        assertEq(address(w).balance, 0);
    }

    // ── creator DOWN ───────────────────────────────────────

    function test_creatorDown_downWins_creatorWins() public {
        Wager w = _createAndJoin(address(marketDownWon), false);
        assertFalse(w.creatorIsUp());

        uint256 aliceBalBefore = alice.balance;
        w.settle();
        assertEq(alice.balance - aliceBalBefore, _expectedWinnerPayout(), "alice (DOWN) should win");
        assertEq(address(w).balance, 0);
    }

    function test_creatorDown_upWins_joinerWins() public {
        Wager w = _createAndJoin(address(marketUpWon), false);

        uint256 bobBalBefore = bob.balance;
        w.settle();
        assertEq(bob.balance - bobBalBefore, _expectedWinnerPayout(), "bob (UP) should win");
        assertEq(address(w).balance, 0);
    }

    // ── matrix over both sides × both outcomes (no-fee factory) ──

    function test_sides_matrix_noFee() public {
        GambitFactory noFeeFactory = new GambitFactory(
            address(feeRecipient), 0, MIN_STAKE, MAX_STAKE, address(0)
        );

        MockMarket[2] memory markets = [marketUpWon, marketDownWon];
        for (uint256 i = 0; i < 2; i++) {
            for (uint256 j = 0; j < 2; j++) {
                bool creatorIsUp = j == 0;
                vm.deal(alice, STAKE);
                vm.prank(alice);
                address clone = noFeeFactory.createDuel{value: STAKE}(
                    address(markets[i]),
                    MOCK_MARKET_ID,
                    block.timestamp + JOIN_DEADLINE_OFFSET,
                    creatorIsUp
                );
                vm.deal(bob, STAKE);
                vm.prank(bob);
                (bool sent,) = clone.call{value: STAKE}("");
                assertTrue(sent);
                vm.prank(bob);
                Wager(payable(clone)).join();

                bool upWon = i == 0;
                address expectedWinner = (upWon == creatorIsUp) ? alice : bob;

                uint256 before = expectedWinner.balance;
                Wager(payable(clone)).settle();
                assertEq(
                    expectedWinner.balance - before,
                    STAKE * 2,
                    "no-fee: winner takes whole pot"
                );
            }
        }
    }

    // ── split outcome refunds both, regardless of side ─────

    function test_creatorDown_splitPayout_refundsBoth() public {
        Wager w = _createAndJoin(address(marketSplit), false);

        uint256 aliceBalBefore = alice.balance;
        uint256 bobBalBefore = bob.balance;
        w.settle();

        assertEq(uint8(w.state()), uint8(Wager.WagerState.REFUNDED));
        assertEq(alice.balance - aliceBalBefore, STAKE);
        assertEq(bob.balance - bobBalBefore, STAKE);
    }

    function test_creatorUp_splitPayout_refundsBoth() public {
        Wager w = _createAndJoin(address(marketSplit), true);

        uint256 aliceBalBefore = alice.balance;
        uint256 bobBalBefore = bob.balance;
        w.settle();

        assertEq(uint8(w.state()), uint8(Wager.WagerState.REFUNDED));
        assertEq(alice.balance - aliceBalBefore, STAKE);
        assertEq(bob.balance - bobBalBefore, STAKE);
    }

    // ── DuelCreated event carries the side ─────────────────

    function test_side_event_emitted() public {
        vm.deal(alice, STAKE);
        vm.prank(alice);
        vm.recordLogs();
        address clone = factory.createDuel{value: STAKE}(
            address(marketUpWon),
            MOCK_MARKET_ID,
            block.timestamp + JOIN_DEADLINE_OFFSET,
            false
        );

        Vm.Log[] memory logs = vm.getRecordedLogs();
        bool found = false;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].emitter == address(factory) && logs[i].topics.length >= 3) {
                // DuelCreated topic0
                if (uint256(logs[i].topics[0]) == uint256(keccak256("DuelCreated(address,address,uint256,address,uint256,bool)"))) {
                    (uint256 stakeAmount, address marketAddress, uint256 joinDeadline, bool creatorIsUp) =
                        abi.decode(logs[i].data, (uint256, address, uint256, bool));
                    assertEq(stakeAmount, STAKE);
                    assertEq(marketAddress, address(marketUpWon));
                    assertEq(joinDeadline, block.timestamp + JOIN_DEADLINE_OFFSET);
                    assertFalse(creatorIsUp, "event should carry creatorIsUp=false");
                    // clone in topics[1]
                    assertEq(address(uint160(uint256(logs[i].topics[1]))), clone);
                    found = true;
                }
            }
        }
        assertTrue(found, "DuelCreated event with side not found");
    }

    // ── sides don't break the rest of the lifecycle ────────

    function test_creatorDown_cancelFlow() public {
        vm.deal(alice, STAKE);
        vm.prank(alice);
        address clone = factory.createDuel{value: STAKE}(
            address(marketUpWon),
            MOCK_MARKET_ID,
            block.timestamp + JOIN_DEADLINE_OFFSET,
            false
        );

        // Nobody joins → after deadline creator reclaims
        vm.warp(block.timestamp + JOIN_DEADLINE_OFFSET + 1);
        uint256 before = alice.balance;
        vm.prank(alice);
        Wager(payable(clone)).cancel();
        assertEq(alice.balance - before, STAKE);
        assertEq(uint8(Wager(payable(clone)).state()), uint8(Wager.WagerState.CANCELLED));
    }

    function test_creatorDown_voidRefund() public {
        MockMarket voided = new MockMarket(0);
        voided.setVoided(true);
        Wager w = _createAndJoin(address(voided), false);

        uint256 aliceBalBefore = alice.balance;
        uint256 bobBalBefore = bob.balance;
        w.refund();
        assertEq(alice.balance - aliceBalBefore, STAKE);
        assertEq(bob.balance - bobBalBefore, STAKE);
    }

    function test_creatorDown_settleRevertsIfNotResolved() public {
        MockMarket unresolved = new MockMarket(0); // status 0 — not resolved
        Wager w = _createAndJoin(address(unresolved), false);
        vm.expectRevert("not resolved");
        w.settle();
    }

    // ── fuzz: winner is always the side that matched the outcome ──

    function testFuzz_sides_fuzzOutcome(bool creatorIsUp, bool upWins, uint96 seed) public {
        MockMarket m = new MockMarket(4);
        uint256 num = uint256(seed) % 1_000_000 + 1;
        if (upWins) m.setPayout(num, 0); else m.setPayout(0, num);

        Wager w = _createAndJoin(address(m), creatorIsUp);

        address expectedWinner = (upWins == creatorIsUp) ? alice : bob;
        uint256 before = expectedWinner.balance;
        w.settle();
        assertEq(expectedWinner.balance - before, _expectedWinnerPayout());
        assertEq(address(w).balance, 0);
        assertEq(uint8(w.state()), uint8(Wager.WagerState.SETTLED));
    }
}
