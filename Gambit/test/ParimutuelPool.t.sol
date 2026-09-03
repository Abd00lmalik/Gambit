// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import {ParimutuelPool} from "../contracts/ParimutuelPool.sol";
import {ParimutuelPoolFactory} from "../contracts/ParimutuelPoolFactory.sol";

/// @dev Minimal mock of IBinaryMarket for testing.
///      Returns configurable resolved/voided/payout states.
contract MockBinaryMarket {
    bool private _isResolved;
    bool private _isVoided;
    uint256 private _upPayout;
    uint256 private _downPayout;

    function isResolved() external view returns (bool) { return _isResolved; }
    function isVoided() external view returns (bool) { return _isVoided; }
    function payoutNumerators() external view returns (uint256[] memory) {
        uint256[] memory p = new uint256[](2);
        p[0] = _upPayout;
        p[1] = _downPayout;
        return p;
    }

    function setResolved(bool resolved) external { _isResolved = resolved; }
    function setVoided(bool voided) external { _isVoided = voided; }
    function setPayout(uint256 up, uint256 down) external {
        _upPayout = up;
        _downPayout = down;
    }
}

contract ParimutuelPoolTest is Test {
    ParimutuelPoolFactory factory;
    ParimutuelPool pool;
    MockBinaryMarket market;

    address owner = address(0xBEEF);
    address feeRecipient = address(0xFEE);
    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    address charlie = address(0xCA1);

    uint256 constant FEE_BPS = 250; // 2.5%
    uint256 constant MIN_STAKE = 0.1 ether;
    uint256 constant MAX_STAKE = 100 ether;

    function setUp() public {
        vm.prank(owner);
        factory = new ParimutuelPoolFactory(feeRecipient, FEE_BPS, MIN_STAKE, MAX_STAKE);

        market = new MockBinaryMarket();

        vm.prank(owner);
        address poolAddr = factory.createPool(
            address(market),
            block.timestamp + 1 hours
        );
        pool = ParimutuelPool(payable(poolAddr));
    }

    // ── Deposit Tests ──────────────────────────────────────

    function test_depositUp() public {
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        pool.depositUp{value: 0.5 ether}();

        (uint256 up, uint256 down) = pool.getUserDeposit(alice);
        assertEq(up, 0.5 ether);
        assertEq(down, 0);
        assertEq(pool.upPool(), 0.5 ether);
        assertEq(pool.totalPool(), 0.5 ether);
    }

    function test_depositDown() public {
        vm.deal(bob, 1 ether);
        vm.prank(bob);
        pool.depositDown{value: 0.5 ether}();

        (uint256 up, uint256 down) = pool.getUserDeposit(bob);
        assertEq(up, 0);
        assertEq(down, 0.5 ether);
        assertEq(pool.downPool(), 0.5 ether);
    }

    function test_multipleDeposits() public {
        vm.deal(alice, 2 ether);
        vm.deal(bob, 2 ether);
        vm.deal(charlie, 2 ether);

        vm.prank(alice);
        pool.depositUp{value: 1 ether}();
        vm.prank(bob);
        pool.depositUp{value: 0.5 ether}();
        vm.prank(charlie);
        pool.depositDown{value: 1.5 ether}();

        assertEq(pool.upPool(), 1.5 ether);
        assertEq(pool.downPool(), 1.5 ether);
        assertEq(pool.totalPool(), 3 ether);
    }

    function test_revertsIfDeadlinePassed() public {
        vm.warp(block.timestamp + 1 hours + 1);

        vm.deal(alice, 1 ether);
        vm.prank(alice);
        vm.expectRevert("deadline passed");
        pool.depositUp{value: 0.5 ether}();
    }

    function test_revertsIfZeroDeposit() public {
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        vm.expectRevert("zero deposit");
        pool.depositUp{value: 0}();
    }

    // ── Resolution Tests ───────────────────────────────────

    function test_resolve_upWins() public {
        // Alice bets UP, Bob bets DOWN
        vm.deal(alice, 1 ether);
        vm.deal(bob, 1 ether);
        vm.startPrank(alice);
        pool.depositUp{value: 1 ether}();
        vm.stopPrank();
        vm.prank(bob);
        pool.depositDown{value: 1 ether}();

        // Market resolves: UP wins
        market.setResolved(true);
        market.setPayout(1, 0);

        pool.resolve();

        assertEq(uint256(pool.state()), uint256(ParimutuelPool.PoolState.RESOLVED));
    }

    function test_claim_upWins() public {
        // 6 UP, 4 DOWN, total = 10
        vm.deal(alice, 6 ether);
        vm.deal(bob, 4 ether);

        vm.startPrank(alice);
        pool.depositUp{value: 6 ether}();
        vm.stopPrank();

        vm.startPrank(bob);
        pool.depositDown{value: 4 ether}();
        vm.stopPrank();

        // Resolve: UP wins
        market.setResolved(true);
        market.setPayout(1, 0);
        pool.resolve();

        // Alice claims: 6 * 10 / 6 = 10, minus 2.5% fee = 9.75
        uint256 bobBalanceBefore = bob.balance;
        vm.prank(alice);
        pool.claim();

        uint256 aliceExpected = 10 ether - (10 ether * FEE_BPS / 10000);
        assertEq(alice.balance, aliceExpected);
    }

    function test_claim_downWins() public {
        // 3 UP, 7 DOWN, total = 10
        vm.deal(alice, 3 ether);
        vm.deal(bob, 7 ether);

        vm.startPrank(alice);
        pool.depositUp{value: 3 ether}();
        vm.stopPrank();

        vm.startPrank(bob);
        pool.depositDown{value: 7 ether}();
        vm.stopPrank();

        // Resolve: DOWN wins
        market.setResolved(true);
        market.setPayout(0, 1);
        pool.resolve();

        // Bob claims: 7 * 10 / 7 = 10, minus 2.5% fee = 9.75
        vm.prank(bob);
        pool.claim();

        uint256 bobExpected = 10 ether - (10 ether * FEE_BPS / 10000);
        assertEq(bob.balance, bobExpected);
    }

    function test_claim_proportionalPayout() public {
        // 2 UP, 8 DOWN, total = 10
        // UP wins: each UP depositor gets 2 * 10 / 2 = 10
        vm.deal(alice, 2 ether);
        vm.deal(bob, 8 ether);

        vm.startPrank(alice);
        pool.depositUp{value: 2 ether}();
        vm.stopPrank();

        vm.startPrank(bob);
        pool.depositDown{value: 8 ether}();
        vm.stopPrank();

        market.setResolved(true);
        market.setPayout(1, 0);
        pool.resolve();

        vm.prank(alice);
        pool.claim();

        uint256 expected = 10 ether - (10 ether * FEE_BPS / 10000);
        assertEq(alice.balance, expected);
    }

    function test_revertsIfNotResolved() public {
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        pool.depositUp{value: 1 ether}();

        vm.prank(alice);
        vm.expectRevert("not resolved");
        pool.claim();
    }

    function test_revertsIfAlreadyClaimed() public {
        vm.deal(alice, 1 ether);
        vm.deal(bob, 1 ether);

        vm.startPrank(alice);
        pool.depositUp{value: 1 ether}();
        vm.stopPrank();

        vm.startPrank(bob);
        pool.depositDown{value: 1 ether}();
        vm.stopPrank();

        market.setResolved(true);
        market.setPayout(1, 0);
        pool.resolve();

        vm.prank(alice);
        pool.claim();

        vm.prank(alice);
        vm.expectRevert("already claimed");
        pool.claim();
    }

    function test_revertsIfNoDepositOnWinningSide() public {
        vm.deal(alice, 1 ether);
        vm.deal(bob, 1 ether);

        vm.startPrank(alice);
        pool.depositUp{value: 1 ether}();
        vm.stopPrank();

        vm.startPrank(bob);
        pool.depositDown{value: 1 ether}();
        vm.stopPrank();

        // DOWN wins — Alice bet UP, so she has no deposit on winning side
        market.setResolved(true);
        market.setPayout(0, 1);
        pool.resolve();

        vm.prank(alice);
        vm.expectRevert("no deposit on winning side");
        pool.claim();
    }

    // ── Void/Refund Tests ──────────────────────────────────

    function test_refund_voidedMarket() public {
        vm.deal(alice, 1 ether);
        vm.deal(bob, 1 ether);

        vm.startPrank(alice);
        pool.depositUp{value: 1 ether}();
        vm.stopPrank();

        vm.startPrank(bob);
        pool.depositDown{value: 1 ether}();
        vm.stopPrank();

        // Market is voided
        market.setVoided(true);

        vm.prank(alice);
        pool.refund();

        assertEq(uint256(pool.state()), uint256(ParimutuelPool.PoolState.REFUNDED));
    }

    function test_claimRefund() public {
        vm.deal(alice, 1 ether);
        vm.deal(bob, 1 ether);

        vm.startPrank(alice);
        pool.depositUp{value: 1 ether}();
        vm.stopPrank();

        vm.startPrank(bob);
        pool.depositDown{value: 1 ether}();
        vm.stopPrank();

        uint256 aliceBefore = alice.balance;

        market.setVoided(true);
        vm.prank(alice);
        pool.refund();

        // refund() already returns alice's 1 ether
        assertEq(alice.balance - aliceBefore, 1 ether);

        // claimRefund() on already-refunded user is a no-op (0 deposit)
        vm.prank(alice);
        pool.claimRefund();
        assertEq(alice.balance - aliceBefore, 1 ether);
    }

    // ── Edge Cases ─────────────────────────────────────────

    function test_poolSplit() public {
        vm.deal(alice, 3 ether);
        vm.deal(bob, 7 ether);

        vm.startPrank(alice);
        pool.depositUp{value: 3 ether}();
        vm.stopPrank();

        vm.startPrank(bob);
        pool.depositDown{value: 7 ether}();
        vm.stopPrank();

        (uint256 upPercent, uint256 downPercent) = pool.getPoolSplit();
        assertEq(upPercent, 3000); // 30%
        assertEq(downPercent, 7000); // 70%
    }

    function test_emptyPoolSplit() public {
        (uint256 upPercent, uint256 downPercent) = pool.getPoolSplit();
        assertEq(upPercent, 5000); // default 50/50
        assertEq(downPercent, 5000);
    }

    function test_multipleUpDeposits() public {
        vm.deal(alice, 1 ether);
        vm.deal(bob, 1 ether);
        vm.deal(charlie, 1 ether);

        vm.prank(alice);
        pool.depositUp{value: 0.3 ether}();
        vm.prank(bob);
        pool.depositUp{value: 0.5 ether}();
        vm.prank(charlie);
        pool.depositUp{value: 0.7 ether}();

        assertEq(pool.upPool(), 1.5 ether);
        assertEq(pool.totalPool(), 1.5 ether);
    }
}
