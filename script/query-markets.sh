#!/bin/bash
# Query active binary markets from DreamDEX GraphQL
curl -s -X POST https://dev.smk.somnia.host/v1/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "{ Market(where: {marketType: {_eq: \"binary\"}, finalized: {_eq: false}, voided: {_eq: false}}, order_by: {createdAtTimestamp: desc}, limit: 20) { id marketAddress marketId asset question strike intervalSec fundingIntervalSec expiry status: clobStatus markPrice lastPrice indexPrice outcomeSlotCount yesTokenId noTokenId binaryPoolAddress oracleQuestion venueId } }"
  }' 2>&1 | python3 -c "
import sys,json
d=json.load(sys.stdin)
markets = d.get('data',{}).get('Market',[])
print(f'Found {len(markets)} binary markets')
for m in markets[:10]:
  print(json.dumps(m, indent=2))
  print('---')
" 2>&1
