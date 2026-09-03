#!/bin/bash
set -e
export PATH="/home/imaarm/.foundry/bin:$PATH"

RPC="https://api.infra.testnet.somnia.network"
PK="0xd9c246d4b642c0d95adf60a8a6e680352b996a9d139ca9f5d4fa1f545487095a"

echo "=== Size limit test (fixed offset) ==="

# Runtime: PUSH1 0 PUSH1 0 RETURN (returns 0 bytes)
RUNTIME="60006000f3"
RUNTIME_BYTES=$((${#RUNTIME} / 2))

# The creation code layout:
# PREFIX (16 bytes) + PUSH2 SIZE (3 bytes) + DUP1 (1 byte) + PUSH2 OFFSET (3 bytes) + PUSH1 0 (2 bytes) + CODECOPY (1 byte) + PUSH1 0 (2 bytes) + RETURN (1 byte) + RUNTIME
# Total header = 16 + 3 + 1 + 3 + 2 + 1 + 2 + 1 = 29 bytes
HEADER_BYTES=29
PREFIX="6080604052348015600f575f5ffd5b50"

for RUNTIME_PAD in 500 1000 2000 3000 4000 5000; do
  # Pad runtime with STOP opcodes
  PADDING=$(printf '00%.0s' $(seq 1 $RUNTIME_PAD))
  ACTUAL_RUNTIME="${RUNTIME}${PADDING}"
  ACTUAL_RUNTIME_BYTES=$((${#ACTUAL_RUNTIME} / 2))
  TOTAL_BYTES=$((HEADER_BYTES + ACTUAL_RUNTIME_BYTES))
  
  CODE_OFFSET_HEX=$(printf '%04x' $HEADER_BYTES)
  SIZE_HEX=$(printf '%04x' $ACTUAL_RUNTIME_BYTES)
  
  FULL_BC="0x${PREFIX}61${SIZE_HEX}8061${CODE_OFFSET_HEX}6000396000f3${ACTUAL_RUNTIME}"
  
  echo -n "Runtime=${ACTUAL_RUNTIME_BYTES}b Total=${TOTAL_BYTES}b: "
  
  RESULT=$(cast send --rpc-url "$RPC" --private-key "$PK" --gas-limit 20000000 --create "$FULL_BC" --json 2>&1)
  STATUS=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])" 2>/dev/null || echo "ERR")
  ADDR=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['contractAddress'])" 2>/dev/null || echo "none")
  CODE=$(cast code --rpc-url "$RPC" "$ADDR" 2>/dev/null || echo "0x")
  CODE_LEN=$((${#CODE} - 2))
  echo "status=$STATUS code_len=$CODE_LEN"
done
