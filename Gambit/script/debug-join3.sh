#!/bin/bash
export PATH="/home/imaarm/.foundry/bin:$PATH"
RPC="https://api.infra.testnet.somnia.network"
CLONE="0xde6708b735c37a415c35f690ad3532aaea3999c8"
B_ADDR="0x0022EC010030158cC27B283BA640706eDBa6080f"

echo "=== deposits(B) via function call ==="
cast call --rpc-url "$RPC" "$CLONE" "deposits(address)" "$B_ADDR"

echo "=== deposits(A) via function call ==="
cast call --rpc-url "$RPC" "$CLONE" "deposits(address)" "0xF241F1A68878996aB1484f27099395c46796bC90"

echo "=== current block timestamp ==="
cast block --rpc-url "$RPC" latest

echo "=== joinDeadline ==="
cast call --rpc-url "$RPC" "$CLONE" "joinDeadline()"

echo "=== compute B deposit storage slot (keccak256) ==="
# deposits is slot 10. keccak256(abi.encode(key, 10))
# key = address B padded to 32 bytes (left-padded with zeros)
# slot = 10
python3 -c "
from eth_abi import encode
key = bytes.fromhex('0022EC010030158cC27B283BA640706eDBa6080f')
encoded = encode(['address', 'uint256'], [key.hex(), 10])
import hashlib
# Use pysha3 or manually
import subprocess
h = subprocess.check_output(['/home/imaarm/.foundry/bin/cast', 'keccak', '0x' + encoded.hex()])
print('storage slot:', h.decode().strip())
" 2>/dev/null || echo "eth_abi not available, trying alternative"

# Alternative: use cast abi-encode + cast keccak
SLOT_INPUT="0x$(printf '0000000000000000000000000022ec010030158cc27b283ba640706edba6080f' ; printf '%064x' 10)"
echo "SLOT_INPUT: $SLOT_INPUT"
STORAGE_SLOT=$(cast keccak "$SLOT_INPUT")
echo "Storage slot: $STORAGE_SLOT"
cast storage --rpc-url "$RPC" "$CLONE" "$STORAGE_SLOT"
