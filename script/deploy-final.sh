#!/bin/bash
PATH="$HOME/.foundry/bin:$PATH"
RPC="https://api.infra.testnet.somnia.network"

# The tx hash from forge create output - let me check receipt
TX="0x42c70570969423709ba7f1defdc2f6097758eb0a9138e75672330ef7ce9da9a5"
# Actually let me just get the last deployed contract address from the deploy-v4-raw.json
# Or better: let me re-run forge create and capture properly

# Check the last successful forge create
RESULT=$(cd /mnt/c/Users/USER/head2head-testnet/Gambit && forge create \
  --rpc-url "$RPC" \
  --private-key "0xd9c246d4b642c0d95adf60a8a6e680352b996a9d139ca9f5d4fa1f545487095a" \
  --json \
  "contracts/GambitFactory.sol:GambitFactory" \
  --constructor-args \
    "0x25265b9dbeb6c653b0ca281110bb0697a9685107" \
    250 \
    "100000000000000000" \
    "100000000000000000000" \
  2>&1)

echo "$RESULT" > /mnt/c/Users/USER/head2head-testnet/Gambit/deploy-final.json

python3 << 'PYEOF'
import json
with open("/mnt/c/Users/USER/head2head-testnet/Gambit/deploy-final.json") as f:
    d = json.load(f)
# forge create JSON output has "deployedTo" or we can check receipt
for key in d:
    if key not in ("abi", "transaction"):
        print(f"{key}: {d[key]}")
# Check transaction receipt for contract address
tx = d.get("transaction", {})
print("TX hash:", tx.get("hash", "?"))
PYEOF
