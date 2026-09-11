// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../contracts/GambitFactory.sol";

contract DeployV29 is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerKey);

        // V29: Removed reactivity subscription entirely.
        // 1. Wager.settle() uses address(this).balance directly (no subscriptionFund)
        // 2. Factory no longer sends SUBSCRIPTION_FUND to clones
        // 3. Keeper handles all settlement (no precompile subscription)
        GambitFactory factory = new GambitFactory(
            msg.sender,                          // feeRecipient
            250,                                 // feeBps (2.5%)
            100000000000000000,                  // minStake (0.1 STT)
            100000000000000000000,               // maxStake (100 STT)
            address(0),                          // deploy inline
            address(0)                           // oracleSigner (disabled)
        );

        console2.log("=== V29 DEPLOYMENT COMPLETE ===");
        console2.log("Factory:", address(factory));
        console2.log("Implementation:", factory.implementation());

        vm.stopBroadcast();
    }
}
