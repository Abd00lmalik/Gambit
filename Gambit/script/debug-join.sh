#!/bin/bash
export PATH="/home/imaarm/.foundry/bin:$PATH"
RPC="https://api.infra.testnet.somnia.network"
PK_B="0x76d73b841d6b086cf98dda0f97588ec9f463472b6f016eae73f51b966be7aed7"
B_ADDR="0x0022EC010030158cC27B283BA640706eDBa6080f"

echo "=== Derive address from PK_B ==="
cast wallet address "$PK_B"

echo -e "\n=== Check balance of B ==="
cast balance --rpc-url "$RPC" "$B_ADDR"

echo -e "\n=== Try join with explicit sender via call ==="
CLONE="0xde6708b735c37a415c35f690ad3532aaea3999c8"
cast call --rpc-url "$RPC" --from "$B_ADDR" "$CLONE" "join()"

echo -e "\n=== Try join with send (non-dry) ==="
cast send --rpc-url "$RPC" --private-key "$PK_B" --gas-limit 500000 --gas-price 1gwei "$CLONE" "join()"
