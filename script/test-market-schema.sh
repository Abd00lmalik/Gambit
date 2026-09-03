#!/bin/bash
# Get Market type fields
curl -s -X POST https://dev.smk.somnia.host/v1/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __type(name: \"Market\") { name fields { name type { name kind ofType { name kind } } } } }"}' 2>&1 | python3 -c "
import sys,json
d=json.load(sys.stdin)
fields = d.get('data',{}).get('__type',{}).get('fields',[])
for f in fields:
  t = f['type']
  tname = t.get('name') or (t.get('ofType',{}) or {}).get('name','?')
  print(f\"  {f['name']}: {tname}\")
" 2>&1
