#!/bin/bash
export PATH="/home/imaarm/.foundry/bin:$PATH"
RPC="https://api.infra.testnet.somnia.network"

echo "=== Chain ID ==="
cast chain-id --rpc-url "$RPC" 2>&1

echo ""
echo "=== Deploy TX receipt ==="
cast receipt --rpc-url "$RPC" 0xe83514e2473c06d82ba1995d139f7380468005705f38d69ba844e52990a34140 2>&1 | head -8

echo ""
echo "=== Block number ==="
cast block-number --rpc-url "$RPC" 2>&1
