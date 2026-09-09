// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../contracts/GambitFactory.sol";

contract DeployV26 is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerKey);

        // V26: Same params as v25 but cancelDuel() is now permissionless
        GambitFactory factory = new GambitFactory(
            msg.sender,                                    // owner
            250,                                           // feeBps (2.5%)
            100000000000000000,                            // minStake (0.1 STT)
            100000000000000000000,                         // subscriptionFund (100 STT)
            0xD2383487546eAdF0266A80c65d9F70aA7EB44173    // implementation (reuses v25 Wager impl)
        );

        console2.log("=== V26 DEPLOYMENT COMPLETE ===");
        console2.log("Factory:", address(factory));
        console2.log("Implementation:", factory.implementation());

        vm.stopBroadcast();
    }
}
