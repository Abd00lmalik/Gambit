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
  live market: 0xe186745b2d400d9a58d7a7e0e8451c78347568ec BTC expiry=1789046700 (4min away) q="BTC closes at or above its opening price"
    idx8=0x08c5913DF2d6D0c5847df9119D46E1903F45e993 idx9=0xBc78a9F3B7Dbe59e244f3Fb7968E4138209C4A2a
    market probe: {"addr":"0x08c5913DF2d6D0c5847df9119D46E1903F45e993","hasCode":true,"isResolved":true,"isVoided":false,"payoutNumerators":["10000000","0"],"status":4}
    pool probe:   {"addr":"0xBc78a9F3B7Dbe59e244f3Fb7968E4138209C4A2a","hasCode":true,"isResolved":"ERR: The contract function \"isResolved\" reverted.\n\nContract Call:\n  address:   0xBc78a9F3B7Dbe59e244f3Fb7968E4138209C4A2a\n  f","isVoided":"ERR: The contract function \"isVoided\" reverted.\n\nContract Call:\n  address:   0xBc78a9F3B7Dbe59e244f3Fb7968E4138209C4A2a\n  fun","payoutNumerators":"ERR: The contract function \"payoutNumerators\" reverted.\n\nContract Call:\n  address:   0xBc78a9F3B7Dbe59e244f3Fb7968E4138209C4A","status":"ERR: The contract function \"status\" reverted.\n\nContract Call:\n  address:   0xBc78a9F3B7Dbe59e244f3Fb7968E4138209C4A2a\n  funct"}
  live market: 0xa83a5569a8ecc4b8c366cac9fcdcd992d42c6ad4 ETH expiry=1789046700 (4min away) q="ETH closes at or above its opening price"
    idx8=0x7fFb55C73C7B777Fd0C09632CeAB1C417B0502e7 idx9=0xb35672B06dc098edEd7aabB531fD249108903d79
    market probe: {"addr":"0x7fFb55C73C7B777Fd0C09632CeAB1C417B0502e7","hasCode":true,"isResolved":true,"isVoided":false,"payoutNumerators":["10000000","0"],"status":4}
    pool probe:   {"addr":"0xb35672B06dc098edEd7aabB531fD249108903d79","hasCode":true,"isResolved":"ERR: The contract function \"isResolved\" reverted.\n\nContract Call:\n  address:   0xb35672B06dc098edEd7aabB531fD249108903d79\n  f","isVoided":"ERR: The contract function \"isVoided\" reverted.\n\nContract Call:\n  address:   0xb35672B06dc098edEd7aabB531fD249108903d79\n  fun","payoutNumerators":"ERR: The contract function \"payoutNumerators\" reverted.\n\nContract Call:\n  address:   0xb35672B06dc098edEd7aabB531fD249108903d","status":"ERR: The contract function \"status\" reverted.\n\nContract Call:\n  address:   0xb35672B06dc098edEd7aabB531fD249108903d79\n  funct"}
  live market: 0xd9d14fac6dd62cc9cd7eeb9cc21038d1abb6ec5f BTC expiry=1789047000 (9min away) q="BTC closes at or above its opening price"
    idx8=0x657D71b9f7bb030a693b4d9e6346d1CE12b08B78 idx9=0x484cCa142cAAC9561412EF86cFdF55E537268681
    market probe: {"addr":"0x657D71b9f7bb030a693b4d9e6346d1CE12b08B78","hasCode":true,"isResolved":true,"isVoided":false,"payoutNumerators":["10000000","0"],"status":4}
    pool probe:   {"addr":"0x484cCa142cAAC9561412EF86cFdF55E537268681","hasCode":true,"isResolved":"ERR: The contract function \"isResolved\" reverted.\n\nContract Call:\n  address:   0x484cCa142cAAC9561412EF86cFdF55E537268681\n  f","isVoided":"ERR: The contract function \"isVoided\" reverted.\n\nContract Call:\n  address:   0x484cCa142cAAC9561412EF86cFdF55E537268681\n  fun","payoutNumerators":"ERR: The contract function \"payoutNumerators\" reverted.\n\nContract Call:\n  address:   0x484cCa142cAAC9561412EF86cFdF55E5372686","status":"ERR: The contract function \"status\" reverted.\n\nContract Call:\n  address:   0x484cCa142cAAC9561412EF86cFdF55E537268681\n  funct"}
  live market: 0xf18e23e4b8da266c8812ca90750956511314507d ETH expiry=1789047000 (9min away) q="ETH closes at or above its opening price"
    idx8=0xfA7179013CF55d8f7890032e2f908091EAC348Ca idx9=0x717037745287AB0FebE343b46b03fB99d516A49A
    market probe: {"addr":"0xfA7179013CF55d8f7890032e2f908091EAC348Ca","hasCode":true,"isResolved":true,"isVoided":false,"payoutNumerators":["0","10000000"],"status":4}
    pool probe:   {"addr":"0x717037745287AB0FebE343b46b03fB99d516A49A","hasCode":true,"isResolved":"ERR: The contract function \"isResolved\" reverted.\n\nContract Call:\n  address:   0x717037745287AB0FebE343b46b03fB99d516A49A\n  f","isVoided":"ERR: The contract function \"isVoided\" reverted.\n\nContract Call:\n  address:   0x717037745287AB0FebE343b46b03fB99d516A49A\n  fun","payoutNumerators":"ERR: The contract function \"payoutNumerators\" reverted.\n\nContract Call:\n  address:   0x717037745287AB0FebE343b46b03fB99d516A4","status":"ERR: The contract function \"status\" reverted.\n\nContract Call:\n  address:   0x717037745287AB0FebE343b46b03fB99d516A49A\n  funct"}
  live market: 0xeec56fc701d668e8d05bdaf8689ab44037633405 BTC expiry=1789048800 (39min away) q="BTC closes at or above its opening price"
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
