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
  live market: 0x0a8edae8f7baef3ecd43d531b626832cf8747498 BTC expiry=1789058700 (2min away) q="BTC closes at or above its opening price"
    idx8=0x595ffB1ac81bc30290a1227828B3caAA49964997 idx9=0xd1D702436C61cd066643D3107c3bCD434003Aab8
    market probe: {"addr":"0x595ffB1ac81bc30290a1227828B3caAA49964997","hasCode":true,"isResolved":true,"isVoided":false,"payoutNumerators":["0","10000000"],"status":4}
    pool probe:   {"addr":"0xd1D702436C61cd066643D3107c3bCD434003Aab8","hasCode":true,"isResolved":"ERR: The contract function \"isResolved\" reverted.\n\nContract Call:\n  address:   0xd1D702436C61cd066643D3107c3bCD434003Aab8\n  f","isVoided":"ERR: The contract function \"isVoided\" reverted.\n\nContract Call:\n  address:   0xd1D702436C61cd066643D3107c3bCD434003Aab8\n  fun","payoutNumerators":"ERR: The contract function \"payoutNumerators\" reverted.\n\nContract Call:\n  address:   0xd1D702436C61cd066643D3107c3bCD434003Aa","status":"ERR: The contract function \"status\" reverted.\n\nContract Call:\n  address:   0xd1D702436C61cd066643D3107c3bCD434003Aab8\n  funct"}
  live market: 0x35c6dcd932a376c6903df2ee5c94557e864a3873 ETH expiry=1789058700 (2min away) q="ETH closes at or above its opening price"
    idx8=0x53CF25433036d15CEA3b294a78A3A3684b62E885 idx9=0xF77c869fc2803b11Bee727B74a655135dDc2866C
    market probe: {"addr":"0x53CF25433036d15CEA3b294a78A3A3684b62E885","hasCode":true,"isResolved":true,"isVoided":false,"payoutNumerators":["10000000","0"],"status":4}
    pool probe:   {"addr":"0xF77c869fc2803b11Bee727B74a655135dDc2866C","hasCode":true,"isResolved":"ERR: The contract function \"isResolved\" reverted.\n\nContract Call:\n  address:   0xF77c869fc2803b11Bee727B74a655135dDc2866C\n  f","isVoided":"ERR: The contract function \"isVoided\" reverted.\n\nContract Call:\n  address:   0xF77c869fc2803b11Bee727B74a655135dDc2866C\n  fun","payoutNumerators":"ERR: The contract function \"payoutNumerators\" reverted.\n\nContract Call:\n  address:   0xF77c869fc2803b11Bee727B74a655135dDc286","status":"ERR: The contract function \"status\" reverted.\n\nContract Call:\n  address:   0xF77c869fc2803b11Bee727B74a655135dDc2866C\n  funct"}
  live market: 0x62a38f066f66c01a546669c72d3fc0c8f76f8b9f BTC expiry=1789058700 (2min away) q="BTC closes at or above its opening price"
    idx8=0x6B49B149206cF8f6bce4FEa7fe643e267691DDC9 idx9=0x11DBebcFB236186E4e6331Ea0d2a41dBC89d001F
    market probe: {"addr":"0x6B49B149206cF8f6bce4FEa7fe643e267691DDC9","hasCode":true,"isResolved":true,"isVoided":false,"payoutNumerators":["0","10000000"],"status":4}
    pool probe:   {"addr":"0x11DBebcFB236186E4e6331Ea0d2a41dBC89d001F","hasCode":true,"isResolved":"ERR: The contract function \"isResolved\" reverted.\n\nContract Call:\n  address:   0x11DBebcFB236186E4e6331Ea0d2a41dBC89d001F\n  f","isVoided":"ERR: The contract function \"isVoided\" reverted.\n\nContract Call:\n  address:   0x11DBebcFB236186E4e6331Ea0d2a41dBC89d001F\n  fun","payoutNumerators":"ERR: The contract function \"payoutNumerators\" reverted.\n\nContract Call:\n  address:   0x11DBebcFB236186E4e6331Ea0d2a41dBC89d00","status":"ERR: The contract function \"status\" reverted.\n\nContract Call:\n  address:   0x11DBebcFB236186E4e6331Ea0d2a41dBC89d001F\n  funct"}
  live market: 0xccb3d9b762b528fdbbdf56e075addbfd0eec73aa ETH expiry=1789058700 (2min away) q="ETH closes at or above its opening price"
    idx8=0xeaB6b9cD1A3887A19B9E7D27232EA597B8D6b19C idx9=0xE999F5C09794029DA0b6F277012b6CCAb16d9872
    market probe: {"addr":"0xeaB6b9cD1A3887A19B9E7D27232EA597B8D6b19C","hasCode":true,"isResolved":true,"isVoided":false,"payoutNumerators":["0","10000000"],"status":4}
    pool probe:   {"addr":"0xE999F5C09794029DA0b6F277012b6CCAb16d9872","hasCode":true,"isResolved":"ERR: The contract function \"isResolved\" reverted.\n\nContract Call:\n  address:   0xE999F5C09794029DA0b6F277012b6CCAb16d9872\n  f","isVoided":"ERR: The contract function \"isVoided\" reverted.\n\nContract Call:\n  address:   0xE999F5C09794029DA0b6F277012b6CCAb16d9872\n  fun","payoutNumerators":"ERR: The contract function \"payoutNumerators\" reverted.\n\nContract Call:\n  address:   0xE999F5C09794029DA0b6F277012b6CCAb16d98","status":"ERR: The contract function \"status\" reverted.\n\nContract Call:\n  address:   0xE999F5C09794029DA0b6F277012b6CCAb16d9872\n  funct"}
  live market: 0x5dd64de473f2851c242c54aa8b76d8a2227a651c BTC expiry=1789059600 (17min away) q="BTC closes at or above its opening price"
    idx8=0x45ef40687B1a400BFC20857D9AF2D644DF458Fb2 idx9=0x227E4d7F97A068c861a0C5f833B936D2bBeB6fdf
    market probe: {"addr":"0x45ef40687B1a400BFC20857D9AF2D644DF458Fb2","hasCode":true,"isResolved":true,"isVoided":false,"payoutNumerators":["10000000","0"],"status":4}
    pool probe:   {"addr":"0x227E4d7F97A068c861a0C5f833B936D2bBeB6fdf","hasCode":true,"isResolved":"ERR: The contract function \"isResolved\" reverted.\n\nContract Call:\n  address:   0x227E4d7F97A068c861a0C5f833B936D2bBeB6fdf\n  f","isVoided":"ERR: The contract function \"isVoided\" reverted.\n\nContract Call:\n  address:   0x227E4d7F97A068c861a0C5f833B936D2bBeB6fdf\n  fun","payoutNumerators":"ERR: The contract function \"payoutNumerators\" reverted.\n\nContract Call:\n  address:   0x227E4d7F97A068c861a0C5f833B936D2bBeB6f","status":"ERR: The contract function \"status\" reverted.\n\nContract Call:\n  address:   0x227E4d7F97A068c861a0C5f833B936D2bBeB6fdf\n  funct"}
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
