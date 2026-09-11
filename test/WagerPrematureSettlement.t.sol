// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import {Wager} from "../contracts/Wager.sol";
import {GambitFactory} from "../contracts/GambitFactory.sol";

/// @dev Mock DreamDEX market that REPRODUCES the premature-resolution bug:
///      isResolved() returns true and payoutNumerators() returns the placeholder
///      [1e7, 0] even while the market is still trading. (Verified on-chain
///      2026-09-10 — five live Trading markets all reported isResolved=true.)
contract LyingMockMarket {
    bool private _genuinelyResolved;
    uint256[] private _payouts;

    constructor() {
        _payouts = new uint256[](2);
        _payouts[0] = 10_000_000; // placeholder — same shape as live DreamDEX markets
        _payouts[1] = 0;
    }

    function genuinelyResolve(uint256 up, uint256 down) external {
        _genuinelyResolved = true;
        _payouts[0] = up;
        _payouts[1] = down;
    }

    function isResolved() external view returns (bool) { return true; } // lies pre-expiry
    function isVoided() external view returns (bool) { return false; }
    function payoutNumerators() external view returns (uint256[] memory) { return _payouts; }
    function status() external view returns (uint8) { return _genuinelyResolved ? 4 : 0; }
}

/// @dev Mock BinaryMarketsModule whose record lives in IMMUTABLES (not storage).
///      Wager hardcodes the real module address, so tests vm.etch this
///      contract's runtime code at that address — etched code runs with the
///      TARGET's (empty) storage, so stateful mocks return all-zero records.
///      Immutables are embedded in the runtime bytecode and survive the etch.
contract MockBinaryMarketsModule {
    struct MarketRecord {
        uint256 oracleQuestionId;
        uint8 outcomeSlotCount;
        uint8 voidPolicy;
        address collateral;
        uint32 originOperatorId;
        bytes32 originVenueId;
        address oracleAdapter;
        address creator;
        address market;
        address pool;
        uint256 yesId;
        uint256 noId;
        uint64 tradingStart;
        uint64 expiry;
    }

    address public immutable MARKET;
    address public immutable POOL;
    uint64 public immutable EXPIRY;

    constructor(address market, address pool, uint64 expiry) {
        MARKET = market;
        POOL = pool;
        EXPIRY = expiry;
    }

    function markets(bytes32) external view returns (MarketRecord memory r) {
        r.oracleQuestionId = 1;
        r.outcomeSlotCount = 2;
        r.market = MARKET;
        r.pool = POOL;
        r.tradingStart = EXPIRY > 900 ? EXPIRY - 900 : 0;
        r.expiry = EXPIRY;
    }
}

