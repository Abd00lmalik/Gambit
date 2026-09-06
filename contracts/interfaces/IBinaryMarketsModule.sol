// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Minimal interface for DreamDEX BinaryMarketsModule.
/// @dev Only the fields needed for emitter resolution and market verification.
///      ABI sourced from the Somnia markets SDK binaryModuleReadAbi.
interface IBinaryMarketsModule {
    struct MarketRecord {
        uint256 oracleQuestionId;
        uint8 outcomeSlotCount;
        uint8 voidPolicy;
        address collateral;
        uint32 originOperatorId;
        bytes32 originVenueId;
        address oracleAdapter;
        address creator;
        address market;       // The Market contract that emits Resolved events
        address pool;         // The Pool / order-book contract
        uint256 yesId;
        uint256 noId;
        uint64 tradingStart;
        uint64 expiry;
    }

    /// @notice Read a market's on-chain record by its bytes32 marketId.
    function markets(bytes32 marketId) external view returns (MarketRecord memory);
}
