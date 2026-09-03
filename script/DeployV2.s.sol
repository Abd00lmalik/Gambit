// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import {GambitFactory} from "../contracts/GambitFactory.sol";

contract DeployV2 is Script {
    function run() external {
        vm.startBroadcast();

        GambitFactory factory = new GambitFactory(
            vm.addr(vm.envUint("PRIVATE_KEY")),
            250,
            0.1 ether,
            100 ether
        );

        vm.stopBroadcast();

        console2.log("=== DEPLOYMENT COMPLETE ===");
        console2.log("Factory:", address(factory));
        console2.log("Implementation:", factory.implementation());
    }
}
