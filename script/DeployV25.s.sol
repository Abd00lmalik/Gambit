// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../contracts/GambitFactory.sol";

contract DeployV25 is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerKey);

        GambitFactory factory = new GambitFactory(
            msg.sender,
            250,
            100000000000000000,
            100000000000000000000,
            0xD2383487546eAdF0266A80c65d9F70aA7EB44173
        );

        console2.log("=== V25 DEPLOYMENT COMPLETE ===");
        console2.log("Factory:", address(factory));
        console2.log("Implementation:", factory.implementation());

        vm.stopBroadcast();
    }
}
