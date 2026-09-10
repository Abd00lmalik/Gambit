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
  live market: 0x5d06f3ddaa0dddc8c4e598897cdd5921f40a14b9 BTC expiry=1789051500 (3min away) q="BTC closes at or above its opening price"
    idx8=0x8D776B59aB75c1C09f7cABd3Fdd8f4aB3D0cE84B idx9=0x60005cbb6a5C6b302c3504C75306e0cEfc2bf874
    market probe: {"addr":"0x8D776B59aB75c1C09f7cABd3Fdd8f4aB3D0cE84B","hasCode":true,"isResolved":true,"isVoided":false,"payoutNumerators":["10000000","0"],"status":4}
    pool probe:   {"addr":"0x60005cbb6a5C6b302c3504C75306e0cEfc2bf874","hasCode":true,"isResolved":"ERR: The contract function \"isResolved\" reverted.\n\nContract Call:\n  address:   0x60005cbb6a5C6b302c3504C75306e0cEfc2bf874\n  f","isVoided":"ERR: The contract function \"isVoided\" reverted.\n\nContract Call:\n  address:   0x60005cbb6a5C6b302c3504C75306e0cEfc2bf874\n  fun","payoutNumerators":"ERR: The contract function \"payoutNumerators\" reverted.\n\nContract Call:\n  address:   0x60005cbb6a5C6b302c3504C75306e0cEfc2bf8","status":"ERR: The contract function \"status\" reverted.\n\nContract Call:\n  address:   0x60005cbb6a5C6b302c3504C75306e0cEfc2bf874\n  funct"}
  live market: 0x28dbba6605e64166337e372abeb6d692ef44117a ETH expiry=1789051500 (3min away) q="ETH closes at or above its opening price"
    idx8=0x50dd8570820acfc447D211D8716aD8cf1f67984B idx9=0xF2F125019f8b8b0f722a5aA08f2935C76e10EC68
    market probe: {"addr":"0x50dd8570820acfc447D211D8716aD8cf1f67984B","hasCode":true,"isResolved":true,"isVoided":false,"payoutNumerators":["10000000","0"],"status":4}
    pool probe:   {"addr":"0xF2F125019f8b8b0f722a5aA08f2935C76e10EC68","hasCode":true,"isResolved":"ERR: The contract function \"isResolved\" reverted.\n\nContract Call:\n  address:   0xF2F125019f8b8b0f722a5aA08f2935C76e10EC68\n  f","isVoided":"ERR: The contract function \"isVoided\" reverted.\n\nContract Call:\n  address:   0xF2F125019f8b8b0f722a5aA08f2935C76e10EC68\n  fun","payoutNumerators":"ERR: The contract function \"payoutNumerators\" reverted.\n\nContract Call:\n  address:   0xF2F125019f8b8b0f722a5aA08f2935C76e10EC","status":"ERR: The contract function \"status\" reverted.\n\nContract Call:\n  address:   0xF2F125019f8b8b0f722a5aA08f2935C76e10EC68\n  funct"}
  live market: 0x9187655188dd1db5297a9726b329eaf24fe8ba6c BTC expiry=1789051500 (3min away) q="BTC closes at or above its opening price"
    idx8=0xdf3816F4cA6ae7621C68EDA873BF94eFDD842A66 idx9=0xFF45f9BbCf2049C5BA6439de86bFf4a65b3561eE
    market probe: {"addr":"0xdf3816F4cA6ae7621C68EDA873BF94eFDD842A66","hasCode":true,"isResolved":true,"isVoided":false,"payoutNumerators":["0","10000000"],"status":4}
    pool probe:   {"addr":"0xFF45f9BbCf2049C5BA6439de86bFf4a65b3561eE","hasCode":true,"isResolved":"ERR: The contract function \"isResolved\" reverted.\n\nContract Call:\n  address:   0xFF45f9BbCf2049C5BA6439de86bFf4a65b3561eE\n  f","isVoided":"ERR: The contract function \"isVoided\" reverted.\n\nContract Call:\n  address:   0xFF45f9BbCf2049C5BA6439de86bFf4a65b3561eE\n  fun","payoutNumerators":"ERR: The contract function \"payoutNumerators\" reverted.\n\nContract Call:\n  address:   0xFF45f9BbCf2049C5BA6439de86bFf4a65b3561","status":"ERR: The contract function \"status\" reverted.\n\nContract Call:\n  address:   0xFF45f9BbCf2049C5BA6439de86bFf4a65b3561eE\n  funct"}
  live market: 0x27cc1452b38d236bcb72fc43f78772ecada642dd ETH expiry=1789051500 (3min away) q="ETH closes at or above its opening price"
    idx8=0xc69276D573A4b721238b18e0f866E0cC5d5c1887 idx9=0xfC6F0581EcEeaB1a617747AD8c826283a3505752
    market probe: {"addr":"0xc69276D573A4b721238b18e0f866E0cC5d5c1887","hasCode":true,"isResolved":true,"isVoided":false,"payoutNumerators":["10000000","0"],"status":4}
    pool probe:   {"addr":"0xfC6F0581EcEeaB1a617747AD8c826283a3505752","hasCode":true,"isResolved":"ERR: The contract function \"isResolved\" reverted.\n\nContract Call:\n  address:   0xfC6F0581EcEeaB1a617747AD8c826283a3505752\n  f","isVoided":"ERR: The contract function \"isVoided\" reverted.\n\nContract Call:\n  address:   0xfC6F0581EcEeaB1a617747AD8c826283a3505752\n  fun","payoutNumerators":"ERR: The contract function \"payoutNumerators\" reverted.\n\nContract Call:\n  address:   0xfC6F0581EcEeaB1a617747AD8c826283a35057","status":"ERR: The contract function \"status\" reverted.\n\nContract Call:\n  address:   0xfC6F0581EcEeaB1a617747AD8c826283a3505752\n  funct"}
  live market: 0xfb1569f9eb20505130136dfca835c60117289115 BTC expiry=1789052400 (18min away) q="BTC closes at or above its opening price"
    idx8=0xE6cBE4119989a70FBC3C1b512BCa922960a231E9 idx9=0x2DC8aaEdb4D75577f335F59539f5Ca47d02e9dD2
    market probe: {"addr":"0xE6cBE4119989a70FBC3C1b512BCa922960a231E9","hasCode":true,"isResolved":true,"isVoided":false,"payoutNumerators":["10000000","0"],"status":4}
    pool probe:   {"addr":"0x2DC8aaEdb4D75577f335F59539f5Ca47d02e9dD2","hasCode":true,"isResolved":"ERR: The contract function \"isResolved\" reverted.\n\nContract Call:\n  address:   0x2DC8aaEdb4D75577f335F59539f5Ca47d02e9dD2\n  f","isVoided":"ERR: The contract function \"isVoided\" reverted.\n\nContract Call:\n  address:   0x2DC8aaEdb4D75577f335F59539f5Ca47d02e9dD2\n  fun","payoutNumerators":"ERR: The contract function \"payoutNumerators\" reverted.\n\nContract Call:\n  address:   0x2DC8aaEdb4D75577f335F59539f5Ca47d02e9d","status":"ERR: The contract function \"status\" reverted.\n\nContract Call:\n  address:   0x2DC8aaEdb4D75577f335F59539f5Ca47d02e9dD2\n  funct"}
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
