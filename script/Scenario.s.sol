// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import {Wager} from "../contracts/Wager.sol";
import {GambitFactory} from "../contracts/GambitFactory.sol";

/// @notice Scenario script: create → deposit → join → settle on Somnia Shannon.
/// @dev Requires FACTORY_ADDRESS env var (set after Deploy.s.sol runs).
///      Uses two private keys: PRIVATE_KEY (player A) and PRIVATE_KEY_B (player B).
contract RunScenario is Script {
    function run() external {
        uint256 keyA = vm.envUint("PRIVATE_KEY");
        uint256 keyB = vm.envUint("PRIVATE_KEY_B");
        address factoryAddr = vm.envAddress("FACTORY_ADDRESS");
        address marketAddr = vm.envAddress("MARKET_ADDRESS");

        address playerA = vm.addr(keyA);
        address playerB = vm.addr(keyB);

        console2.log("=== SCENARIO START ===");
        console2.log("Player A:", playerA);
        console2.log("Player B:", playerB);
        console2.log("Factory:", factoryAddr);
        console2.log("Market:", marketAddr);

        uint256 stake = 0.5 ether;
        uint256 deadline = block.timestamp + 1 hours;

        // ── Step 1: Player A creates duel ──
        console2.log("\n--- Step 1: Create Duel ---");
        vm.deal(playerA, stake);
        vm.prank(playerA);
        address clone = GambitFactory(payable(factoryAddr)).createDuel{value: stake}(
            marketAddr,
            deadline
        );
        console2.log("Duel created at:", clone);

        Wager w = Wager(payable(clone));
        console2.log("Player A:", w.playerA());
        console2.log("Stake:", w.stakeAmount());
        console2.log("State:", uint8(w.state()));

        // ── Step 2: Player B deposits STT ──
        console2.log("\n--- Step 2: Player B Deposits ---");
        vm.deal(playerB, stake);
        vm.prank(playerB);
        (bool sent,) = clone.call{value: stake}("");
        require(sent, "B deposit failed");
        console2.log("B deposit success, balance:", w.deposits(playerB));

        // ── Step 3: Player B joins ──
        console2.log("\n--- Step 3: Player B Joins ---");
        vm.prank(playerB);
        w.join();
        console2.log("Player B:", w.playerB());
        console2.log("State:", uint8(w.state()));
        console2.log("Pot:", w.getPot());

        console2.log("\n=== SCENARIO PAUSED ===");
        console2.log("Duel is now LOCKED. Wait for DreamDEX market resolution.");
        console2.log("To settle: set market as resolved, then call w.settle()");
    }
}
