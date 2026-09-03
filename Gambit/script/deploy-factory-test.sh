#!/bin/bash
set -e
export PATH="/home/imaarm/.foundry/bin:$PATH"

RPC="https://api.infra.testnet.somnia.network"
PK="0xd9c246d4b642c0d95adf60a8a6e680352b996a9d139ca9f5d4fa1f545487095a"
OUT="/mnt/c/Users/USER/head2head-testnet/Gambit/out"

echo "=== Deploy GambitFactory directly ==="
echo ""

# Get factory bytecode
FACTORY_BC=$(python3 -c "
import json
bc = json.load(open('$OUT/GambitFactory.sol/GambitFactory.json'))['bytecode']['object']
print(bc if bc.startswith('0x') else '0x'+bc)
")

# Get constructor args
ARGS=$(cast abi-encode "constructor(address,uint256,uint256,uint256,address)" \
  "0xF241F1A68878996aB1484f27099395c46796bC90" \
  250 \
  100000000000000000 \
  100000000000000000000 \
  "0x0000000000000000000000000000000000000001")

FULL="${FACTORY_BC}${ARGS:2}"
echo "Deploy data: $((${#FULL}/2-1)) bytes"

FACTORY_RESULT=$(cast send --rpc-url "$RPC" --private-key "$PK" --gas-limit 15000000 --create "$FULL" --json)
FACTORY_ADDR=$(echo "$FACTORY_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['contractAddress'])")
FACTORY_STATUS=$(echo "$FACTORY_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")
FACTORY_GAS=$(echo "$FACTORY_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['gasUsed'])")
echo "Factory addr:   $FACTORY_ADDR"
echo "Factory status: $FACTORY_STATUS"
echo "Factory gas:    $FACTORY_GAS"

FACTORY_CODE=$(cast code --rpc-url "$RPC" "$FACTORY_ADDR")
echo "Factory code:   $((${#FACTORY_CODE}-2)/2) bytes"

# Also try a minimal contract
echo ""
echo "=== Deploy minimal receive contract ==="
MINIMAL_BC="0x6080604052348015600e575f5ffd5b5060405134156018575f5ffd5b50603f8060265f395ff3fe6080604052348015600e575f5ffd5b50600843106016575f5ffd5b56fea2646970667358221220"
MINIMAL_RESULT=$(cast send --rpc-url "$RPC" --private-key "$PK" --gas-limit 1000000 --create "$MINIMAL_BC" --json)
MINIMAL_ADDR=$(echo "$MINIMAL_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['contractAddress'])")
MINIMAL_STATUS=$(echo "$MINIMAL_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")
echo "Minimal addr:   $MINIMAL_ADDR"
echo "Minimal status: $MINIMAL_STATUS"
MINIMAL_CODE=$(cast code --rpc-url "$RPC" "$MINIMAL_ADDR")
echo "Minimal code:   $((${#MINIMAL_CODE}-2)/2) bytes"
