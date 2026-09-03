// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract MinimalWager {
    address public factory;
    address public owner;
    address public playerA;
    address public playerB;
    uint256 public stakeAmount;
    mapping(address => uint256) public deposits;

    receive() external payable {
        deposits[msg.sender] += msg.value;
    }
}
