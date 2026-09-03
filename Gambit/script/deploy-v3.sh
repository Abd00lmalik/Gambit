#!/bin/bash
set -e
PATH="$HOME/.foundry/bin:$PATH"

RPC="https://api.infra.testnet.somnia.network"
PK="0xd9c246d4b642c0d95adf60a8a6e680352b996a9d139ca9f5d4fa1f545487095a"
OUT="/mnt/c/Users/USER/head2head-testnet/Gambit/out"
LOG="/mnt/c/Users/USER/head2head-testnet/Gambit/deploy-v3-result.txt"

echo "=== GAMBIT V3 DEPLOYMENT ===" > "$LOG"
echo "New fee recipient: 0x25265b9dbeb6c653b0ca281110bb0697a9685107" >> "$LOG"

# Read bytecode
FACTORY_BC=$(python3 -c "
import json
bc = json.load(open('$OUT/GambitFactory.sol/GambitFactory.json'))['bytecode']['object']
print(bc if bc.startswith('0x') else '0x'+bc)
")
echo "Bytecode length: $((${#FACTORY_BC}/2-1)) bytes" >> "$LOG"

# ABI-encode constructor args
CTOR_ARGS=$(cast abi-encode "constructor(address,uint256,uint256,uint256)" \
  "0x25265b9dbeb6c653b0ca281110bb0697a9685107" \
  250 \
  100000000000000000 \
  100000000000000000000)
echo "Constructor args: $CTOR_ARGS" >> "$LOG"

# Deploy
echo "Deploying..." >> "$LOG"
RESULT=$(cast send --rpc-url "$RPC" --private-key "$PK" --gas-limit 20000000 \
  --create "${FACTORY_BC}${CTOR_ARGS}" --json 2>&1)
echo "$RESULT" > /mnt/c/Users/USER/head2head-testnet/Gambit/deploy-v3-raw.json

FACTORY_ADDR=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['contractAddress'])")
STATUS=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")
TX=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['transactionHash'])")
GAS=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['gasUsed'])")

echo "" >> "$LOG"
echo "--- Deploy Result ---" >> "$LOG"
echo "Factory: $FACTORY_ADDR" >> "$LOG"
echo "Status:  $STATUS" >> "$LOG"
echo "Tx:      $TX" >> "$LOG"
echo "Gas:     $GAS" >> "$LOG"

if [ "$STATUS" != "0x1" ]; then
  echo "FATAL: Deployment failed!" >> "$LOG"
  exit 1
fi

# Verify
echo "" >> "$LOG"
echo "--- Verify ---" >> "$LOG"
IMPL=$(cast call --rpc-url "$RPC" "$FACTORY_ADDR" "implementation()(address)")
echo "Implementation: $IMPL" >> "$LOG"
FEE=$(cast call --rpc-url "$RPC" "$FACTORY_ADDR" "feeRecipient()(address)")
echo "Fee recipient:  $FEE" >> "$LOG"
FEE_BPS=$(cast call --rpc-url "$RPC" "$FACTORY_ADDR" "defaultFeeBps()(uint256)")
echo "Fee (bps):      $FEE_BPS" >> "$LOG"

# Smoke test: create duel
echo "" >> "$LOG"
echo "--- Smoke Test: createDuel ---" >> "$LOG"
MARKET="0x89ed92fdb79e0f1ee6b753704b6fb5023ec8bb0e"
DEADLINE=$(($(date +%s) + 7200))
SMOKE_TX=$(cast send --rpc-url "$RPC" --private-key "$PK" --gas-limit 5000000 \
  --value "0.5ether" "$FACTORY_ADDR" "createDuel(address,uint256)" "$MARKET" "$DEADLINE" --json 2>&1)
echo "$SMOKE_TX" > /mnt/c/Users/USER/head2head-testnet/Gambit/smoke-v3.json

CLONE=$(echo "$SMOKE_TX" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print('Status:', d.get('status','?'))
for log in d.get('logs',[]):
    t=log.get('topics',[])
    if len(t)>=2:
        print('0x'+t[1][-40:])
        break
" 2>&1)
echo "Smoke result:" >> "$LOG"
echo "$CLONE" >> "$LOG"

echo "" >> "$LOG"
echo "=== DEPLOYMENT COMPLETE ===" >> "$LOG"
echo "FACTORY=$FACTORY_ADDR" >> "$LOG"
echo "IMPL=$IMPL" >> "$LOG"
echo "TX=$TX" >> "$LOG"
