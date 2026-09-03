#!/bin/bash
# Get Candle type fields
curl -s -X POST https://dev.smk.somnia.host/v1/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __type(name: \"Candle\") { name fields { name type { name kind ofType { name kind } } } } }"}' 2>&1 | python3 -c "
import sys,json
d=json.load(sys.stdin)
fields = d.get('data',{}).get('__type',{}).get('fields',[])
for f in fields:
  t = f['type']
  tname = t.get('name') or (t.get('ofType',{}) or {}).get('name','?')
  print(f\"  {f['name']}: {tname}\")
" 2>&1

echo ""
echo "=== Recent candles for venue 0x6797... (our venue) ==="
curl -s -X POST https://dev.smk.somnia.host/v1/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ Candle(limit: 5, order_by: {timestamp: desc}, where: {marketAddress: {_eq: \"0x6266312c7fd24a89b9ec2be114b6d1faabb85411\"}}) { id marketAddress timestamp open high low close volume interval } }"}' 2>&1 | python3 -c "
import sys,json
d=json.load(sys.stdin)
candles = d.get('data',{}).get('Candle',[])
print(f'Found {len(candles)} candles')
for c in candles:
  print(json.dumps(c, indent=2))
" 2>&1

echo ""
echo "=== Try indexPrice on market with venue 0x6797 ==="
curl -s -X POST https://dev.smk.somnia.host/v1/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ Market(where: {venueId: {_eq: \"0x679795a0195a1b76cdebb7c51d74e058aee92919b8c3389af86ef24535e8a28c\"}, finalized: {_eq: false}}, order_by: {createdAtTimestamp: desc}, limit: 3) { marketAddress asset question indexPrice markPrice lastPrice strike intervalSec expiry clobStatus } }"}' 2>&1 | python3 -c "
import sys,json
d=json.load(sys.stdin)
markets = d.get('data',{}).get('Market',[])
for m in markets:
  print(json.dumps(m, indent=2))
" 2>&1
