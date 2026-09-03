#!/bin/bash
export PATH="/home/imaarm/.foundry/bin:$PATH"
RPC="https://api.infra.testnet.somnia.network"
PK_B="0x76d73b841d6b086cf98dda0f97588ec9f463472b6f016eae73f51b966be7aed7"
CLONE="0x2CC3d33F37bFadD5f3B8b131022609EE6Afa5e5b"
B_ADDR="0x0022EC010030158cC27B283BA640706eDBa6080f"

echo "=== Verify clone code (is it a proper proxy?) ==="
cast code --rpc-url "$RPC" "$CLONE"

echo -e "\n=== Verify implementation code size ==="
IMPL=$(cast call --rpc-url "$RPC" "0x3E106bA72C3AdB511076Cf849c4A70bb132Be395" "implementation()")
IMPL_ADDR="0x${IMPL: -40}"
echo "Implementation: $IMPL_ADDR"
IMPL_CODE=$(cast code --rpc-url "$RPC" "$IMPL_ADDR")
echo "Impl code length: $((${#IMPL_CODE}-2)) bytes"

echo -e "\n=== eth_call join with B as from (should succeed) ==="
JOIN_SEL=$(cast sig "join()")
echo "join() selector: $JOIN_SEL"
cast call --rpc-url "$RPC" --from "$B_ADDR" "$CLONE" "$JOIN_SEL" 2>&1
echo "exit: $?"

echo -e "\n=== Try send with join() selector raw ==="
cast send --rpc-url "$RPC" --private-key "$PK_B" --gas-limit 500000 "$CLONE" "$JOIN_SEL" 2>&1

echo -e "\n=== Check B balance ==="
cast balance --rpc-url "$RPC" "$B_ADDR"

echo -e "\n=== Check B nonce ==="
cast nonce --rpc-url "$RPC" "$B_ADDR"
