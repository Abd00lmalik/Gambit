// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Minimal interface for the Somnia reactivity precompile at 0x0100.
/// @dev Field order MUST match the precompile's native ABI tuple exactly:
///      (eventTopics, origin, caller, emitter, handlerContractAddress,
///       handlerFunctionSelector, priorityFeePerGas, maxFeePerGas, gasLimit,
///       isGuaranteed, isCoalesced)
///      See: https://docs.somnia.network/developer/reactivity/reactivity-onchain
interface ISomniaReactivityPrecompile {
    struct SubscriptionData {
        bytes32[4] eventTopics;
        address origin;
        address caller;
        address emitter;
        address handlerContractAddress;
        bytes4 handlerFunctionSelector;
        uint64 priorityFeePerGas;
        uint64 maxFeePerGas;
        uint64 gasLimit;
        bool isGuaranteed;
        bool isCoalesced;
    }

    function subscribe(SubscriptionData calldata data) external returns (uint256 subscriptionId);
    function unsubscribe(uint256 subscriptionId) external;
    function getSubscriptionInfo(uint256 subscriptionId)
        external
        view
        returns (
            address owner,
            address handler,
            bytes32[4] memory eventTopics,
            address origin,
            address emitter,
            uint64 priorityFeePerGas,
            uint64 maxFeePerGas,
            uint64 gasLimit
        );
}
