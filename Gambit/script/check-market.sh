#!/bin/bash
export PATH="/home/imaarm/.foundry/bin:$PATH"
RPC="https://api.infra.testnet.somnia.network"

echo "Market resolved:"
cast call --rpc-url "$RPC" 0x89ed92fdb79e0f1ee6b753704b6fb5023ec8bb0e "isResolved()(bool)" 2>&1

echo "Market voided:"
cast call --rpc-url "$RPC" 0x89ed92fdb79e0f1ee6b753704b6fb5023ec8bb0e "isVoided()(bool)" 2>&1
