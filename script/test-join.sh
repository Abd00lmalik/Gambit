#!/bin/bash
export PATH="/home/imaarm/.foundry/bin:$PATH"
RPC="https://api.infra.testnet.somnia.network"
CLONE="0xde6708b735c37a415c35f690ad3532aaea3999c8"
B_ADDR="0x0022EC010030158cC27B283BA640706eDBa6080f"
PK_B="0x76d73b841d6b086cf98dda0f97588ec9f463472b6f016eae73f51b966be7aed7"

echo "--- Check B deposit ---"
cast call --rpc-url "$RPC" "$CLONE" "deposits(address)" "$B_ADDR"

echo -e "\n--- Player B joins ---"
cast send --rpc-url "$RPC" --private-key "$PK_B" --gas-limit 500000 "$CLONE" "join()"

echo -e "\n--- Check state ---"
cast call --rpc-url "$RPC" "$CLONE" "state()"
cast call --rpc-url "$RPC" "$CLONE" "getPot()"
cast call --rpc-url "$RPC" "$CLONE" "playerA()"
cast call --rpc-url "$RPC" "$CLONE" "playerB()"
