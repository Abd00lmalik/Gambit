#!/bin/bash
# Try broader candle queries and find markets with non-null prices
curl -s -X POST https://dev.smk.somnia.host/v1/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ Candle(limit: 3, order_by: {bucketStart: desc}) { id marketAddress openPrice closePrice high low intervalSeconds bucketStart } }"}' 2>&1 | python3 -c "
import sys,json
d=json.load(sys.stdin)
candles = d.get('data',{}).get('Candle',[])
print(f'Found {len(candles)} candles')
for c in candles:
  print(json.dumps(c, indent=2))
" 2>&1

echo ""
echo "=== Find markets with non-null indexPrice ==="
curl -s -X POST https://dev.smk.somnia.host/v1/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ Market(where: {indexPrice: {_is_null: false}}, order_by: {createdAtTimestamp: desc}, limit: 5) { marketAddress asset indexPrice strike intervalSec expiry clobStatus venueId } }"}' 2>&1 | python3 -c "
import sys,json
d=json.load(sys.stdin)
markets = d.get('data',{}).get('Market',[])
print(f'Found {len(markets)} markets with indexPrice')
for m in markets:
  print(json.dumps(m, indent=2))
" 2>&1

echo ""
echo "=== Try the Venue table to find our venue's market filtering ==="
curl -s -X POST https://dev.smk.somnia.host/v1/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ Venue(limit: 10, order_by: {id: asc}) { id name venueAddress isActive } }"}' 2>&1 | python3 -c "
import sys,json
d=json.load(sys.stdin)
venues = d.get('data',{}).get('Venue',[])
for v in venues:
  print(json.dumps(v, indent=2))
" 2>&1
