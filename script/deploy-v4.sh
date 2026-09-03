#!/bin/bash
PATH="$HOME/.foundry/bin:$PATH"

RPC="https://api.infra.testnet.somnia.network"
PK="0xd9c246d4b642c0d95adf60a8a6e680352b996a9d139ca9f5d4fa1f545487095a"
LOG="/mnt/c/Users/USER/head2head-testnet/Gambit/deploy-v4-result.txt"

echo "=== DEPLOY V4 ===" > "$LOG"

# Extract bytecode (already has 0x prefix)
FACTORY_BC=$(python3 -c "
import json
bc = json.load(open('/mnt/c/Users/USER/head2head-testnet/Gambit/out/GambitFactory.sol/GambitFactory.json'))['bytecode']['object']
if not bc.startswith('0x'): bc = '0x' + bc
print(bc[2:])
" 2>/dev/null)
echo "BC hex length (no prefix): ${#FACTORY_BC}" >> "$LOG"

# ABI-encode constructor args (strip 0x prefix too)
CTOR_HEX=$(cast abi-encode "constructor(address,uint256,uint256,uint256)" \
  "0x25265b9dbeb6c653b0ca281110bb0697a9685107" \
  "250" \
  "100000000000000000" \
  "100000000000000000000" | sed 's/^0x//')
echo "CTOR hex length (no prefix): ${#CTOR_HEX}" >> "$LOG"

# Combine with single 0x prefix
DEPLOY_DATA="0x${FACTORY_BC}${CTOR_HEX}"
echo "Total deploy data length: ${#DEPLOY_DATA}" >> "$LOG"

# Deploy
echo "Deploying..." >> "$LOG"
RESULT=$(cast send --rpc-url "$RPC" --private-key "$PK" --gas-limit 20000000 --create "$DEPLOY_DATA" --json 2>&1)
echo "$RESULT" > /mnt/c/Users/USER/head2head-testnet/Gambit/deploy-v4-raw.json

python3 << 'PYEOF' >> "$LOG"
import sys, json
try:
    with open("/mnt/c/Users/USER/head2head-testnet/Gambit/deploy-v4-raw.json") as f:
        d = json.load(f)
    if "errors" in d:
        print("ERRORS:", d["errors"])
    print("Status:", d.get("status", "?"))
    print("Contract:", d.get("contractAddress", "?"))
    print("Tx:", d.get("transactionHash", "?"))
    print("Gas:", d.get("gasUsed", "?"))
except Exception as e:
    print("Parse error:", e)
PYEOF
