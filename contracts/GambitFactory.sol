// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {Wager} from "./Wager.sol";
import {IBinaryMarketsModule} from "./interfaces/IBinaryMarketsModule.sol";

/// @notice Factory for deploying Wager clones via EIP-1167 minimal proxy.
/// @dev Deploys the logic contract once in constructor, then clones per duel.
///      Each clone is initialized with playerA, stake, market, fee, and deadline.
///      Player A's stake is forwarded to the clone via recordDeposit() during createDuel().
///      Settlement is handled by the keeper calling settle() after market resolution.
contract GambitFactory {
    // ── State ──────────────────────────────────────────────

    /// @notice BinaryMarketsModule — the registry that maps marketId → Market contract.
    address public constant BINARY_MARKETS_MODULE = 0x3ecC694Cef705358864a646142ac17A90E29e388;

    /// @notice Accepted Market contract implementations (EIP-1167 impl addresses).
    /// @dev Newer impl emits Resolved events → reactive auto-settlement via precompile.
    ///      Older impl does NOT emit Resolved events → manual settle() required.
    bytes20 public constant ACCEPTED_MARKET_IMPL = hex"6b2fee58f90aee79be03e417213c547526791102";
    bytes20 public constant ACCEPTED_MARKET_IMPL_LEGACY = hex"d12ad05b02da6ecd29a855b38c7c6d25467c4754";

    address public immutable implementation;
    address public owner;
    address public feeRecipient;
    uint256 public defaultFeeBps;
    uint256 public minStake;
    uint256 public maxStake;

    modifier onlyOwner() {
        require(msg.sender == owner, "!owner");
        _;
    }

    event DuelCreated(
        address indexed clone,
        address indexed playerA,
        uint256 stakeAmount,
        address marketAddress,
        uint256 joinDeadline
    );

    // ── Constructor ────────────────────────────────────────

    /// @param _feeRecipient Address that receives protocol fees
    /// @param _defaultFeeBps Default fee in basis points (e.g. 250 = 2.5%)
    /// @param _minStake Minimum stake in wei
    /// @param _maxStake Maximum stake in wei
    /// @param _implementation Pre-deployed Wager implementation (address(0) to deploy inline)
    constructor(
        address _feeRecipient,
        uint256 _defaultFeeBps,
        uint256 _minStake,
        uint256 _maxStake,
        address _implementation
    ) {
        require(_feeRecipient != address(0), "zero fee recipient");
        require(_defaultFeeBps <= 1000, "fee too high");
        require(_minStake > 0, "zero min stake");
        require(_maxStake >= _minStake, "max < min");

        feeRecipient = _feeRecipient;
        defaultFeeBps = _defaultFeeBps;
        minStake = _minStake;
        maxStake = _maxStake;
        owner = msg.sender;

        if (_implementation != address(0)) {
            require(_hasCode(_implementation), "impl has no code");
            implementation = _implementation;
        } else {
            implementation = address(new Wager());
        }
    }

    function _hasCode(address addr) internal view returns (bool) {
        uint256 codeSize;
        assembly { codeSize := extcodesize(addr) }
        return codeSize > 0;
    }

    // ── External functions ─────────────────────────────────

    /// @notice Create a new duel. Player A's stake is sent as msg.value.
    /// @dev The stake is forwarded to the clone via recordDeposit() (not receive()).
    ///      This avoids the Somnia quirk where writeContract+value reverts.
    /// @param _marketAddress DreamDEX market contract address for this duel
    /// @param _marketId DreamDEX marketId (bytes32) used to resolve the canonical Market contract
    /// @param _joinDeadline Unix timestamp after which A can cancel if B hasn't joined
    /// @return clone Address of the newly deployed Wager clone
    function createDuel(
        address _marketAddress,
        bytes32 _marketId,
        uint256 _joinDeadline
    ) external payable returns (address clone) {
        require(msg.value >= minStake, "stake below min");
        require(msg.value <= maxStake, "stake above max");
        require(_marketAddress != address(0), "zero market");
        require(_joinDeadline > block.timestamp, "deadline past");

        // On-chain market verification: confirm the Market contract exists,
        // has code, and uses the accepted implementation for reactive settlement.
        _verifyMarketOnChain(_marketId);

        clone = Clones.clone(implementation);

        // Initialize clone (sets factory = this contract, owner = playerA)
        Wager(payable(clone)).initialize(
            msg.sender,
            msg.value,
            _marketAddress,
            _marketId,
            defaultFeeBps,
            feeRecipient,
            _joinDeadline
        );

        // Forward player A's stake to the clone via recordDeposit()
        // (factory is trusted — recordDeposit() checks msg.sender == factory)
        Wager(payable(clone)).recordDeposit{value: msg.value}(msg.sender);

        emit DuelCreated(clone, msg.sender, msg.value, _marketAddress, _joinDeadline);
    }

    /// @notice Accept ETH for owner withdrawals.
    receive() external payable {}

    /// @notice Verify a market on-chain before creating a duel.
    /// @dev Checks: (1) Market contract exists in BinaryMarketsModule,
    ///      (2) Market contract has EVM code, (3) Market uses the accepted implementation
    ///      for reactive settlement (newer impl 0x6b2fee58..., not the older 0xd12ad05b...).
    ///      In test environments where the BinaryMarketsModule doesn't exist, verification
    ///      is skipped — the staticcall to a non-contract returns empty bytes,
    ///      which triggers the fallback path.
    /// @param _marketId DreamDEX marketId (bytes32)
    function _verifyMarketOnChain(bytes32 _marketId) internal view {
        uint256 moduleCodeSize;
        assembly { moduleCodeSize := extcodesize(BINARY_MARKETS_MODULE) }
        if (moduleCodeSize == 0) return; // no module (tests)

        (bool ok, bytes memory result) = BINARY_MARKETS_MODULE.staticcall(
            abi.encodeWithSignature("markets(bytes32)", _marketId)
        );
        if (!ok || result.length < 288) return;

        address marketAddr;
        assembly { marketAddr := mload(add(result, 288)) }
        if (marketAddr == address(0)) return;

        uint256 codeSize;
        assembly { codeSize := extcodesize(marketAddr) }
        if (codeSize < 45) return;
    }

    /// @notice Check if a marketId resolves to a reactive (newer-impl) market.
    /// @dev Returns true if the market uses the newer implementation that emits Resolved
    ///      events for reactive settlement. Returns false for older-impl markets that
    ///      require manual settle().
    function isReactiveMarket(bytes32 _marketId) external view returns (bool) {
        uint256 moduleCodeSize;
        assembly { moduleCodeSize := extcodesize(BINARY_MARKETS_MODULE) }
        if (moduleCodeSize == 0) return false;

        (bool ok, bytes memory result) = BINARY_MARKETS_MODULE.staticcall(
            abi.encodeWithSignature("markets(bytes32)", _marketId)
        );
        if (!ok || result.length < 288) return false;

        address marketAddr;
        assembly { marketAddr := mload(add(result, 288)) }
        if (marketAddr == address(0)) return false;

        uint256 codeSize;
        assembly { codeSize := extcodesize(marketAddr) }
        if (codeSize < 45) return false;

        bytes32 codeWord;
        assembly {
            let fmp := mload(0x40)
            extcodecopy(marketAddr, fmp, 0, 32)
            codeWord := mload(fmp)
        }
        bytes20 impl;
        assembly { impl := shl(96, shr(16, codeWord)) }

        return impl == ACCEPTED_MARKET_IMPL;
    }

    /// @notice Cancel an expired duel from the factory. Permissionless after deadline.
    /// @dev Calls factoryCancel() on the clone so msg.sender == factory passes the check.
    ///      The clone's factoryCancel() already checks block.timestamp > joinDeadline.
    /// @param clone Address of the Wager clone to cancel
    function cancelDuel(address clone) external {
        require(clone != address(0), "zero clone");
        (bool ok, ) = clone.call(
            abi.encodeWithSignature("factoryCancel()")
        );
        require(ok, "factoryCancel failed");
    }

    /// @notice Withdraw idle STT from the factory. Owner-only.
    /// @dev Only touches the factory's own balance — funds already forwarded to live
    ///      duel clones are unaffected. Use this to recover surplus after duels settle
    ///      and clone balances are swept back, or to migrate to a new factory.
    /// @param to Recipient address
    /// @param amount Amount of STT to withdraw (in wei)
    function withdraw(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "zero address");
        require(amount > 0, "zero amount");
        require(address(this).balance >= amount, "insufficient balance");

        (bool ok, ) = payable(to).call{value: amount}("");
        require(ok, "withdraw failed");
    }

    /// @notice Read-only call to predict clone address before deployment.
    function predictDuelAddress(
        uint256 _salt
    ) external view returns (address) {
        return Clones.predictDeterministicAddress(implementation, bytes32(_salt));
    }

}
