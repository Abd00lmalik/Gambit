#!/usr/bin/bash
# Test GraphQL schema introspection
curl -s -X POST https://dev.smk.somnia.host/v1/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __schema { queryType { name } types { name kind } } }"}' 2>&1 | python3 -c "
import sys,json
try:
  d=json.load(sys.stdin)
  types = d.get('data',{}).get('__schema',{}).get('types',[])
  for t in types:
    if not t['name'].startswith('__'):
      print(f\"  {t['kind']}: {t['name']}\")
except Exception as e:
  print(f'Parse error: {e}')
  print(sys.stdin.read())
" 2>&1
