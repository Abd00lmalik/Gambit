#!/bin/bash
PATH="$HOME/.foundry/bin:$PATH"

RPC="https://api.infra.testnet.somnia.network"
PK="0xd9c246d4b642c0d95adf60a8a6e680352b996a9d139ca9f5d4fa1f545487095a"
PROJ="/mnt/c/Users/USER/head2head-testnet/Gambit"
LOG="$PROJ/deploy-v5-result.txt"

echo "=== DEPLOY V5 ===" > "$LOG"

RESULT=$(cd "$PROJ" && forge create \
  --rpc-url "$RPC" \
  --private-key "$PK" \
  --json \
  "contracts/GambitFactory.sol:GambitFactory" \
  --constructor-args \
    "0x25265b9dbeb6c653b0ca281110bb0697a9685107" \
    250 \
    "100000000000000000" \
    "100000000000000000000" \
  2>&1)

echo "$RESULT" >> "$LOG"
