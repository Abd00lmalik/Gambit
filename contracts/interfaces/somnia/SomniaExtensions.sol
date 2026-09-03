// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ISomniaReactivityPrecompile} from "./ISomniaReactivityPrecompile.sol";
import {ISomniaEventHandler} from "./ISomniaEventHandler.sol";

/// @notice Ergonomic helper library for the Somnia reactivity precompile.
/// @dev See: https://docs.somnia.network/developer/reactivity/reactivity-onchain
library SomniaExtensions {
    address public constant SOMNIA_REACTIVITY_PRECOMPILE_ADDRESS = address(0x0100);
    uint256 public constant SUBSCRIPTION_OWNER_MINIMUM_BALANCE = 32 ether;
    uint64 public constant MINIMUM_BASE_FEE_PER_GAS = 6 gwei;
    uint256 public constant MAXIMUM_HANDLER_GAS_LIMIT = 200_000_000;

    struct SubscriptionFilter {
        bytes32[4] eventTopics;
        address origin;
        address emitter;
    }

    struct SubscriptionOptions {
        uint64 priorityFeePerGas;
        uint64 maxFeePerGas;
        uint64 gasLimit;
    }

    /// @notice Create a subscription with the given filter.
    /// @param handler The contract that will receive callbacks
    /// @param filter The event filter (at least one of eventTopics, origin, or emitter must be set)
    /// @param options Gas configuration for handler execution
    /// @return subscriptionId The ID of the created subscription
    function subscribe(
        address handler,
        SubscriptionFilter memory filter,
        SubscriptionOptions memory options
    ) internal returns (uint256 subscriptionId) {
        require(handler != address(0), "handler is zero");
        require(
            filter.eventTopics[0] != bytes32(0) ||
            filter.origin != address(0) ||
            filter.emitter != address(0),
            "at least one filter field required"
        );
        require(
            options.maxFeePerGas >= options.priorityFeePerGas + MINIMUM_BASE_FEE_PER_GAS,
            "maxFeePerGas too low"
        );
        require(
            options.gasLimit >= 200_000 && options.gasLimit <= MAXIMUM_HANDLER_GAS_LIMIT,
            "gasLimit out of range"
        );
        require(
            address(this).balance >= SUBSCRIPTION_OWNER_MINIMUM_BALANCE,
            "insufficient balance for subscription"
        );

        ISomniaReactivityPrecompile.SubscriptionData memory data = ISomniaReactivityPrecompile
            .SubscriptionData({
                eventTopics: filter.eventTopics,
                origin: filter.origin,
                caller: address(0),
                emitter: filter.emitter,
                handlerContractAddress: handler,
                handlerFunctionSelector: ISomniaEventHandler.onEvent.selector,
                priorityFeePerGas: options.priorityFeePerGas,
                maxFeePerGas: options.maxFeePerGas,
                gasLimit: options.gasLimit,
                isGuaranteed: true,
                isCoalesced: false
            });

        subscriptionId = ISomniaReactivityPrecompile(SOMNIA_REACTIVITY_PRECOMPILE_ADDRESS)
            .subscribe(data);
    }

    /// @notice Cancel a subscription owned by the caller.
    function unsubscribe(uint256 subscriptionId) internal {
        (bool ok, ) = SOMNIA_REACTIVITY_PRECOMPILE_ADDRESS.call(
            abi.encodeWithSignature("unsubscribe(uint256)", subscriptionId)
        );
        require(ok, "unsubscribe failed");
    }

    /// @notice Read a subscription's stored parameters and owner.
    function getSubscriptionInfo(
        uint256 subscriptionId
    )
        internal
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
        )
    {
        return ISomniaReactivityPrecompile(SOMNIA_REACTIVITY_PRECOMPILE_ADDRESS)
            .getSubscriptionInfo(subscriptionId);
    }
}

/// @notice Abstract base contract for Somnia reactivity handlers.
/// @dev Inherit this and override _onEvent(). The precompile is the only
///      authorized caller of onEvent().
abstract contract SomniaEventHandler is ISomniaEventHandler {
    /// @dev The reactivity precompile calls this. Only the precompile may call it.
    function onEvent(
        address emitter,
        bytes32[] calldata eventTopics,
        bytes calldata data
    ) external {
        require(msg.sender == SomniaExtensions.SOMNIA_REACTIVITY_PRECOMPILE_ADDRESS, "!precompile");
        _onEvent(emitter, eventTopics, data);
    }

    /// @dev Override this to handle reactive events.
    function _onEvent(
        address emitter,
        bytes32[] calldata eventTopics,
        bytes calldata data
    ) internal virtual;

    /// @dev ERC-165 support.
    function supportsInterface(bytes4 interfaceId) public pure virtual returns (bool) {
        return interfaceId == type(ISomniaEventHandler).interfaceId;
    }
}
