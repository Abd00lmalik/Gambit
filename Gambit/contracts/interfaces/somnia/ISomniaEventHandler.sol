// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Callback interface for Somnia reactivity handlers.
/// @dev The reactivity precompile calls onEvent() on the handler contract
///      when a matching event is detected. msg.sender will be 0x0100.
interface ISomniaEventHandler {
    function onEvent(
        address emitter,
        bytes32[] calldata eventTopics,
        bytes calldata data
    ) external;
}
