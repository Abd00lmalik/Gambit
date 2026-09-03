// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import {GambitFactory} from "../contracts/GambitFactory.sol";

contract DeployFactory is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        GambitFactory factory = new GambitFactory(
            0x25265b9dBEb6c653b0CA281110Bb0697a9685107, // feeRecipient
            250,                                         // 2.5% fee
            0.1 ether,                                   // minStake
            100 ether                                    // maxStake
        );

        vm.stopBroadcast();

        console.log("Factory:", address(factory));
        console.log("Implementation:", factory.implementation());
    }
}
