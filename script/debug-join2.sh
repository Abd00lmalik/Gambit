#!/bin/bash
export PATH="/home/imaarm/.foundry/bin:$PATH"
RPC="https://api.infra.testnet.somnia.network"
CLONE="0xde6708b735c37a415c35f690ad3532aaea3999c8"
IMPL="0x5090dD57479030a7d7F5EB4d4d11Ba31ba9bA885"
B_ADDR="0x0022EC010030158cC27B283BA640706eDBa6080f"

echo "=== Implementation contract ==="
cast code --rpc-url "$RPC" "$IMPL" | wc -c

echo -e "\n=== Clone code ==="
cast code --rpc-url "$RPC" "$CLONE"

echo -e "\n=== Check _initialized ==="
# _initialized is storage slot after all declared vars
# factory(0) owner(1) playerA(2) playerB(3) stakeAmount(4) marketAddress(5) feeBps(6) feeRecipient(7) joinDeadline(8) state(9) deposits(10) _initialized(11)
cast storage --rpc-url "$RPC" "$CLONE" 11

echo -e "\n=== Check current block timestamp ==="
cast block --rpc-url "$RPC" "latest" "timestamp"

echo -e "\n=== joinDeadline ==="
cast call --rpc-url "$RPC" "$CLONE" "joinDeadline()"

echo -e "\n=== Check deposits mapping slot ==="
# deposits is at slot 10. mapping(address => uint256) uses keccak256(key . slot)
# For address B at slot 10:
python3 -c "
import hashlib
addr = bytes.fromhex('0022EC010030158cC27B283BA640706eDBa6080f')
slot = (10).to_bytes(32, 'big')
key = addr.rjust(32, b'\x00')
h = hashlib.sha3_256(key + slot).digest()  # actually keccak, not sha3
print('slot:', h.hex())
"
# Use cast to compute keccak
KECCAK_SLOT=$(cast keccak "$(printf '0000000000000000000000000022ec010030158cc27b283ba640706edba6080f000000000000000000000000000000000000000000000000000000000000000a')")
echo "keccak(deposits(B)):"
echo "$KECCAK_SLOT"
cast storage --rpc-url "$RPC" "$CLONE" "$KECCAK_SLOT"

echo -e "\n=== Try eth_call join ==="
cast call --rpc-url "$RPC" --from "$B_ADDR" --gas-limit 500000 "$CLONE" "join()"
echo "exit code: $?"
