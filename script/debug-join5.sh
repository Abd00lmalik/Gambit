#!/bin/bash
export PATH="/home/imaarm/.foundry/bin:$PATH"
RPC="https://api.infra.testnet.somnia.network"
CLONE="0xde6708b735c37a415c35f690ad3532aaea3999c8"
B_ADDR="0x0022EC010030158cC27B283BA640706eDBa6080f"
PK_B="0x76d73b841d6b086cf98dda0f97588ec9f463472b6f016eae73f51b966be7aed7"

echo "=== Correct join() selector ==="
cast sig "join()"

echo "=== State still CREATED? ==="
cast call --rpc-url "$RPC" "$CLONE" "state()"

echo "=== Deposits still there? ==="
cast call --rpc-url "$RPC" "$CLONE" "deposits(address)" "$B_ADDR"

echo "=== Balance ==="
cast balance --rpc-url "$RPC" "$CLONE"

echo -e "\n=== Try join via raw calldata ==="
# Use correct selector from cast sig
JOIN_SELECTOR=$(cast sig "join()")
echo "Selector: $JOIN_SELECTOR"

echo "=== Try raw curl with correct selector ==="
curl -s -X POST "$RPC" \
  -H "Content-Type: application/json" \
  -d "{
    \"jsonrpc\":\"2.0\",
    \"method\":\"eth_call\",
    \"params\":[{
      \"to\":\"$CLONE\",
      \"data\":\"$JOIN_SELECTOR\",
      \"from\":\"$B_ADDR\"
    },\"latest\"],
    \"id\":1
  }" 2>&1

echo -e "\n=== Try send again ==="
cast send --rpc-url "$RPC" --private-key "$PK_B" --gas-limit 500000 "$CLONE" "join()" 2>&1
