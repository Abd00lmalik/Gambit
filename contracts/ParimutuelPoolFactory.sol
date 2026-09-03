// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {ParimutuelPool} from "./ParimutuelPool.sol";

/// @notice Factory for deploying ParimutuelPool clones via EIP-1167 minimal proxy.
/// @dev Each pool is bound to a specific DreamDEX market. After resolution,
///      players claim proportional payouts based on which side won.
contract ParimutuelPoolFactory {
    // ── State ──────────────────────────────────────────────

    address public immutable implementation;
    address public owner;
    address public feeRecipient;
    uint256 public defaultFeeBps;
    uint256 public minStake;
    uint256 public maxStake;

    mapping(address => bool) public knownPools;

    modifier onlyOwner() {
        require(msg.sender == owner, "!owner");
        _;
    }

    event PoolCreated(
        address indexed pool,
        address indexed creator,
        address marketAddress,
        uint256 deadline,
        uint256 feeBps
    );

    // ── Constructor ────────────────────────────────────────

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

        implementation = address(new ParimutuelPool());
    }

    // ── External functions ─────────────────────────────────

    /// @notice Create a new parimutuel pool for a DreamDEX market.
    /// @param _marketAddress DreamDEX BinaryMarket address
    /// @param _deadline Unix timestamp after which no new deposits accepted
    /// @return pool Address of the newly deployed pool
    function createPool(
        address _marketAddress,
        uint256 _deadline
    ) external returns (address pool) {
        require(_marketAddress != address(0), "zero market");
        require(_deadline > block.timestamp, "deadline past");

        pool = Clones.clone(implementation);

        ParimutuelPool(payable(pool)).initialize(
            msg.sender,
            _marketAddress,
            defaultFeeBps,
            feeRecipient,
            _deadline
        );

        knownPools[pool] = true;

        emit PoolCreated(pool, msg.sender, _marketAddress, _deadline, defaultFeeBps);
    }

    /// @notice Withdraw idle STT from the factory. Owner-only.
    function withdraw(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "zero address");
        require(amount > 0, "zero amount");
        require(address(this).balance >= amount, "insufficient balance");

        (bool ok, ) = payable(to).call{value: amount}("");
        require(ok, "withdraw failed");
    }

    /// @notice Check if an address is a pool created by this factory.
    function isKnownPool(address pool) external view returns (bool) {
        return knownPools[pool];
    }

    receive() external payable {}
}
