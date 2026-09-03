#!/bin/bash
set -e
export PATH="/home/imaarm/.foundry/bin:$PATH"

RPC="https://api.infra.testnet.somnia.network"
PK="0xd9c246d4b642c0d95adf60a8a6e680352b996a9d139ca9f5d4fa1f545487095a"
PK_B="0x76d73b841d6b086cf98dda0f97588ec9f463472b6f016eae73f51b966be7aed7"
OUT="/mnt/c/Users/USER/head2head-testnet/Gambit/out"

echo "=== GAMBIT DEPLOYMENT ==="
echo ""

# 1a. Deploy Wager
echo "--- Step 1a: Deploy Wager Implementation ---"
WAGER_BC=$(python3 -c "
import json
bc = json.load(open('$OUT/Wager.sol/Wager.json'))['bytecode']['object']
print(bc if bc.startswith('0x') else '0x'+bc)
")

WAGER_RESULT=$(cast send --rpc-url "$RPC" --private-key "$PK" --gas-limit 10000000 --create "$WAGER_BC" --json)
WAGER_ADDR=$(echo "$WAGER_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['contractAddress'])")
WAGER_STATUS=$(echo "$WAGER_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")
WAGER_GAS=$(echo "$WAGER_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['gasUsed'])")
echo "Wager addr:    $WAGER_ADDR"
echo "Wager status:  $WAGER_STATUS"
echo "Wager gas:     $WAGER_GAS"

WAGER_CODE=$(cast code --rpc-url "$RPC" "$WAGER_ADDR")
echo "Wager code:    $((${#WAGER_CODE}-2)/2) bytes"

if [ "$WAGER_CODE" = "0x" ]; then
  echo "FATAL: Wager has no code!"
  exit 1
fi

echo ""
echo "=== SUCCESS ==="
