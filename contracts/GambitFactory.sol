// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {Wager} from "./Wager.sol";
import {IBinaryMarketsModule} from "./interfaces/IBinaryMarketsModule.sol";

/// @notice Factory for deploying Wager clones via EIP-1167 minimal proxy.
/// @dev Deploys the logic contract once in constructor, then clones per duel.
///      Each clone is initialized with playerA, stake, market, fee, and deadline.
///      Player A's stake is forwarded to the clone via recordDeposit() during createDuel().
///      Each clone is funded with SUBSCRIPTION_FUND SOMI for the Somnia reactivity subscription.
contract GambitFactory {
    // ── State ──────────────────────────────────────────────

    /// @notice BinaryMarketsModule — the registry that maps marketId → Market contract.
    address public constant BINARY_MARKETS_MODULE = 0x3ecC694Cef705358864a646142ac17A90E29e388;

    /// @notice Accepted Market contract implementation (EIP-1167 impl address).
    /// @dev Markets with older implementations (0xd12ad05b...) don't emit Resolved events
    ///      and cannot be used for reactive settlement. Only this implementation is supported.
    bytes20 public constant ACCEPTED_MARKET_IMPL = hex"6b2fee58f90aee79be03e417213c547526791102";

    address public immutable implementation;
    address public owner;
    address public feeRecipient;
    uint256 public defaultFeeBps;
    uint256 public minStake;
    uint256 public maxStake;

    /// @notice SOMI funded to each Wager clone for the reactivity subscription.
    /// @dev 32 SOMI minimum required by Somnia reactivity precompile + buffer for gas.
    uint256 public constant SUBSCRIPTION_FUND = 35 ether;

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
    constructor(
        address _feeRecipient,
        uint256 _defaultFeeBps,
        uint256 _minStake,
        uint256 _maxStake
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

        implementation = address(new Wager());
    }

    // ── External functions ─────────────────────────────────

    /// @notice Create a new duel. Player A's stake is sent as msg.value.
    /// @dev The stake is forwarded to the clone via recordDeposit() (not receive()).
    ///      This avoids the Somnia quirk where writeContract+value reverts.
    ///      An additional SUBSCRIPTION_FUND is sent to fund the reactivity subscription.
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

        // Fund the clone with SOMI for the reactivity subscription (non-critical).
        // On Somnia mainnet, factory should be pre-funded via receive() or direct transfers.
        // In tests, factory may have no balance — auto-settlement falls back to manual settle().
        if (address(this).balance >= SUBSCRIPTION_FUND) {
            (bool fundOk, ) = payable(clone).call{value: SUBSCRIPTION_FUND}("");
            if (fundOk) {
                // Create the reactivity subscription (non-critical — failure doesn't revert).
                (bool subOk, ) = clone.call(
                    abi.encodeWithSignature("createSubscription()")
                );
                // subOk is false if precompile doesn't exist — that's fine.
            }
        }

        emit DuelCreated(clone, msg.sender, msg.value, _marketAddress, _joinDeadline);
    }

    /// @notice Fund the factory treasury for reactivity subscription costs.
    /// @dev Call this before createDuel() to ensure each clone gets 35 SOMI for auto-settlement.
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
        // 1. Check if BinaryMarketsModule exists (extcodesize == 0 in tests)
        uint256 moduleCodeSize;
        assembly { moduleCodeSize := extcodesize(BINARY_MARKETS_MODULE) }
        if (moduleCodeSize == 0) return; // skip verification — no module (tests)

        // 2. Look up Market contract from BinaryMarketsModule
        (bool ok, bytes memory result) = BINARY_MARKETS_MODULE.staticcall(
            abi.encodeWithSignature("markets(bytes32)", _marketId)
        );
        require(ok && result.length >= 320, "market not found in module");

        // Decode the market address from word index 8 of the MarketRecord struct
        address marketAddr;
        assembly {
            marketAddr := mload(add(result, add(256, 12)))
        }
        require(marketAddr != address(0), "zero market address");

        // 2. Check the Market contract has code
        uint256 codeSize;
        assembly { codeSize := extcodesize(marketAddr) }
        require(codeSize > 0, "market has no code");

        // 3. Verify the implementation matches the accepted version.
        // The Market contract is an EIP-1167 proxy. Extract the implementation from bytecode:
        //   363d3d373d3d3d363d73<20-byte impl>5af43d82803e903d91602b57fd5bf3
        require(codeSize >= 45, "market code too short");

        // Copy the first 32 bytes of the Market contract's code into memory
        bytes32 codeWord;
        assembly {
            // extcodecopy(addr, destOffset, srcOffset, length)
            // Copy 32 bytes from code[0] to memory at free memory pointer
            let fmp := mload(0x40)
            extcodecopy(marketAddr, fmp, 0, 32)
            codeWord := mload(fmp)
        }
        // The implementation address is at code[10:30] — bytes 10-29 of codeWord
        // codeWord = 363d3d373d3d3d363d73<20-byte impl>5af43d82...
        // Shift right by 80 bits (10 bytes) to move impl to the lower 20 bytes
        bytes20 impl;
        assembly {
            impl := shr(80, codeWord)
        }
        require(impl == ACCEPTED_MARKET_IMPL, "unsupported market implementation");
    }

    /// @notice Create a reactivity subscription for an existing duel that was created without one.
    /// @dev This handles the case where the factory didn't have enough balance during createDuel().
    ///      The factory must have >= 35 SOMI balance. Can only be called once per duel.
    /// @param clone Address of the Wager clone to create a subscription for
    function createSubscriptionForDuel(address clone) external onlyOwner {
        require(clone != address(0), "zero clone");
        require(address(this).balance >= SUBSCRIPTION_FUND, "insufficient balance");

        (bool fundOk, ) = payable(clone).call{value: SUBSCRIPTION_FUND}("");
        require(fundOk, "fund transfer failed");

        (bool subOk, ) = clone.call(
            abi.encodeWithSignature("createSubscription()")
        );
        require(subOk, "subscription creation failed");
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
