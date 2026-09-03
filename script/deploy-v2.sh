#!/bin/bash
set -e
export PATH="$HOME/.foundry/bin:$PATH"

RPC="https://api.infra.testnet.somnia.network"
PK="0xd9c246d4b642c0d95adf60a8a6e680352b996a9d139ca9f5d4fa1f545487095a"
OUT="/mnt/c/Users/USER/head2head-testnet/Gambit/out"

echo "=== GAMBIT V2 DEPLOYMENT ==="
echo "New fee recipient: 0x25265b9dbeb6c653b0ca281110bb0697a9685107"

# Read bytecode
FACTORY_BC=$(python3 -c "
import json
bc = json.load(open('$OUT/GambitFactory.sol/GambitFactory.json'))['bytecode']['object']
print(bc if bc.startswith('0x') else '0x'+bc)
")
echo "Factory bytecode: $((${#FACTORY_BC}/2-1)) bytes"

# ABI-encode constructor args:
#   address _feeRecipient = 0x25265b9dbeb6c653b0ca281110bb0697a9685107
#   uint256 _defaultFeeBps = 250
#   uint256 _minStake = 0.1 ether (100000000000000000)
#   uint256 _maxStake = 100 ether (100000000000000000000)
CTOR_ARGS=$(cast abi-encode "constructor(address,uint256,uint256,uint256)" "0x25265b9dbeb6c653b0ca281110bb0697a9685107" 250 100000000000000000 100000000000000000000)
echo "Constructor args: $CTOR_ARGS"
echo "Full deploy data: ${FACTORY_BC}${CTOR_ARGS}"

# Deploy with constructor args appended
echo ""
echo "--- Deploying GambitFactory ---"
RESULT=$(cast send --rpc-url "$RPC" --private-key "$PK" --gas-limit 20000000 --create "${FACTORY_BC}${CTOR_ARGS}" --json 2>&1)
echo "$RESULT" > /mnt/c/Users/USER/head2head-testnet/Gambit/deploy-result.json

FACTORY_ADDR=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['contractAddress'])")
STATUS=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")
TX=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['transactionHash'])")
GAS=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['gasUsed'])")

echo "Factory address: $FACTORY_ADDR"
echo "Status:          $STATUS"
echo "Tx hash:         $TX"
echo "Gas used:        $GAS"

if [ "$STATUS" != "0x1" ]; then
  echo "FATAL: Deployment failed!"
  exit 1
fi

# Verify implementation
echo ""
echo "--- Verifying ---"
IMPL=$(cast call --rpc-url "$RPC" "$FACTORY_ADDR" "implementation()(address)")
echo "Implementation: $IMPL"

FEE=$(cast call --rpc-url "$RPC" "$FACTORY_ADDR" "feeRecipient()(address)")
echo "Fee recipient:  $FEE"

FEE_BPS=$(cast call --rpc-url "$RPC" "$FACTORY_ADDR" "defaultFeeBps()(uint256)")
echo "Fee (bps):      $FEE_BPS"

MIN=$(cast call --rpc-url "$RPC" "$FACTORY_ADDR" "minStake()(uint256)")
echo "Min stake:      $MIN"

MAX=$(cast call --rpc-url "$RPC" "$FACTORY_ADDR" "maxStake()(uint256)")
echo "Max stake:      $MAX"

# Quick smoke test: create a duel
echo ""
echo "--- Smoke test: createDuel ---"
MARKET="0x89ed92fdb79e0f1ee6b753704b6fb5023ec8bb0e"
DEADLINE=$(($(date +%s) + 7200))
TX2=$(cast send --rpc-url "$RPC" --private-key "$PK" --gas-limit 5000000 --value "0.5ether" "$FACTORY_ADDR" "createDuel(address,uint256)" "$MARKET" "$DEADLINE" --json 2>&1)
echo "$TX2" > /mnt/c/Users/USER/head2head-testnet/Gambit/smoke-result.json

CLONE=$(echo "$TX2" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for log in d.get('logs',[]):
    t=log.get('topics',[])
    if len(t)>=2:
        print('0x'+t[1][-40:])
        break
" 2>/dev/null)
echo "Clone address: $CLONE"

echo ""
echo "=== DEPLOYMENT COMPLETE ==="
echo "NEW_FACTORY=$FACTORY_ADDR"
echo "NEW_IMPL=$IMPL"
echo "NEW_TX=$TX"
