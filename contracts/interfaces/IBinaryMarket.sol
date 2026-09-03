// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IBinaryMarket {
    function isResolved() external view returns (bool);
    function isVoided() external view returns (bool);
    function payoutNumerators() external view returns (uint256[] memory);
    function status() external view returns (uint8);
}
