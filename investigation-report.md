#### SECTION 1: DUEL CLONE STATE
{
  "duel": "0xe0ab413d485c80256dc46a07ba483bb85850fbf5",
  "playerA": "0x7e0Af9e55184b2b4bd5bac455493c035d51eee3E",
  "playerB": "0x73092e88D49946ac32b6Eb1a394f81bb553e411a",
  "state": 1,
  "stake": "2.5",
  "pot": "5",
  "rawMarketAddress": "0x54a734bE8139B0b7F77680c8bc080FC74CEfbB65",
  "resolvedMarketContract": "0x61Dd6bd8C15D6Df32F9C8Beb62400e9e2a76D116",
  "marketId": "0x0000000000000000000000000000000000000000000000000000000000003f13",
  "joinDeadline": 1789036140,
  "joinDeadlineISO": "2026-09-10T10:29:00.000Z"
}
#### SECTION 2: MARKET RECORD
{
  "market": "0x61Dd6bd8C15D6Df32F9C8Beb62400e9e2a76D116",
  "pool": "0xBc38935791a003196830e43c8632a498DBd76849",
  "yesId": "5074428074767954125771170482365384602496373928421973350325020516155648",
  "noId": "5074428074767954125771170482365384602496373928421973350325020516155649",
  "tradingStart": 1786468500,
  "tradingStartISO": "2026-08-11T17:15:00.000Z",
  "expiry": 1786469400,
  "expiryISO": "2026-08-11T17:30:00.000Z"
}
#### SECTION 3: RESOLUTION STATE (final, on-chain)
market(idx8): {
  "addr": "0x61Dd6bd8C15D6Df32F9C8Beb62400e9e2a76D116",
  "hasCode": true,
  "isResolved": true,
  "isVoided": false,
  "payoutNumerators": [
    "10000000",
    "0"
  ],
  "status": 4
}
pool(idx9):   {
  "addr": "0xBc38935791a003196830e43c8632a498DBd76849",
  "hasCode": true,
  "isResolved": "ERR: The contract function \"isResolved\" reverted.\n\nContract Call:\n  address:   0xBc38935791a003196830e43c8632a498DBd76849\n  f",
  "isVoided": "ERR: The contract function \"isVoided\" reverted.\n\nContract Call:\n  address:   0xBc38935791a003196830e43c8632a498DBd76849\n  fun",
  "payoutNumerators": "ERR: The contract function \"payoutNumerators\" reverted.\n\nContract Call:\n  address:   0xBc38935791a003196830e43c8632a498DBd768",
  "status": "ERR: The contract function \"status\" reverted.\n\nContract Call:\n  address:   0xBc38935791a003196830e43c8632a498DBd76849\n  funct"
}
raw duel.marketAddress: {
  "addr": "0x54a734bE8139B0b7F77680c8bc080FC74CEfbB65",
  "hasCode": false
}
#### SECTION 4: LIVE-MARKET PAYOUT PROBE (markets that have NOT expired yet)
Indexer https://prd.smk.somnia.host/v1/graphql: 5 live markets
  live market: 0xb8359f074cf03b87b448a1e9040e65bc158ada39 BTC expiry=1789047600 (4min away) q="BTC closes at or above its opening price"
    idx8=0xB07bA55Cc1062c24Ec526C3D64D18B5a9749F90D idx9=0x0EfCa71f8C66DB8e85fED0Ffa8E2DD0FC45B908F
    market probe: {"addr":"0xB07bA55Cc1062c24Ec526C3D64D18B5a9749F90D","hasCode":true,"isResolved":true,"isVoided":false,"payoutNumerators":["10000000","0"],"status":4}
    pool probe:   {"addr":"0x0EfCa71f8C66DB8e85fED0Ffa8E2DD0FC45B908F","hasCode":true,"isResolved":"ERR: The contract function \"isResolved\" reverted.\n\nContract Call:\n  address:   0x0EfCa71f8C66DB8e85fED0Ffa8E2DD0FC45B908F\n  f","isVoided":"ERR: The contract function \"isVoided\" reverted.\n\nContract Call:\n  address:   0x0EfCa71f8C66DB8e85fED0Ffa8E2DD0FC45B908F\n  fun","payoutNumerators":"ERR: The contract function \"payoutNumerators\" reverted.\n\nContract Call:\n  address:   0x0EfCa71f8C66DB8e85fED0Ffa8E2DD0FC45B90","status":"ERR: The contract function \"status\" reverted.\n\nContract Call:\n  address:   0x0EfCa71f8C66DB8e85fED0Ffa8E2DD0FC45B908F\n  funct"}
  live market: 0xb752fa61b5a2cf9ec62c6810dc31270f252bdc40 ETH expiry=1789047600 (4min away) q="ETH closes at or above its opening price"
    idx8=0x4D0834c1b7E852c6A8805C418Beffd1FC1ed30D5 idx9=0xb4d6cbD78444dDAAAB94A22A141365bff89B0Cfd
    market probe: {"addr":"0x4D0834c1b7E852c6A8805C418Beffd1FC1ed30D5","hasCode":true,"isResolved":true,"isVoided":false,"payoutNumerators":["0","10000000"],"status":4}
    pool probe:   {"addr":"0xb4d6cbD78444dDAAAB94A22A141365bff89B0Cfd","hasCode":true,"isResolved":"ERR: The contract function \"isResolved\" reverted.\n\nContract Call:\n  address:   0xb4d6cbD78444dDAAAB94A22A141365bff89B0Cfd\n  f","isVoided":"ERR: The contract function \"isVoided\" reverted.\n\nContract Call:\n  address:   0xb4d6cbD78444dDAAAB94A22A141365bff89B0Cfd\n  fun","payoutNumerators":"ERR: The contract function \"payoutNumerators\" reverted.\n\nContract Call:\n  address:   0xb4d6cbD78444dDAAAB94A22A141365bff89B0C","status":"ERR: The contract function \"status\" reverted.\n\nContract Call:\n  address:   0xb4d6cbD78444dDAAAB94A22A141365bff89B0Cfd\n  funct"}
  live market: 0x87bc7b699634f59ad97b59001b2902703b2f89f3 BTC expiry=1789047900 (9min away) q="BTC closes at or above its opening price"
    idx8=0xcF12cFfEC4564A41Ac1218b703b61a1F0F6f2e25 idx9=0x9657A0950C43d94Dd5c813A16F9D12cb831946F1
    market probe: {"addr":"0xcF12cFfEC4564A41Ac1218b703b61a1F0F6f2e25","hasCode":true,"isResolved":true,"isVoided":false,"payoutNumerators":["10000000","0"],"status":4}
    pool probe:   {"addr":"0x9657A0950C43d94Dd5c813A16F9D12cb831946F1","hasCode":true,"isResolved":"ERR: The contract function \"isResolved\" reverted.\n\nContract Call:\n  address:   0x9657A0950C43d94Dd5c813A16F9D12cb831946F1\n  f","isVoided":"ERR: The contract function \"isVoided\" reverted.\n\nContract Call:\n  address:   0x9657A0950C43d94Dd5c813A16F9D12cb831946F1\n  fun","payoutNumerators":"ERR: The contract function \"payoutNumerators\" reverted.\n\nContract Call:\n  address:   0x9657A0950C43d94Dd5c813A16F9D12cb831946","status":"ERR: The contract function \"status\" reverted.\n\nContract Call:\n  address:   0x9657A0950C43d94Dd5c813A16F9D12cb831946F1\n  funct"}
  live market: 0x2ce4a2d9e6937a3d41f60a3a0c2042aada1e51de ETH expiry=1789047900 (9min away) q="ETH closes at or above its opening price"
    idx8=0xc9CaD9C8770EF13C9Cd83ec9F2f7da3197CC7254 idx9=0x30288E5d2808c7E8541B60aeE178eD3d4f2De061
    market probe: {"addr":"0xc9CaD9C8770EF13C9Cd83ec9F2f7da3197CC7254","hasCode":true,"isResolved":true,"isVoided":false,"payoutNumerators":["0","10000000"],"status":4}
    pool probe:   {"addr":"0x30288E5d2808c7E8541B60aeE178eD3d4f2De061","hasCode":true,"isResolved":"ERR: The contract function \"isResolved\" reverted.\n\nContract Call:\n  address:   0x30288E5d2808c7E8541B60aeE178eD3d4f2De061\n  f","isVoided":"ERR: The contract function \"isVoided\" reverted.\n\nContract Call:\n  address:   0x30288E5d2808c7E8541B60aeE178eD3d4f2De061\n  fun","payoutNumerators":"ERR: The contract function \"payoutNumerators\" reverted.\n\nContract Call:\n  address:   0x30288E5d2808c7E8541B60aeE178eD3d4f2De0","status":"ERR: The contract function \"status\" reverted.\n\nContract Call:\n  address:   0x30288E5d2808c7E8541B60aeE178eD3d4f2De061\n  funct"}
  live market: 0xeec56fc701d668e8d05bdaf8689ab44037633405 BTC expiry=1789048800 (24min away) q="BTC closes at or above its opening price"
    idx8=0x12cD1Ff5f425468dB46A527a109FaDb7e0175359 idx9=0x56275310dA4e7991CAc79B7CEdcb034Aba51f897
    market probe: {"addr":"0x12cD1Ff5f425468dB46A527a109FaDb7e0175359","hasCode":true,"isResolved":true,"isVoided":false,"payoutNumerators":["0","10000000"],"status":4}
    pool probe:   {"addr":"0x56275310dA4e7991CAc79B7CEdcb034Aba51f897","hasCode":true,"isResolved":"ERR: The contract function \"isResolved\" reverted.\n\nContract Call:\n  address:   0x56275310dA4e7991CAc79B7CEdcb034Aba51f897\n  f","isVoided":"ERR: The contract function \"isVoided\" reverted.\n\nContract Call:\n  address:   0x56275310dA4e7991CAc79B7CEdcb034Aba51f897\n  fun","payoutNumerators":"ERR: The contract function \"payoutNumerators\" reverted.\n\nContract Call:\n  address:   0x56275310dA4e7991CAc79B7CEdcb034Aba51f8","status":"ERR: The contract function \"status\" reverted.\n\nContract Call:\n  address:   0x56275310dA4e7991CAc79B7CEdcb034Aba51f897\n  funct"}
