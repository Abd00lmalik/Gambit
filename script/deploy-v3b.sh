#!/bin/bash
PATH="$HOME/.foundry/bin:$PATH"

RPC="https://api.infra.testnet.somnia.network"
PK="0xd9c246d4b642c0d95adf60a8a6e680352b996a9d139ca9f5d4fa1f545487095a"
OUT="/mnt/c/Users/USER/head2head-testnet/Gambit/out"
LOG="/mnt/c/Users/USER/head2head-testnet/Gambit/deploy-v3-result.txt"

# Step 1: Extract bytecode via python
echo "Extracting bytecode..." > "$LOG"
FACTORY_BC=$(python3 << 'PYEOF'
import json
bc = json.load(open("/mnt/c/Users/USER/head2head-testnet/Gambit/out/GambitFactory.sol/GambitFactory.json"))["bytecode"]["object"]
if not bc.startswith("0x"):
    bc = "0x" + bc
print(bc)
PYEOF
)
echo "Bytecode length: ${#FACTORY_BC}" >> "$LOG"

# Step 2: ABI-encode constructor args
echo "Encoding constructor args..." >> "$LOG"
CTOR_ARGS=$(cast abi-encode "constructor(address,uint256,uint256,uint256)" \
  "0x25265b9dbeb6c653b0ca281110bb0697a9685107" \
  "250" \
  "100000000000000000" \
  "100000000000000000000")
echo "CTOR_ARGS: $CTOR_ARGS" >> "$LOG"

# Step 3: Deploy
echo "Sending deploy tx..." >> "$LOG"
DEPLOY_DATA="${FACTORY_BC}${CTOR_ARGS}"
echo "Deploy data length: ${#DEPLOY_DATA}" >> "$LOG"

RESULT=$(cast send --rpc-url "$RPC" --private-key "$PK" --gas-limit 20000000 --create "$DEPLOY_DATA" --json 2>&1 || echo "CAST_FAILED")
echo "$RESULT" > /mnt/c/Users/USER/head2head-testnet/Gambit/deploy-v3-raw.json
echo "Raw result saved" >> "$LOG"

echo "$RESULT" | python3 << 'PYEOF2' >> "$LOG"
import sys, json
try:
    d = json.load(sys.stdin)
    print("Status:", d.get("status", "?"))
    print("Contract:", d.get("contractAddress", "?"))
    print("Tx:", d.get("transactionHash", "?"))
    print("Gas:", d.get("gasUsed", "?"))
except Exception as e:
    print("Parse error:", e)
    print(sys.stdin.read() if hasattr(sys.stdin, 'read') else "no input")
PYEOF2
