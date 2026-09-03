#!/bin/bash
PATH="$HOME/.foundry/bin:$PATH"
RPC="https://api.infra.testnet.somnia.network"
DEPLOYER="0xF241F1A68878996aB1484f27099395c46796bC90"

# Get current nonce
NONCE=$(cast nonce --rpc-url "$RPC" "$DEPLOYER" 2>&1)
echo "Current nonce: $NONCE"

# The last deploy used nonce 0xf6 = 246. The new deploy will be at the next nonce.
# But we deployed twice (v4 failed at nonce 246, v5 succeeded at nonce 247)
# Actually v4 also used nonce 246 based on the result. Let me just try to find by computing addresses.

# Compute CREATE address for nonce 247 (0xf7)
ADDR_247=$(cast compute-address --rpc-url "$RPC" "$DEPLOYER" 247 2>&1)
echo "Nonce 247 address: $ADDR_247"

# Check if there's code at that address
ADDR_247_ONLY=$(echo "$ADDR_247" | grep -oP '0x[0-9a-fA-F]{40}')
CODE=$(cast code --rpc-url "$RPC" "$ADDR_247_ONLY" 2>&1)
echo "Code at nonce 247 addr: ${#CODE} chars"

# Try nonce 246 too
ADDR_246=$(cast compute-address --rpc-url "$RPC" "$DEPLOYER" 246 2>&1)
echo "Nonce 246 address: $ADDR_246"
ADDR_246_ONLY=$(echo "$ADDR_246" | grep -oP '0x[0-9a-fA-F]{40}')
CODE2=$(cast code --rpc-url "$RPC" "$ADDR_246_ONLY" 2>&1)
echo "Code at nonce 246 addr: ${#CODE2} chars"
