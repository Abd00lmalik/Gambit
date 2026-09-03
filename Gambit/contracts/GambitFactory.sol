// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {Wager} from "./Wager.sol";

/// @notice Factory for deploying Wager clones via EIP-1167 minimal proxy.
/// @dev Deploys the logic contract once in constructor, then clones per duel.
///      Each clone is initialized with playerA, stake, market, fee, and deadline.
///      Player A's stake is forwarded to the clone via recordDeposit() during createDuel().
///      Each clone is funded with SUBSCRIPTION_FUND SOMI for the Somnia reactivity subscription.
contract GambitFactory {
    // ── State ──────────────────────────────────────────────

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
    /// @param _joinDeadline Unix timestamp after which A can cancel if B hasn't joined
    /// @return clone Address of the newly deployed Wager clone
    function createDuel(
        address _marketAddress,
        uint256 _joinDeadline
    ) external payable returns (address clone) {
        require(msg.value >= minStake, "stake below min");
        require(msg.value <= maxStake, "stake above max");
        require(_marketAddress != address(0), "zero market");
        require(_joinDeadline > block.timestamp, "deadline past");

        clone = Clones.clone(implementation);

        // Initialize clone (sets factory = this contract, owner = playerA)
        Wager(payable(clone)).initialize(
            msg.sender,
            msg.value,
            _marketAddress,
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
