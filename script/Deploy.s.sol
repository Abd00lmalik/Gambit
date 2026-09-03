// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import {GambitFactory} from "../contracts/GambitFactory.sol";

contract DeployFactory is Script {
    function run() external {
        address deployer = msg.sender;

        console2.log("Deployer:", deployer);
        console2.log("Balance:", deployer.balance);

        vm.startBroadcast();

        GambitFactory factory = new GambitFactory(
            deployer,
            250,
            0.1 ether,
            100 ether
        );

        vm.stopBroadcast();

        console2.log("=== DEPLOYMENT COMPLETE ===");
        console2.log("Factory:", address(factory));
        console2.log("Implementation:", factory.implementation());
        console2.log("Fee Recipient:", factory.feeRecipient());
        console2.log("Default Fee (bps):", factory.defaultFeeBps());
        console2.log("Min Stake:", factory.minStake());
        console2.log("Max Stake:", factory.maxStake());
    }
}
