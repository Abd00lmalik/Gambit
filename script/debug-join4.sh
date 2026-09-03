#!/bin/bash
export PATH="/home/imaarm/.foundry/bin:$PATH"
RPC="https://api.infra.testnet.somnia.network"
CLONE="0xde6708b735c37a415c35f690ad3532aaea3999c8"
B_ADDR="0x0022EC010030158cC27B283BA640706eDBa6080f"
PK_B="0x76d73b841d6b086cf98dda0f97588ec9f463472b6f016eae73f51b966be7aed7"

echo "=== Debug eth_call join with B as sender ==="
# Try with --from B_ADDR
cast call --rpc-url "$RPC" --from "$B_ADDR" "$CLONE" "join()" 2>&1
echo "exit: $?"

echo -e "\n=== Debug eth_call join WITHOUT from (should fail) ==="
cast call --rpc-url "$RPC" "$CLONE" "join()" 2>&1
echo "exit: $?"

echo -e "\n=== encode join() selector ==="
cast sig "join()"

echo -e "\n=== Manual eth_call with from via curl ==="
curl -s -X POST "$RPC" \
  -H "Content-Type: application/json" \
  -d "{
    \"jsonrpc\":\"2.0\",
    \"method\":\"eth_call\",
    \"params\":[{
      \"to\":\"$CLONE\",
      \"data\":\"0x692ea1fc\",
      \"from\":\"$B_ADDR\"
    },\"latest\"],
    \"id\":1
  }" 2>&1

echo -e "\n"

echo "=== Also try with 2 more args: joinDeadline check ==="
# block.timestamp = 1788022132, joinDeadline = 0x6a931a23 = ?
python3 -c "print('joinDeadline:', 0x6a931a23); print('timestamp:', 1788022132); print('deadline > now:', 0x6a931a23 > 1788022132)"
