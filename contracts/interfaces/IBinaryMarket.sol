// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IBinaryMarket {
    function isResolved() external view returns (bool);
    /// @notice ERC-6909 ids of the YES/NO outcome tokens. The LOW BYTE of each id
    ///         is that outcome's slot index in payoutNumerators()
    ///         (id = (pool << 72) | (nonce << 8) | slot). Never assume slot order —
    ///         Somnia testnet binary markets settle [No, Yes], other deployments
    ///         may settle [Yes, No].
    function yesId() external view returns (uint256);
    function noId() external view returns (uint256);
    function isVoided() external view returns (bool);
    function payoutNumerators() external view returns (uint256[] memory);
    function status() external view returns (uint8);
}
