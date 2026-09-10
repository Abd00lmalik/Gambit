// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../contracts/GambitFactory.sol";

contract DeployV30 is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerKey);

        // V30: creator side support (Priority 2) + anti-premature/stale settlement.
        //  1. Wager stores creatorIsUp explicitly; settle() pays the player whose
        //     STORED side matches the resolved outcome (no more playerA=Up assumption).
        //  2. settle() refuses to settle before the market's expiry timestamp
        //     (DreamDEX markets report isResolved()=true with placeholder payouts
        //     while still trading) and refuses stale module records (DreamDEX
        //     recurring series reuse marketIds; the record can point at a past
        //     window's Market contract with frozen payouts).
        GambitFactory factory = new GambitFactory(
            0x25265b9dBEb6c653b0CA281110Bb0697a9685107, // feeRecipient (unchanged)
            250,                                        // feeBps (2.5%)
            100000000000000000,                         // minStake (0.1 STT)
            100000000000000000000,                      // maxStake (100 STT)
            address(0)                                  // deploy Wager inline
        );

        console2.log("=== V30 DEPLOYMENT COMPLETE ===");
        console2.log("Factory:", address(factory));
        console2.log("Implementation:", factory.implementation());
        console2.log("Fee recipient:", factory.feeRecipient());
        console2.log("Min stake:", factory.minStake());
        console2.log("Max stake:", factory.maxStake());

        vm.stopBroadcast();
    }
}
