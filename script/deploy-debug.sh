#!/bin/bash
set -e
export PATH="/home/imaarm/.foundry/bin:$PATH"

RPC="https://api.infra.testnet.somnia.network"
PK="0xd9c246d4b642c0d95adf60a8a6e680352b996a9d139ca9f5d4fa1f545487095a"
OUT="/mnt/c/Users/USER/head2head-testnet/Gambit/out"

echo "=== Debug: Deploy test contracts ==="
echo ""

# Test 1: Factory with dummy impl (already works - just verify code exists)
FACTORY_BC=$(python3 -c "
import json
bc = json.load(open('$OUT/GambitFactory.sol/GambitFactory.json'))['bytecode']['object']
print(bc if bc.startswith('0x') else '0x'+bc)
")
ARGS=$(cast abi-encode "constructor(address,uint256,uint256,uint256,address)" \
  "0xF241F1A68878996aB1484f27099395c46796bC90" 250 100000000000000000 100000000000000000000 \
  "0x0000000000000000000000000000000000000001")
FACTORY_FULL="${FACTORY_BC}${ARGS:2}"
FACTORY_RESULT=$(cast send --rpc-url "$RPC" --private-key "$PK" --gas-limit 15000000 --create "$FACTORY_FULL" --json)
FACTORY_ADDR=$(echo "$FACTORY_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['contractAddress'])")
FACTORY_STATUS=$(echo "$FACTORY_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")
FACTORY_CODE=$(cast code --rpc-url "$RPC" "$FACTORY_ADDR")
FACTORY_CODE_LEN=$(echo "$FACTORY_CODE" | wc -c)
echo "Factory: status=$FACTORY_STATUS addr=$FACTORY_ADDR code_len=$((FACTORY_CODE_LEN - 3))"

# Test 2: Deploy a contract that has receive() + a mapping + require
SIMPLE_BC="0x608060405234801561000f575f5ffd5b5060043610610034575f3560e01c8063b69ef9a814610038575f5ffd5b366100345761003261004e565b005b5f5ffd5b335f90815260016020526040902055565b6101008061005c5f395ff3fe608060405260043610610029575f3560e01c8063b69ef9a81461002d575f5ffd5b366100295761002761004e565b005b5f5ffd5b335f90815260016020526040902055565b335f80546001600160a01b0319166001600160a01b0392909216919091179055600880546001600160a01b0319166001600160a01b0392909216919091179055fea165627a7a72305820"
echo ""
echo "Test: Simple receive+mapping contract"
SIMPLE_RESULT=$(cast send --rpc-url "$RPC" --private-key "$PK" --gas-limit 2000000 --create "$SIMPLE_BC" --json)
SIMPLE_ADDR=$(echo "$SIMPLE_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['contractAddress'])")
SIMPLE_STATUS=$(echo "$SIMPLE_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")
SIMPLE_CODE=$(cast code --rpc-url "$RPC" "$SIMPLE_ADDR")
SIMPLE_CODE_LEN=$(echo "$SIMPLE_CODE" | wc -c)
echo "Simple: status=$SIMPLE_STATUS addr=$SIMPLE_ADDR code_len=$((SIMPLE_CODE_LEN - 3))"

# Test 3: Deploy Wager
echo ""
echo "Test: Wager contract"
WAGER_BC=$(python3 -c "
import json
bc = json.load(open('$OUT/Wager.sol/Wager.json'))['bytecode']['object']
print(bc if bc.startswith('0x') else '0x'+bc)
")
WAGER_RESULT=$(cast send --rpc-url "$RPC" --private-key "$PK" --gas-limit 10000000 --create "$WAGER_BC" --json)
WAGER_ADDR=$(echo "$WAGER_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['contractAddress'])")
WAGER_STATUS=$(echo "$WAGER_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")
WAGER_GAS=$(echo "$WAGER_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['gasUsed'])")
WAGER_CODE=$(cast code --rpc-url "$RPC" "$WAGER_ADDR")
WAGER_CODE_LEN=$(echo "$WAGER_CODE" | wc -c)
echo "Wager: status=$WAGER_STATUS gas=$WAGER_GAS addr=$WAGER_ADDR code_len=$((WAGER_CODE_LEN - 3))"

# Check if Wager has internal function selectors
echo ""
echo "Wager bytecode first 200 chars:"
echo "$WAGER_BC" | head -c 200
echo ""

# Check: does Wager use EXTCODECOPY or EXTCODESIZE? 
echo ""
echo "Checking Wager bytecode for DELEGATECALL (0xf4):"
echo "$WAGER_BC" | grep -o "f4" | wc -l
echo "Checking for STATICCALL (0xfa):"  
echo "$WAGER_BC" | grep -o "fa" | wc -l
