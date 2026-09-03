#!/bin/bash
set -e
export PATH="/home/imaarm/.foundry/bin:$PATH"

RPC="https://api.infra.testnet.somnia.network"
PK="0xd9c246d4b642c0d95adf60a8a6e680352b996a9d139ca9f5d4fa1f545487095a"
OUT="/mnt/c/Users/USER/head2head-testnet/Gambit/out"

echo "=== Deploy Wager ==="

WAGER_BC=$(python3 -c "
import json
bc = json.load(open('$OUT/Wager.sol/Wager.json'))['bytecode']['object']
print(bc if bc.startswith('0x') else '0x'+bc)
")
echo "Bytecode: $((${#WAGER_BC}/2-1)) bytes"

RESULT=$(cast send --rpc-url "$RPC" --private-key "$PK" --gas-limit 10000000 --create "$WAGER_BC" --json 2>&1)
echo "$RESULT" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print('Status:', d.get('status'))
print('Contract:', d.get('contractAddress'))
print('Gas Used:', d.get('gasUsed'))
"

ADDR=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['contractAddress'])")
CODE=$(cast code --rpc-url "$RPC" "$ADDR")
echo "Code length: $((${#CODE}/2-1)) bytes"
