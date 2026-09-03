#!/bin/bash
export PATH="/home/imaarm/.foundry/bin:$PATH"
RPC="https://api.infra.testnet.somnia.network"

echo "=== Trace failed join tx ==="
TX_HASH="0x21e60d51e0a6f560bf459c6dbde0a15bdc47a9bcabb5d051cf8a496ad040193c"

# Try debug_traceTransaction
curl -s -X POST "$RPC" \
  -H "Content-Type: application/json" \
  -d "{
    \"jsonrpc\":\"2.0\",
    \"method\":\"debug_traceTransaction\",
    \"params\":[\"$TX_HASH\", {\"tracer\": \"callTracer\"}],
    \"id\":1
  }" 2>&1 | python3 -m json.tool 2>/dev/null || echo "debug_traceTransaction not available"

echo -e "\n=== Try trace_replayTransaction ==="
curl -s -X POST "$RPC" \
  -H "Content-Type: application/json" \
  -d "{
    \"jsonrpc\":\"2.0\",
    \"method\":\"trace_replayTransaction\",
    \"params\":[\"$TX_HASH\", [\"trace\", \"stateDiff\"]],
    \"id\":1
  }" 2>&1 | python3 -m json.tool 2>/dev/null || echo "trace_replayTransaction not available"

echo -e "\n=== Get full receipt ==="
cast receipt --rpc-url "$RPC" "$TX_HASH" 2>&1