#### SECTION 5: DREAMDEX INDEXER DATA (final resolved outcome)
Indexer https://prd.smk.somnia.host/v1/graphql: {
  "data": {
    "Market": [
      {
        "id": "0x0000000000000000000000000000000000000000000000000000000000003f13",
        "marketAddress": "0x54a734be8139b0b7f77680c8bc080fc74cefbb65",
        "marketId": "0x0000000000000000000000000000000000000000000000000000000000003f13",
        "asset": "BTC",
        "question": "BTC closes at or above its opening price",
        "strike": "0",
        "indexPrice": null,
        "intervalSec": "900",
        "expiry": "1789036200",
        "tradingStart": "1789035300",
        "clobStatus": "Finalized",
        "oracleQuestionId": "56312",
        "binaryPoolAddress": "0xe72e628a56d48f11cf37fbedb47ef11a40721bc1"
      }
    ]
  }
}
OracleAnswer: {
  "errors": [
    {
      "message": "field 'value' not found in type: 'OracleAnswer'",
      "extensions": {
        "path": "$.selectionSet.OracleAnswer.selectionSet.value",
        "code": "validation-failed"
      }
    }
  ]
}
MarketReferenceLink: {
  "data": {
    "MarketReferenceLink": [
      {
        "referenceQuestionId": "56301"
      }
    ]
  }
}
OracleAnswer_by_pk: {
  "errors": [
    {
      "message": "field 'value' not found in type: 'OracleAnswer'",
      "extensions": {
        "path": "$.selectionSet.OracleAnswer_by_pk.selectionSet.value",
        "code": "validation-failed"
      }
    }
  ]
}
#### SECTION 6: PRICE FEED AT EXPIRY vs STRIKE
BTC price at expiry: {
  "data": {
    "PricePoint": []
  }
}
ETH price at expiry: {
  "data": {
    "PricePoint": []
  }
}
#### SECTION 7: CLONE TX HISTORY (explorer API)
[
  {
    "hash": "0x51f633c26882ba254cf634668f095ea0db061f554593d2ca7bb4eb3622464af1",
    "from": "0x73092e88D49946ac32b6Eb1a394f81bb553e411a",
    "to": "0xe0ab413D485c80256dc46A07Ba483bB85850fbF5",
    "value": "0",
    "method": "join",
    "status": "ok",
    "timestamp": "2026-09-10T10:26:20.000000Z",
    "block": 484627461,
    "result": "success",
    "revert_reason": null,
    "decoded_input": [
      "method_call",
      "method_id",
      "parameters"
    ]
  },
  {
    "hash": "0x1010706c0c8a84a0233127f7758e270d7feab63996f12e85bb4ac87f7103d0f0",
    "from": "0x73092e88D49946ac32b6Eb1a394f81bb553e411a",
    "to": "0xe0ab413D485c80256dc46A07Ba483bB85850fbF5",
    "value": "2500000000000000000",
    "method": null,
    "status": "ok",
    "timestamp": "2026-09-10T10:26:10.000000Z",
    "block": 484627362,
    "result": "success",
    "revert_reason": null
  }
]
INTERNAL TXNS: [
  {
    "from": "0x089079B21dD6A495D4c3f6844ABCab806fcf5d9E",
    "to": "0xe0ab413D485c80256dc46A07Ba483bB85850fbF5",
    "value": "2500000000000000000",
    "type": "call",
    "block": 484627030
  },
  {
    "from": "0xe0ab413D485c80256dc46A07Ba483bB85850fbF5",
    "to": "0xdF87AC5C4760e2F1Dd78e054ce0629A26A4cA5cA",
    "value": "0",
    "type": "delegatecall",
    "block": 484627030
  },
  {
    "from": "0xe0ab413D485c80256dc46A07Ba483bB85850fbF5",
    "to": "0x3ecC694Cef705358864a646142ac17A90E29e388",
    "value": "0",
    "type": "staticcall",
    "block": 484627030
  },
  {
    "from": "0x089079B21dD6A495D4c3f6844ABCab806fcf5d9E",
    "to": "0xe0ab413D485c80256dc46A07Ba483bB85850fbF5",
    "value": "0",
    "type": "call",
    "block": 484627030
  },
  {
    "from": "0x089079B21dD6A495D4c3f6844ABCab806fcf5d9E",
    "to": "0xe0ab413D485c80256dc46A07Ba483bB85850fbF5",
    "value": "0",
    "type": "create",
    "block": 484627030
  }
]
#### INVESTIGATION COMPLETE
