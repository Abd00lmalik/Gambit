#!/bin/bash
# Query active (not finalized) BINARY markets
curl -s -X POST https://dev.smk.somnia.host/v1/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "{ Market(where: {marketType: {_eq: \"BINARY\"}, finalized: {_eq: false}, voided: {_eq: false}}, order_by: {createdAtTimestamp: desc}, limit: 30) { id marketAddress marketId asset question strike intervalSec expiry clobStatus binaryPoolAddress venueId } }"
  }' 2>&1 | python3 -c "
import sys,json
d=json.load(sys.stdin)
markets = d.get('data',{}).get('Market',[])
print(f'Found {len(markets)} active BINARY markets')
for m in markets:
  print(json.dumps(m, indent=2))
  print('---')
" 2>&1

echo ""
echo "=== Unique intervalSec values ==="
curl -s -X POST https://dev.smk.somnia.host/v1/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ Market(where: {marketType: {_eq: \"BINARY\"}}, order_by: {intervalSec: asc}, limit: 200) { intervalSec } }"}' 2>&1 | python3 -c "
import sys,json
d=json.load(sys.stdin)
markets = d.get('data',{}).get('Market',[])
intervals = {}
for m in markets:
  k = m['intervalSec']
  intervals[k] = intervals.get(k, 0) + 1
for k in sorted(intervals.keys(), key=lambda x: int(x)):
  print(f'  {k}s ({int(k)//60 if int(k)>=60 else k}min): {intervals[k]} markets')
" 2>&1
