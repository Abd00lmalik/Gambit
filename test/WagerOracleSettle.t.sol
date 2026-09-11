// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import {Wager} from "../contracts/Wager.sol";
import {GambitFactory} from "../contracts/GambitFactory.sol";

/// @dev Same MockMarket shape as Wager.t.sol (independent copy to keep suites decoupled)
contract MockMarketOracle {
    uint8 private _status;
    uint256[] private _payoutNumerators;
    bool private _isVoided;

    constructor(uint8 status_, bool voided_) {
        _status = status_;
        _isVoided = voided_;
    }

    function setPayout(uint256 up, uint256 down) external {
        _payoutNumerators = new uint256[](2);
        _payoutNumerators[0] = up;
        _payoutNumerators[1] = down;
    }

    function isResolved() external view returns (bool) { return _status == 4; }
    function isVoided() external view returns (bool) { return _isVoided; }
    function payoutNumerators() external view returns (uint256[] memory) { return _payoutNumerators; }
    function status() external view returns (uint8) { return _status; }
}

contract MockFeeRecipientOracle {
    receive() external payable {}
}

/// @title Wager.settleByOracle tests — oracle-attested settlement for stale slot registrations.
/// @dev GUARANTEE UNDER TEST: settleByOracle() pays out IDENTICALLY to settle()
///      (same fee math, same winner derivation from creatorIsUp), and the
///      signature binds (clone, chainId, upWon, windowEnd) so attestations
///      cannot be replayed across duels, chains, or flipped sides.
///      The existing settle() path and its winner-determination logic are NOT
///      modified — Wager.t.sol / WagerSides.t.sol continue to cover them.
contract WagerOracleSettleTest is Test {
    GambitFactory public factory;          // oracle path ENABLED
    GambitFactory public disabledFactory;  // oracleSigner = address(0)
    MockFeeRecipientOracle public feeRecipient;

    MockMarketOracle public marketUpWon;
    MockMarketOracle public marketDownWon;

    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    // Oracle signer keypair (fixture key, test-only)
    uint256 constant ORACLE_PK = 0xA11CE0000000000000000000000000000000000000000000000000000000001;
    address public oracleSigner;

    uint256 constant STAKE = 1 ether;
    uint256 constant MIN_STAKE = 0.1 ether;
    uint256 constant MAX_STAKE = 100 ether;
    uint256 constant FEE_BPS = 250;
    uint256 constant DEADLINE_OFFSET = 5 minutes;

    function setUp() public {
        oracleSigner = vm.addr(ORACLE_PK);
        feeRecipient = new MockFeeRecipientOracle();

        factory = new GambitFactory(
            address(feeRecipient),
            FEE_BPS,
            MIN_STAKE,
            MAX_STAKE,
            address(0),
            oracleSigner
        );
        disabledFactory = new GambitFactory(
            address(feeRecipient),
            FEE_BPS,
            MIN_STAKE,
            MAX_STAKE,
            address(0),
            address(0)
        );

        marketUpWon = new MockMarketOracle(4, false);
        marketUpWon.setPayout(10000000, 0);
        marketDownWon = new MockMarketOracle(4, false);
        marketDownWon.setPayout(0, 10000000);
    }

    // ── helpers ────────────────────────────────────────────

    function _createAndJoin(address creator, bool creatorIsUp, address marketAddr) internal returns (Wager w, uint256 deadline) {
        deadline = block.timestamp + DEADLINE_OFFSET;
        vm.deal(creator, STAKE);
        vm.prank(creator);
        address clone = factory.createDuel{value: STAKE}(marketAddr, keccak256("oracle-test"), deadline, creatorIsUp);

        vm.deal(bob, STAKE);
        vm.prank(bob);
        (bool sent,) = clone.call{value: STAKE}("");
        assertTrue(sent);
        vm.prank(bob);
        Wager(payable(clone)).join();
        w = Wager(payable(clone));
    }

    function _attest(Wager w, bool upWon, uint256 windowEnd) internal view returns (bytes memory) {
        bytes32 digest = keccak256(abi.encode(address(w), block.chainid, upWon, windowEnd));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ORACLE_PK, keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", digest)));
        return abi.encodePacked(r, s, v);
    }

    // ═══════════════════════════════════════════════════════
    // WINNER MATRIX (mirror of WagerSides.t.sol, via oracle path)
    // ═══════════════════════════════════════════════════════

    function test_oracleSettle_creatorUp_upWon_creatorWins() public {
        (Wager w, uint256 deadline) = _createAndJoin(alice, true, address(marketUpWon));
        vm.warp(deadline + 1);

        uint256 aliceBefore = alice.balance;
        w.settleByOracle(true, deadline, _attest(w, true, deadline));

        assertEq(uint8(w.state()), uint8(Wager.WagerState.SETTLED));
        uint256 expectedFee = (STAKE * 2 * FEE_BPS) / 10000;
        assertEq(alice.balance - aliceBefore, STAKE * 2 - expectedFee);
        assertEq(address(w).balance, 0);
    }

    function test_oracleSettle_creatorUp_downWon_joinerWins() public {
        (Wager w, uint256 deadline) = _createAndJoin(alice, true, address(marketDownWon));
        vm.warp(deadline + 1);

        uint256 bobBefore = bob.balance;
        w.settleByOracle(false, deadline, _attest(w, false, deadline));

        uint256 expectedFee = (STAKE * 2 * FEE_BPS) / 10000;
        assertEq(bob.balance - bobBefore, STAKE * 2 - expectedFee);
    }

    function test_oracleSettle_creatorDown_downWon_creatorWins() public {
        (Wager w, uint256 deadline) = _createAndJoin(alice, false, address(marketDownWon));
        vm.warp(deadline + 1);

        uint256 aliceBefore = alice.balance;
        w.settleByOracle(false, deadline, _attest(w, false, deadline));

        uint256 expectedFee = (STAKE * 2 * FEE_BPS) / 10000;
        assertEq(alice.balance - aliceBefore, STAKE * 2 - expectedFee);
    }

    function test_oracleSettle_creatorDown_upWon_joinerWins() public {
        (Wager w, uint256 deadline) = _createAndJoin(alice, false, address(marketUpWon));
        vm.warp(deadline + 1);

        uint256 bobBefore = bob.balance;
        w.settleByOracle(true, deadline, _attest(w, true, deadline));

        uint256 expectedFee = (STAKE * 2 * FEE_BPS) / 10000;
        assertEq(bob.balance - bobBefore, STAKE * 2 - expectedFee);
    }

    // ═══════════════════════════════════════════════════════
    // PAYOUT PARITY: oracle path must pay exactly what settle() pays
    // ═══════════════════════════════════════════════════════

    function test_oracleSettle_payoutParityWithSettle() public {
        // Same scenario through BOTH paths; winner deltas must match to the wei.
        (Wager wOracle, uint256 deadlineA) = _createAndJoin(alice, true, address(marketUpWon));
        vm.warp(deadlineA + 1);
        uint256 aliceBefore = alice.balance;
        wOracle.settleByOracle(true, deadlineA, _attest(wOracle, true, deadlineA));
        uint256 oracleDelta = alice.balance - aliceBefore;

        uint256 snapshot = vm.snapshotState();

        // Fresh chain: identical duel settled via the ORIGINAL settle() path
        vm.revertToStateAndDelete(snapshot);
        GambitFactory plainFactory = new GambitFactory(
            address(feeRecipient), FEE_BPS, MIN_STAKE, MAX_STAKE, address(0), address(0)
        );
        uint256 deadline = block.timestamp + DEADLINE_OFFSET;
        vm.deal(alice, STAKE);
        vm.prank(alice);
        address clone = plainFactory.createDuel{value: STAKE}(address(marketUpWon), keccak256("parity"), deadline, true);
        vm.deal(bob, STAKE);
        vm.prank(bob);
        (bool sent,) = clone.call{value: STAKE}("");
        assertTrue(sent);
        vm.prank(bob);
        Wager(payable(clone)).join();
        vm.warp(deadline + 1);

        aliceBefore = alice.balance;
        Wager(payable(clone)).settle(); // market resolves UP via payoutNumerators
        uint256 settleDelta = alice.balance - aliceBefore;

        assertEq(oracleDelta, settleDelta, "oracle path must pay exactly what settle() pays");
    }

    // ═══════════════════════════════════════════════════════
    // SIGNATURE SECURITY MATRIX
    // ═══════════════════════════════════════════════════════

    function test_oracleSettle_revertsBeforeWindowCloses() public {
        (Wager w, uint256 deadline) = _createAndJoin(alice, true, address(marketUpWon));
        // Not warped past deadline yet
        vm.expectRevert("window open");
        w.settleByOracle(true, deadline, _attest(w, true, deadline));
    }

    function test_oracleSettle_revertsBadWindow() public {
        (Wager w, uint256 deadline) = _createAndJoin(alice, true, address(marketUpWon));
        vm.warp(deadline + 1);
        vm.expectRevert("bad window");
        w.settleByOracle(true, deadline + 1, _attest(w, true, deadline + 1));
        vm.expectRevert("bad window");
        w.settleByOracle(true, deadline - 1, _attest(w, true, deadline - 1));
    }

    function test_oracleSettle_revertsBadSignature() public {
        (Wager w, uint256 deadline) = _createAndJoin(alice, true, address(marketUpWon));
        vm.warp(deadline + 1);

        // Signed by a non-oracle key
        uint256 fakePk = 0xB0B000000000000000000000000000000000000000000000000000000000002;
        bytes32 digest = keccak256(abi.encode(address(w), block.chainid, true, deadline));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(fakePk, keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", digest)));
        vm.expectRevert("bad oracle signature");
        w.settleByOracle(true, deadline, abi.encodePacked(r, s, v));

        // Flipped side after signing — signature no longer matches
        vm.expectRevert("bad oracle signature");
        w.settleByOracle(false, deadline, _attest(w, true, deadline));
    }

    function test_oracleSettle_signatureNotReplayableAcrossDuels() public {
        (Wager wA, uint256 deadlineA) = _createAndJoin(alice, true, address(marketUpWon));
        vm.warp(deadlineA + 1);
        // Second duel on the same window
        uint256 deadlineB = block.timestamp + DEADLINE_OFFSET;
        vm.deal(alice, STAKE);
        vm.prank(alice);
        address cloneB = factory.createDuel{value: STAKE}(address(marketUpWon), keccak256("oracle-test-2"), deadlineB, true);
        vm.deal(bob, STAKE);
        vm.prank(bob);
        (bool sent,) = cloneB.call{value: STAKE}("");
        assertTrue(sent);
        vm.prank(bob);
        Wager(payable(cloneB)).join();
        vm.warp(deadlineB + 1);

        // Duel A's attestation used on duel B must fail (clone address bound)
        bytes memory sigA = _attest(wA, true, deadlineA);
        vm.expectRevert("bad oracle signature");
        Wager(payable(cloneB)).settleByOracle(true, deadlineB, sigA);

        // Correct per-duel attestation still works on each duel
        wA.settleByOracle(true, deadlineA, sigA);
        Wager(payable(cloneB)).settleByOracle(true, deadlineB, _attest(Wager(payable(cloneB)), true, deadlineB));
    }

    function test_oracleSettle_revertsNoOpponent() public {
        uint256 deadline = block.timestamp + DEADLINE_OFFSET;
        vm.deal(alice, STAKE);
        vm.prank(alice);
        address clone = factory.createDuel{value: STAKE}(address(marketUpWon), keccak256("no-opp"), deadline, true);
        vm.warp(deadline + 1);
        // inState(LOCKED) modifier fires before the body: a CREATED duel (no
        // opponent) reverts "wrong state"; "no opponent" stays as defense-in-depth.
        vm.expectRevert("wrong state");
        Wager(payable(clone)).settleByOracle(true, deadline, _attest(Wager(payable(clone)), true, deadline));
    }

    function test_oracleSettle_revertsWrongState() public {
        (Wager w, uint256 deadline) = _createAndJoin(alice, true, address(marketUpWon));
        vm.warp(deadline + 1);
        w.settleByOracle(true, deadline, _attest(w, true, deadline));
        vm.expectRevert("wrong state");
        w.settleByOracle(true, deadline, _attest(w, true, deadline));
    }

    function test_oracleSettle_disabledWhenZeroSigner() public {
        uint256 deadline = block.timestamp + DEADLINE_OFFSET;
        vm.deal(alice, STAKE);
        vm.prank(alice);
        address clone = disabledFactory.createDuel{value: STAKE}(address(marketUpWon), keccak256("disabled"), deadline, true);
        vm.deal(bob, STAKE);
        vm.prank(bob);
        (bool sent,) = clone.call{value: STAKE}("");
        assertTrue(sent);
        vm.prank(bob);
        Wager(payable(clone)).join();
        vm.warp(deadline + 1);

        vm.expectRevert("no oracle signer");
        Wager(payable(clone)).settleByOracle(true, deadline, _attest(Wager(payable(clone)), true, deadline));
    }

    function test_oracleSettle_eventEmitted() public {
        (Wager w, uint256 deadline) = _createAndJoin(alice, true, address(marketUpWon));
        vm.warp(deadline + 1);
        uint256 expectedFee = (STAKE * 2 * FEE_BPS) / 10000;
        vm.expectEmit(true, false, false, true, address(w));
        emit Wager.OracleSettled(alice, true, STAKE * 2 - expectedFee);
        w.settleByOracle(true, deadline, _attest(w, true, deadline));
    }

    // ═══════════════════════════════════════════════════════
    // EXISTING settle() PATH UNAFFECTED
    // ═══════════════════════════════════════════════════════

    function test_settle_stillWorksNormallyWithOracleEnabledFactory() public {
        // An oracle-enabled factory must NOT change the classic path: a resolved
        // market settles via settle() exactly as before.
        (Wager w, uint256 deadline) = _createAndJoin(alice, true, address(marketUpWon));
        vm.warp(deadline + 1);
        uint256 aliceBefore = alice.balance;
        w.settle(); // direct on-chain resolution path — unchanged
        uint256 expectedFee = (STAKE * 2 * FEE_BPS) / 10000;
        assertEq(alice.balance - aliceBefore, STAKE * 2 - expectedFee);
        assertEq(uint8(w.state()), uint8(Wager.WagerState.SETTLED));
    }
}
