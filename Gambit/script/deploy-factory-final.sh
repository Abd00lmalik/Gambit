#!/bin/bash
set -e
export PATH="/home/imaarm/.foundry/bin:$PATH"

RPC="https://api.infra.testnet.somnia.network"
PK="0xd9c246d4b642c0d95adf60a8a6e680352b996a9d139ca9f5d4fa1f545487095a"
PK_B="0x76d73b841d6b086cf98dda0f97588ec9f463472b6f016eae73f51b966be7aed7"
OUT="/mnt/c/Users/USER/head2head-testnet/Gambit/out"

echo "=== GAMBIT DEPLOYMENT ==="

# Deploy factory with inline Wager
echo ""
echo "--- Deploy GambitFactory (with new Wager()) ---"
FACTORY_BC=$(python3 -c "
import json
bc = json.load(open('$OUT/GambitFactory.sol/GambitFactory.json'))['bytecode']['object']
print(bc if bc.startswith('0x') else '0x'+bc)
")
echo "Factory bytecode: $((${#FACTORY_BC}/2-1)) bytes"

FACTORY_RESULT=$(cast send --rpc-url "$RPC" --private-key "$PK" --gas-limit 20000000 --create "$FACTORY_BC" --json)
FACTORY_ADDR=$(echo "$FACTORY_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['contractAddress'])")
FACTORY_STATUS=$(echo "$FACTORY_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")
FACTORY_GAS=$(echo "$FACTORY_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['gasUsed'])")
echo "Factory addr:   $FACTORY_ADDR"
echo "Factory status: $FACTORY_STATUS"
echo "Factory gas:    $FACTORY_GAS"

FACTORY_CODE=$(cast code --rpc-url "$RPC" "$FACTORY_ADDR")
echo "Factory code:   $((${#FACTORY_CODE}-2)) bytes"

if [ "$FACTORY_STATUS" != "0x1" ]; then
  echo "FATAL: Factory deployment failed!"
  exit 1
fi

# Verify
echo ""
echo "--- Verify Factory ---"
IMPL=$(cast call --rpc-url "$RPC" "$FACTORY_ADDR" "implementation()(address)")
echo "Implementation: $IMPL"
IMPL_CODE=$(cast code --rpc-url "$RPC" "$IMPL")
echo "Impl code:      $((${#IMPL_CODE}-2)) bytes"

FEE=$(cast call --rpc-url "$RPC" "$FACTORY_ADDR" "feeRecipient()(address)")
echo "Fee Recipient:  $FEE"
FEE_BPS=$(cast call --rpc-url "$RPC" "$FACTORY_ADDR" "defaultFeeBps()(uint256)")
echo "Fee (bps):      $FEE_BPS"

echo ""
echo "=== SUCCESS ==="
