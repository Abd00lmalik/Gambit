#!/bin/bash
set -e
export PATH="/home/imaarm/.foundry/bin:$PATH"
RPC="https://api.infra.testnet.somnia.network"
PK="0xd9c246d4b642c0d95adf60a8a6e680352b996a9d139ca9f5d4fa1f545487095a"
OUT="/mnt/c/Users/USER/head2head-testnet/Gambit/out"

echo "=== Deploy MinimalWager ==="
BC=$(python3 -c "
import json
bc = json.load(open('$OUT/MinimalWager.sol/MinimalWager.json'))['bytecode']['object']
print(bc if bc.startswith('0x') else '0x'+bc)
")
echo "Bytes: $((${#BC}/2-1))"
RESULT=$(cast send --rpc-url "$RPC" --private-key "$PK" --gas-limit 5000000 --create "$BC" --json)
echo "$RESULT" | python3 -c "
import sys,json
d = json.load(sys.stdin)
print('Status:', d['status'])
print('Contract:', d['contractAddress'])
print('Gas:', d['gasUsed'])
"
ADDR=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['contractAddress'])")
CODE=$(cast code --rpc-url "$RPC" "$ADDR")
echo "Code: $((${#CODE}-2)) bytes"
