#!/bin/bash
# Check what market types exist and all markets
curl -s -X POST https://dev.smk.somnia.host/v1/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ Market(limit: 20, order_by: {createdAtTimestamp: desc}) { id marketAddress marketId marketType asset question strike intervalSec fundingIntervalSec expiry voided finalized clobStatus markPrice lastPrice indexPrice binaryPoolAddress venueId } }"}' 2>&1 | python3 -c "
import sys,json
d=json.load(sys.stdin)
markets = d.get('data',{}).get('Market',[])
print(f'Found {len(markets)} total markets')
for m in markets[:10]:
  print(json.dumps(m, indent=2))
  print('---')
" 2>&1

echo ""
echo "=== Market type counts ==="
curl -s -X POST https://dev.smk.somnia.host/v1/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ Market_aggregate { aggregate { count } group_by: [marketType] { marketType aggregate { count } } } }"}' 2>&1 | python3 -c "
import sys,json
d=json.load(sys.stdin)
groups = d.get('data',{}).get('Market_aggregate',{}).get('group_by',[])
for g in groups:
  print(f\"  {g['marketType']}: {g['aggregate']['count']}\")
" 2>&1
