#!/bin/bash
PATH="$HOME/.foundry/bin:$PATH"
RPC="https://api.infra.testnet.somnia.network"
DEPLOYER="0xF241F1A68878996aB1484f27099395c46796bC90"

# The forge create output had nonce 0xf6 = 246. But the failed cast send also used nonce 246.
# On EVM, the failed tx consumes the nonce. So forge create at nonce 246 would fail with "nonce too low"
# unless the v4 deploy didn't actually consume the nonce (Somnia quirk).

# Let me just get the latest nonce and work from there
NONCE=$(cast nonce --rpc-url "$RPC" "$DEPLOYER" 2>&1)
echo "Current nonce: $NONCE"

BALANCE=$(cast balance --rpc-url "$RPC" "$DEPLOYER" --ether 2>&1)
echo "Balance: $BALANCE ETH"

# Try to trace the latest tx from deployer
LATEST_BLOCK=$(cast block-number --rpc-url "$RPC" 2>&1)
echo "Latest block: $LATEST_BLOCK"

# Search for DuelCreated events from both old and new factories
echo ""
echo "Checking old factory events..."
cast logs --rpc-url "$RPC" --address "0x3E106bA72C3AdB511076Cf849c4A70bb132Be395" --from-block "-100" --to-block "latest" --json 2>&1 | python3 -c "
import sys,json
try:
    data = json.load(sys.stdin)
    print(f'Old factory logs in last 100 blocks: {len(data)}')
except: print('No logs or parse error')
" 2>&1

# Try deploying with a simple approach - use forge create without JSON output
echo ""
echo "Attempting fresh deploy..."
RESULT=$(cd /mnt/c/Users/USER/head2head-testnet/Gambit && forge create \
  --rpc-url "$RPC" \
  --private-key "0xd9c246d4b642c0d95adf60a8a6e680352b996a9d139ca9f5d4fa1f545487095a" \
  "contracts/GambitFactory.sol:GambitFactory" \
  --constructor-args \
    "0x25265b9dbeb6c653b0ca281110bb0697a9685107" \
    250 \
    "100000000000000000" \
    "100000000000000000000" \
  2>&1)

echo "$RESULT"
echo "$RESULT" > /mnt/c/Users/USER/head2head-testnet/Gambit/deploy-v6.txt
