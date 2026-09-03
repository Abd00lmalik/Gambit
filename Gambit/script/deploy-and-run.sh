#!/bin/bash
set -e

RPC="https://api.infra.testnet.somnia.network"
PK="0xd9c246d4b642c0d95adf60a8a6e680352b996a9d139ca9f5d4fa1f545487095a"
PK_B="0x76d73b841d6b086cf98dda0f97588ec9f463472b6f016eae73f51b966be7aed7"
CAST="/home/imaarm/.foundry/bin/cast"
OUTDIR="/mnt/c/Users/USER/head2head-testnet/Gambit/out"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== GAMBIT DEPLOYMENT ==="

# 1a. Deploy Wager implementation
echo ""
echo "--- Step 1a: Deploy Wager Implementation ---"
WAGER_BC=$(cat "$OUTDIR/Wager.sol/Wager.json" | python3 -c "import sys,json; bc=json.load(sys.stdin)['bytecode']['object']; print(bc if bc.startswith('0x') else '0x'+bc)")
echo "Wager bytecode length: $((${#WAGER_BC}/2 - 1)) bytes"

WAGER_ADDR=$($CAST send --rpc-url "$RPC" --private-key "$PK" --gas-limit 10000000 --create "$WAGER_BC" | grep contractAddress | awk '{print $2}')
echo "Wager Implementation: $WAGER_ADDR"

WAGER_CODE=$($CAST code --rpc-url "$RPC" "$WAGER_ADDR")
echo "Wager code length: $((${#WAGER_CODE}/2 - 1)) bytes"

if [ "$WAGER_CODE" = "0x" ]; then
  echo "FATAL: Wager deployment failed"
  exit 1
fi

# 1b. Deploy GambitFactory
echo ""
echo "--- Step 1b: Deploy GambitFactory ---"
FACTORY_BC=$(cat "$OUTDIR/GambitFactory.sol/GambitFactory.json" | python3 -c "import sys,json; bc=json.load(sys.stdin)['bytecode']['object']; print(bc if bc.startswith('0x') else '0x'+bc)")

# Constructor args: (address feeRecipient, uint256 feeBps, uint256 minStake, uint256 maxStake, address impl)
ARGS=$($CAST abi-encode "constructor(address,uint256,uint256,uint256,address)" "0xF241F1A68878996aB1484f27099395c46796bC90" 250 100000000000000000 100000000000000000000 "$WAGER_ADDR")
ARGS_PADDED=$(echo "$ARGS" | sed 's/^0x//')
FACTORY_DEPLOY="${FACTORY_BC}${ARGS_PADDED}"

FACTORY_ADDR=$($CAST send --rpc-url "$RPC" --private-key "$PK" --gas-limit 15000000 --create "$FACTORY_DEPLOY" | grep contractAddress | awk '{print $2}')
echo "Factory: $FACTORY_ADDR"

FACTORY_CODE=$($CAST code --rpc-url "$RPC" "$FACTORY_ADDR")
echo "Factory code length: $((${#FACTORY_CODE}/2 - 1)) bytes"

if [ "$FACTORY_CODE" = "0x" ]; then
  echo "FATAL: Factory deployment failed"
  exit 1
fi

# 2. Verify factory
echo ""
echo "--- Step 2: Verify Factory ---"
echo "Implementation: $($CAST call --rpc-url "$RPC" "$FACTORY_ADDR" "implementation()(address)")"
echo "Fee Recipient:  $($CAST call --rpc-url "$RPC" "$FACTORY_ADDR" "feeRecipient()(address)")"
echo "Fee (bps):      $($CAST call --rpc-url "$RPC" "$FACTORY_ADDR" "defaultFeeBps()(uint256)")"
echo "Min Stake:      $($CAST call --rpc-url "$RPC" "$FACTORY_ADDR" "minStake()(uint256)")"
echo "Max Stake:      $($CAST call --rpc-url "$RPC" "$FACTORY_ADDR" "maxStake()(uint256)")"

# 3. Create duel
MARKET="0x89ed92fdb79e0f1ee6b753704b6fb5023ec8bb0e"
STAKE="500000000000000000"  # 0.5 STT
JOIN_DEADLINE=$(($(date +%s) + 3600))

echo ""
echo "--- Step 3: Create Duel ---"
CREATE_TX=$($CAST send --rpc-url "$RPC" --private-key "$PK" --gas-limit 1000000 --value 0.5ether "$FACTORY_ADDR" "createDuel(address,uint256)" "$MARKET" "$JOIN_DEADLINE" --json)
echo "$CREATE_TX" | python3 -c "import sys,json; d=json.load(sys.stdin); print('TX:', d['transactionHash']); print('Gas:', d['gasUsed'])"

# Extract clone address from logs
CLONE_ADDR=$(echo "$CREATE_TX" | python3 -c "
import sys, json
from eth_abi import decode
d = json.load(sys.stdin)
for log in d.get('logs', []):
    topics = log.get('topics', [])
    if len(topics) >= 2 and topics[0] == '0x3e4f4e32e994a032a328793821786422470e6b8e85cf40700e387359cf869978':
        addr = '0x' + topics[1][-40:]
        print(addr)
        break
")
echo "Clone: $CLONE_ADDR"

# 4. Player B deposits
echo ""
echo "--- Step 4: Player B Deposits ---"
DEPOSIT_TX=$($CAST send --rpc-url "$RPC" --private-key "$PK_B" --gas-limit 2500000 --value 0.5ether "$CLONE_ADDR" "" --json)
echo "$DEPOSIT_TX" | python3 -c "import sys,json; d=json.load(sys.stdin); print('TX:', d['transactionHash']); print('Gas:', d['gasUsed'])"

# 5. Player B joins
echo ""
echo "--- Step 5: Player B Joins ---"
JOIN_TX=$($CAST send --rpc-url "$RPC" --private-key "$PK_B" --gas-limit 300000 "$CLONE_ADDR" "join()" --json)
echo "$JOIN_TX" | python3 -c "import sys,json; d=json.load(sys.stdin); print('TX:', d['transactionHash']); print('Gas:', d['gasUsed'])"

# 6. Read state
echo ""
echo "--- Step 6: Read State ---"
STATE=$($CAST call --rpc-url "$RPC" "$CLONE_ADDR" "state()(uint8)")
case $STATE in
  0) STATE_STR="CREATED" ;;
  1) STATE_STR="LOCKED" ;;
  2) STATE_STR="SETTLED" ;;
  3) STATE_STR="REFUNDED" ;;
  4) STATE_STR="CANCELLED" ;;
  *) STATE_STR="UNKNOWN" ;;
esac
echo "State: $STATE_STR ($STATE)"
echo "Player A: $($CAST call --rpc-url "$RPC" "$CLONE_ADDR" "playerA()(address)")"
echo "Player B: $($CAST call --rpc-url "$RPC" "$CLONE_ADDR" "playerB()(address)")"
echo "Pot:      $($CAST call --rpc-url "$RPC" "$CLONE_ADDR" "getPot()(uint256)") wei"

echo ""
echo "=== DUEL LOCKED ==="
echo "Factory: $FACTORY_ADDR"
echo "Clone:   $CLONE_ADDR"
echo "To settle: wait for DreamDEX market to resolve, then call settle()"
