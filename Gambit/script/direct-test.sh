#!/bin/bash
export PATH="/home/imaarm/.foundry/bin:$PATH"
RPC="https://api.infra.testnet.somnia.network"
PK_A="0xd9c246d4b642c0d95adf60a8a6e680352b996a9d139ca9f5d4fa1f545487095a"
PK_B="0x76d73b841d6b086cf98dda0f97588ec9f463472b6f016eae73f51b966be7aed7"
B_ADDR="0x0022EC010030158cC27B283BA640706eDBa6080f"
A_ADDR="0xF241F1A68878996aB1484f27099395c46796bC90"
FACTORY="0x3E106bA72C3AdB511076Cf849c4A70bb132Be395"
MARKET="0x89ed92fdb79e0f1ee6b753704b6fb5023ec8bb0e"
STANDALONE="0xc3A8865383Bd0Dcc15443522EEE247945E5e40e9"
DEADLINE=$(($(date +%s) + 7200))

echo "=== DIRECT WAGER TEST (no proxy) ==="
echo "Standalone Wager: $STANDALONE"

# Step 1: Initialize the standalone Wager
echo -e "\n--- Step 1: Initialize ---"
# initialize(address _playerA, uint256 _stakeAmount, address _marketAddress, uint256 _feeBps, address _feeRecipient, uint256 _joinDeadline)
cast send --rpc-url "$RPC" --private-key "$PK_A" --gas-limit 500000 "$STANDALONE" "initialize(address,uint256,address,uint256,address,uint256)" "$A_ADDR" "500000000000000000" "$MARKET" 250 "$A_ADDR" "$DEADLINE" 2>&1

echo "State:"
cast call --rpc-url "$RPC" "$STANDALONE" "state()"

# Step 2: A deposits via recordDeposit (only factory can call)
# But we can't call recordDeposit directly since msg.sender must be factory
# So let's use receive() instead... but wait, A's deposit is via factory
# Let's try a different approach: just have A and B both deposit via receive()

echo -e "\n--- Step 2: A Deposits via receive() ---"
cast send --rpc-url "$RPC" --private-key "$PK_A" --gas-limit 2500000 --value "0.5ether" --data "0x" "$STANDALONE" 2>&1
echo "A deposit:"
cast call --rpc-url "$RPC" "$STANDALONE" "deposits(address)" "$A_ADDR"

echo -e "\n--- Step 3: B Deposits via receive() ---"
cast send --rpc-url "$RPC" --private-key "$PK_B" --gas-limit 2500000 --value "0.5ether" --data "0x" "$STANDALONE" 2>&1
echo "B deposit:"
cast call --rpc-url "$RPC" "$STANDALONE" "deposits(address)" "$B_ADDR"

echo -e "\n--- Step 4: B Joins ---"
cast send --rpc-url "$RPC" --private-key "$PK_B" --gas-limit 500000 "$STANDALONE" "join()" 2>&1

echo -e "\n--- Final State ---"
echo "state():"
cast call --rpc-url "$RPC" "$STANDALONE" "state()"
echo "playerA():"
cast call --rpc-url "$RPC" "$STANDALONE" "playerA()"
echo "playerB():"
cast call --rpc-url "$RPC" "$STANDALONE" "playerB()"
echo "pot():"
cast call --rpc-url "$RPC" "$STANDALONE" "getPot()"
