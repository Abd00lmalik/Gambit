#!/bin/bash
export PATH="/home/imaarm/.foundry/bin:$PATH"
RPC="https://api.infra.testnet.somnia.network"
PK_A="0xd9c246d4b642c0d95adf60a8a6e680352b996a9d139ca9f5d4fa1f545487095a"
CLONE="0x3b363E245a77CaC440B5997558E7787464C84172"
MARKET="0x89ed92fdb79e0f1ee6b753704b6fb5023ec8bb0e"
FEE_RECIPIENT="0xF241F1A68878996aB1484f27099395c46796bC90"
PLAYER_A="0xF241F1A68878996aB1484f27099395c46796bC90"

echo "=== SETTLE FLOW ==="

echo "Current state:"
cast call --rpc-url "$RPC" "$CLONE" "state()"
cast call --rpc-url "$RPC" "$CLONE" "playerA()"
cast call --rpc-url "$RPC" "$CLONE" "playerB()"
cast call --rpc-url "$RPC" "$CLONE" "getPot()"

echo -e "\n--- Check market resolution ---"
echo "isResolved():"
cast call --rpc-url "$RPC" "$MARKET" "isResolved()"
echo "isVoided():"
cast call --rpc-url "$RPC" "$MARKET" "isVoided()"
echo "payoutNumerators(0):"
cast call --rpc-url "$RPC" "$MARKET" "payoutNumerators(uint8)" 0
echo "payoutNumerators(1):"
cast call --rpc-url "$RPC" "$MARKET" "payoutNumerators(uint8)" 1

echo -e "\n--- Check A balance before settle ---"
cast balance --rpc-url "$RPC" "$PLAYER_A"
echo "--- Check fee recipient balance before settle ---"
cast balance --rpc-url "$RPC" "$FEE_RECIPIENT"

echo -e "\n--- Settle (anyone can call) ---"
# Anyone can settle - use A's key
cast send --rpc-url "$RPC" --private-key "$PK_A" --gas-limit 5000000 "$CLONE" "settle()" 2>&1

echo -e "\n--- State after settle ---"
cast call --rpc-url "$RPC" "$CLONE" "state()"
cast call --rpc-url "$RPC" "$CLONE" "getPot()"

echo -e "\n--- Check A balance after settle ---"
cast balance --rpc-url "$RPC" "$PLAYER_A"
echo "--- Check fee recipient balance after settle ---"
cast balance --rpc-url "$RPC" "$FEE_RECIPIENT"
