// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../contracts/GambitFactory.sol";

contract DeployV27 is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerKey);

        // Deploy new Wager implementation with split handling
        Wager newImpl = new Wager();

        // V27: Same params as v26 but with new Wager impl that handles split markets
        GambitFactory factory = new GambitFactory(
            msg.sender,                          // owner
            250,                                 // feeBps (2.5%)
            100000000000000000,                  // minStake (0.1 STT)
            100000000000000000000,               // maxStake (100 STT)
            address(newImpl)                     // new implementation with split handling
        );

        console2.log("=== V27 DEPLOYMENT COMPLETE ===");
        console2.log("Factory:", address(factory));
        console2.log("Implementation:", address(newImpl));

        vm.stopBroadcast();
    }
}
