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
  live market: 0xc6efe17a0eb62320fcf5e33e1747d69532157c04 BTC expiry=1789068600 (1min away) q="BTC closes at or above its opening price"
    idx8=0xA4B6949de1F8a0455B3d1C7CbeA1AD856c20a2Ee idx9=0x2295b1a161d84cfa9518b6397B7597358138EF89
    market probe: {"addr":"0xA4B6949de1F8a0455B3d1C7CbeA1AD856c20a2Ee","hasCode":true,"isResolved":true,"isVoided":false,"payoutNumerators":["10000000","0"],"status":4}
    pool probe:   {"addr":"0x2295b1a161d84cfa9518b6397B7597358138EF89","hasCode":true,"isResolved":"ERR: The contract function \"isResolved\" reverted.\n\nContract Call:\n  address:   0x2295b1a161d84cfa9518b6397B7597358138EF89\n  f","isVoided":"ERR: The contract function \"isVoided\" reverted.\n\nContract Call:\n  address:   0x2295b1a161d84cfa9518b6397B7597358138EF89\n  fun","payoutNumerators":"ERR: The contract function \"payoutNumerators\" reverted.\n\nContract Call:\n  address:   0x2295b1a161d84cfa9518b6397B7597358138EF","status":"ERR: The contract function \"status\" reverted.\n\nContract Call:\n  address:   0x2295b1a161d84cfa9518b6397B7597358138EF89\n  funct"}
  live market: 0x158295e7907dfc78f66fcab0f502b4622c5fdd1e BTC expiry=1789068600 (1min away) q="BTC closes at or above its opening price"
    idx8=0x34B605AF64469B06e2441c66e9ad3ABf7e675333 idx9=0x365EC2C3f0a846cc6A66d13Dd759761d4bBe1001
    market probe: {"addr":"0x34B605AF64469B06e2441c66e9ad3ABf7e675333","hasCode":true,"isResolved":true,"isVoided":false,"payoutNumerators":["10000000","0"],"status":4}
    pool probe:   {"addr":"0x365EC2C3f0a846cc6A66d13Dd759761d4bBe1001","hasCode":true,"isResolved":"ERR: The contract function \"isResolved\" reverted.\n\nContract Call:\n  address:   0x365EC2C3f0a846cc6A66d13Dd759761d4bBe1001\n  f","isVoided":"ERR: The contract function \"isVoided\" reverted.\n\nContract Call:\n  address:   0x365EC2C3f0a846cc6A66d13Dd759761d4bBe1001\n  fun","payoutNumerators":"ERR: The contract function \"payoutNumerators\" reverted.\n\nContract Call:\n  address:   0x365EC2C3f0a846cc6A66d13Dd759761d4bBe10","status":"ERR: The contract function \"status\" reverted.\n\nContract Call:\n  address:   0x365EC2C3f0a846cc6A66d13Dd759761d4bBe1001\n  funct"}
  live market: 0x2a81303bd63ee97fe2811a754bad54280742f990 ETH expiry=1789068600 (1min away) q="ETH closes at or above its opening price"
    idx8=0x1551E117e6D7852Dd2f9d4A019Ef0acC382815EF idx9=0xE0CACD78Cd3c29d95503DF7Fd638097e8743Dc3D
    market probe: {"addr":"0x1551E117e6D7852Dd2f9d4A019Ef0acC382815EF","hasCode":true,"isResolved":true,"isVoided":false,"payoutNumerators":["0","10000000"],"status":4}
    pool probe:   {"addr":"0xE0CACD78Cd3c29d95503DF7Fd638097e8743Dc3D","hasCode":true,"isResolved":"ERR: The contract function \"isResolved\" reverted.\n\nContract Call:\n  address:   0xE0CACD78Cd3c29d95503DF7Fd638097e8743Dc3D\n  f","isVoided":"ERR: The contract function \"isVoided\" reverted.\n\nContract Call:\n  address:   0xE0CACD78Cd3c29d95503DF7Fd638097e8743Dc3D\n  fun","payoutNumerators":"ERR: The contract function \"payoutNumerators\" reverted.\n\nContract Call:\n  address:   0xE0CACD78Cd3c29d95503DF7Fd638097e8743Dc","status":"ERR: The contract function \"status\" reverted.\n\nContract Call:\n  address:   0xE0CACD78Cd3c29d95503DF7Fd638097e8743Dc3D\n  funct"}
  live market: 0xf690cb4a28a59e7a2b73f186c33baa8eb4e60b29 ETH expiry=1789068600 (1min away) q="ETH closes at or above its opening price"
    idx8=0x40E46cc5beaE104dcFe5795eD8151529364881Cb idx9=0xF476A65F092f6a92F9775Cef5deE024F1f29dBE2
    market probe: {"addr":"0x40E46cc5beaE104dcFe5795eD8151529364881Cb","hasCode":true,"isResolved":true,"isVoided":false,"payoutNumerators":["0","10000000"],"status":4}
    pool probe:   {"addr":"0xF476A65F092f6a92F9775Cef5deE024F1f29dBE2","hasCode":true,"isResolved":"ERR: The contract function \"isResolved\" reverted.\n\nContract Call:\n  address:   0xF476A65F092f6a92F9775Cef5deE024F1f29dBE2\n  f","isVoided":"ERR: The contract function \"isVoided\" reverted.\n\nContract Call:\n  address:   0xF476A65F092f6a92F9775Cef5deE024F1f29dBE2\n  fun","payoutNumerators":"ERR: The contract function \"payoutNumerators\" reverted.\n\nContract Call:\n  address:   0xF476A65F092f6a92F9775Cef5deE024F1f29dB","status":"ERR: The contract function \"status\" reverted.\n\nContract Call:\n  address:   0xF476A65F092f6a92F9775Cef5deE024F1f29dBE2\n  funct"}
  live market: 0x244ab77af396e19bc02f17fc99ed20c7e0aea08f BTC expiry=1789070400 (31min away) q="BTC closes at or above its opening price"
    idx8=0xa9fCF16Cf0E167317a273B84B9fEfBc7F5923073 idx9=0x822ffBDE1fA9b14c57D0b6A30417260307FD5329
    market probe: {"addr":"0xa9fCF16Cf0E167317a273B84B9fEfBc7F5923073","hasCode":true,"isResolved":true,"isVoided":false,"payoutNumerators":["0","10000000"],"status":4}
    pool probe:   {"addr":"0x822ffBDE1fA9b14c57D0b6A30417260307FD5329","hasCode":true,"isResolved":"ERR: The contract function \"isResolved\" reverted.\n\nContract Call:\n  address:   0x822ffBDE1fA9b14c57D0b6A30417260307FD5329\n  f","isVoided":"ERR: The contract function \"isVoided\" reverted.\n\nContract Call:\n  address:   0x822ffBDE1fA9b14c57D0b6A30417260307FD5329\n  fun","payoutNumerators":"ERR: The contract function \"payoutNumerators\" reverted.\n\nContract Call:\n  address:   0x822ffBDE1fA9b14c57D0b6A30417260307FD53","status":"ERR: The contract function \"status\" reverted.\n\nContract Call:\n  address:   0x822ffBDE1fA9b14c57D0b6A30417260307FD5329\n  funct"}
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