/// @title Premature-settlement regression tests (Priority 1)
/// @dev DreamDEX markets expose isResolved()=true + placeholder payouts while
///      still trading, and the module record can point at a PAST window's
///      market. These tests pin the guards: settle() must refuse until the
///      market's expiry (from the module record) has passed AND the record
///      isn't stale.
contract WagerPrematureSettlementTest is Test {
    // Same constant as Wager — the address the hardcoded staticcall targets.
    address constant MODULE = 0x3ecC694Cef705358864a646142ac17A90E29e388;

    GambitFactory public factory;
    LyingMockMarket public market;

    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    uint256 constant STAKE = 1 ether;
    uint256 constant JOIN_DEADLINE_OFFSET = 5 minutes;
    bytes32 constant MARKET_ID = keccak256("premature-test-market");

    function setUp() public {
        // Realistic clock so "past window" arithmetic can't underflow
        vm.warp(200 days);

        market = new LyingMockMarket();

        factory = new GambitFactory(
            makeAddr("feeRecipient"),
            250,
            0.1 ether,
            100 ether,
            address(0), address(0) // oracleSigner (disabled)
        );
    }

    function _etchModule(uint64 expiry) internal {
        MockBinaryMarketsModule m = new MockBinaryMarketsModule(address(market), address(0), expiry);
        vm.etch(MODULE, address(m).code);
    }

    function _createAndJoin(uint64 expiry) internal returns (Wager w) {
        _etchModule(expiry);

        vm.deal(alice, STAKE);
        vm.prank(alice);
        address clone = factory.createDuel{value: STAKE}(
            address(market),
            MARKET_ID,
            block.timestamp + JOIN_DEADLINE_OFFSET,
            true
        );
        w = Wager(payable(clone));

        vm.deal(bob, STAKE);
        vm.prank(bob);
        (bool sent,) = clone.call{value: STAKE}("");
        assertTrue(sent);
        vm.prank(bob);
        w.join();
    }

    /// @notice THE regression: market reports isResolved()=true + placeholder
    ///         payouts BEFORE expiry → settle() must revert, not pay the creator.
    function test_settle_revertsWhileMarketStillTrading() public {
        uint64 futureExpiry = uint64(block.timestamp + 30 minutes);
        Wager w = _createAndJoin(futureExpiry);

        assertTrue(market.isResolved(), "mock market reports resolved (placeholder)");
        vm.expectRevert("market not final");
        w.settle();

        // Funds untouched
        assertEq(address(w).balance, STAKE * 2, "pot must stay escrowed");
        assertEq(uint8(w.state()), uint8(Wager.WagerState.LOCKED));
    }

    /// @notice After expiry passes, settlement is allowed — and pays the side
    ///         the oracle actually chose (creator picked UP; oracle says DOWN
    ///         → the joiner wins).
    function test_settle_succeedsAfterExpiryWithRealPayouts() public {
        uint64 expiry = uint64(block.timestamp + 10 minutes);
        Wager w = _createAndJoin(expiry);

        // Oracle finalizes: DOWN won (up=0, down=nonzero)
        market.genuinelyResolve(0, 10_000_000);

        // Still inside the window → refused
        vm.expectRevert("market not final");
        w.settle();

        // Expiry passes → settlement allowed, pays the DOWN side (bob)
        vm.warp(expiry + 1);
        uint256 bobBefore = bob.balance;
        w.settle();
        uint256 fee = (STAKE * 2 * 250) / 10000;
        assertEq(bob.balance - bobBefore, STAKE * 2 - fee, "joiner (DOWN) wins after genuine resolution");
        assertEq(uint8(w.state()), uint8(Wager.WagerState.SETTLED));
    }

    /// @notice Zero expiry (no module data) skips the guard — legacy/test behaviour.
    function test_settle_zeroExpirySkipsGuard() public {
        Wager w = _createAndJoin(0);

        // No expiry data → guard skipped → placeholder settles (legacy semantics)
        w.settle();
        assertEq(uint8(w.state()), uint8(Wager.WagerState.SETTLED));
    }

    /// @notice THE stale-record regression (the actual reported bug, found
    ///         on-chain 2026-09-10): the module record for the duel's marketId
    ///         points at a PAST window's Market contract (expiry 2026-08-11)
    ///         whose payouts are frozen at that old outcome, while the duel was
    ///         created for a market window on 2026-09-10. settle() must refuse —
    ///         paying the frozen payouts gives the win to whichever side won the
    ///         OLD market (here: the creator, since the placeholder is UP-won).
    function test_settle_revertsOnStaleModuleRecord() public {
        // Record from a month-old window: expiry long past, BEFORE the duel's
        // join deadline (which was capped at the CURRENT window's expiry).
        uint64 staleExpiry = uint64(block.timestamp - 30 days);
        Wager w = _createAndJoin(staleExpiry);

        // The stale market says "resolved, UP won" (frozen placeholder)
        assertTrue(market.isResolved());

        // Re-etch with an expiry 2 hours in the past (beyond the 1-hour grace,
        // and before the duel's join deadline): block.timestamp >= expiry passes
        // the "not final" check, exposing the staleness check specifically.
        _etchModule(uint64(block.timestamp - 2 hours));
        vm.expectRevert("stale market record");
        w.settle();

        // Funds untouched — no wrongful payout
        assertEq(address(w).balance, STAKE * 2, "pot must stay escrowed");
        assertEq(uint8(w.state()), uint8(Wager.WagerState.LOCKED));
    }

    /// @notice A CURRENT window's record (expiry after joinDeadline) settles
    ///         normally once its expiry passes and the oracle writes real payouts.
    function test_settle_currentRecord_settlesAfterExpiry() public {
        uint64 expiry = uint64(block.timestamp + 10 minutes);
        // joinDeadline is now + 5 min; expiry (now+10) > joinDeadline → current
        Wager w = _createAndJoin(expiry);

        market.genuinelyResolve(10_000_000, 0); // oracle: UP won
        vm.warp(expiry + 1);

        uint256 aliceBefore = alice.balance;
        w.settle(); // creator picked UP and UP won → creator wins
        uint256 fee = (STAKE * 2 * 250) / 10000;
        assertEq(alice.balance - aliceBefore, STAKE * 2 - fee);
        assertEq(uint8(w.state()), uint8(Wager.WagerState.SETTLED));
    }
}
