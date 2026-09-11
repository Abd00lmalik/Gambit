// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../contracts/GambitFactory.sol";

contract DeployV28 is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerKey);

        // V28: Same params as v27 but with new Wager impl that:
        // 1. Handles split markets in settle() (refund both players)
        // 2. Allows factoryCancel() before deadline if market already resolved
        GambitFactory factory = new GambitFactory(
            msg.sender,                          // feeRecipient
            250,                                 // feeBps (2.5%)
            100000000000000000,                  // minStake (0.1 STT)
            100000000000000000000,               // maxStake (100 STT)
            address(0),                          // deploy inline
            address(0)                           // oracleSigner (disabled)
        );

        console2.log("=== V28 DEPLOYMENT COMPLETE ===");
        console2.log("Factory:", address(factory));
        console2.log("Implementation:", factory.implementation());

        vm.stopBroadcast();
    }
}
