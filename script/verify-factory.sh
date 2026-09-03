#!/bin/bash
PATH="$HOME/.foundry/bin:$PATH"
RPC="https://api.infra.testnet.somnia.network"
FACTORY="0x3E106bA72C3AdB511076Cf849c4A70bb132Be395"

echo "=== Factory Verification ==="
echo "feeRecipient: $(cast call --rpc-url "$RPC" "$FACTORY" "feeRecipient()(address)" 2>&1)"
echo "defaultFeeBps: $(cast call --rpc-url "$RPC" "$FACTORY" "defaultFeeBps()(uint256)" 2>&1)"
echo "minStake: $(cast call --rpc-url "$RPC" "$FACTORY" "minStake()(uint256)" 2>&1)"
echo "maxStake: $(cast call --rpc-url "$RPC" "$FACTORY" "maxStake()(uint256)" 2>&1)"
echo "implementation: $(cast call --rpc-url "$RPC" "$FACTORY" "implementation()(address)" 2>&1)"
