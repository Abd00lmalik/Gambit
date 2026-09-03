#!/bin/bash
PATH="$HOME/.foundry/bin:$PATH"

RPC="https://api.infra.testnet.somnia.network"
PK="0xd9c246d4b642c0d95adf60a8a6e680352b996a9d139ca9f5d4fa1f545487095a"
LOG="/mnt/c/Users/USER/head2head-testnet/Gambit/deploy-v5-result.txt"

echo "=== DEPLOY V5 ===" > "$LOG"

# Try with forge create instead
echo "Using forge create..." >> "$LOG"
RESULT=$(forge create \
  --rpc-url "$RPC" \
  --private-key "$PK" \
  --json \
  /mnt/c/Users/USER/head2head-testnet/Gambit/out/GambitFactory.sol/GambitFactory.json \
  --constructor-args \
    "0x25265b9dbeb6c653b0ca281110bb0697a9685107" \
    250 \
    100000000000000000 \
    100000000000000000000 \
  2>&1)

echo "$RESULT" >> "$LOG"
echo "EXIT: $?" >> "$LOG"
