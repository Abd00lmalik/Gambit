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
  live market: 0x7946ff284fef80361c33126bfbd757cec89dee55 BTC expiry=1789044600 (2min away) q="BTC closes at or above its opening price"
    idx8=0x51ff65CdEE1BfBFfea863E274CB37FAA62CFcc30 idx9=0xc3F1Ae5c32E1CA30dB3Ad47E65f6878c7fb8284c
    market probe: {"addr":"0x51ff65CdEE1BfBFfea863E274CB37FAA62CFcc30","hasCode":true,"isResolved":true,"isVoided":false,"payoutNumerators":["0","10000000"],"status":4}
    pool probe:   {"addr":"0xc3F1Ae5c32E1CA30dB3Ad47E65f6878c7fb8284c","hasCode":true,"isResolved":"ERR: The contract function \"isResolved\" reverted.\n\nContract Call:\n  address:   0xc3F1Ae5c32E1CA30dB3Ad47E65f6878c7fb8284c\n  f","isVoided":"ERR: The contract function \"isVoided\" reverted.\n\nContract Call:\n  address:   0xc3F1Ae5c32E1CA30dB3Ad47E65f6878c7fb8284c\n  fun","payoutNumerators":"ERR: The contract function \"payoutNumerators\" reverted.\n\nContract Call:\n  address:   0xc3F1Ae5c32E1CA30dB3Ad47E65f6878c7fb828","status":"ERR: The contract function \"status\" reverted.\n\nContract Call:\n  address:   0xc3F1Ae5c32E1CA30dB3Ad47E65f6878c7fb8284c\n  funct"}
  live market: 0x8e70a420335e3b5cba0c50f72e8d64a67a6be108 ETH expiry=1789044600 (2min away) q="ETH closes at or above its opening price"
    idx8=0xD2799dC6EC99D0A30b870a51Dd3D6f90034e628E idx9=0xe3CA11405cC9448C1eEf14198392076e0d8410e2
    market probe: {"addr":"0xD2799dC6EC99D0A30b870a51Dd3D6f90034e628E","hasCode":true,"isResolved":true,"isVoided":false,"payoutNumerators":["10000000","0"],"status":4}
    pool probe:   {"addr":"0xe3CA11405cC9448C1eEf14198392076e0d8410e2","hasCode":true,"isResolved":"ERR: The contract function \"isResolved\" reverted.\n\nContract Call:\n  address:   0xe3CA11405cC9448C1eEf14198392076e0d8410e2\n  f","isVoided":"ERR: The contract function \"isVoided\" reverted.\n\nContract Call:\n  address:   0xe3CA11405cC9448C1eEf14198392076e0d8410e2\n  fun","payoutNumerators":"ERR: The contract function \"payoutNumerators\" reverted.\n\nContract Call:\n  address:   0xe3CA11405cC9448C1eEf14198392076e0d8410","status":"ERR: The contract function \"status\" reverted.\n\nContract Call:\n  address:   0xe3CA11405cC9448C1eEf14198392076e0d8410e2\n  funct"}
  live market: 0x466016cfcf4b7bb13573948dae90d3b2c817ba03 BTC expiry=1789045200 (12min away) q="BTC closes at or above its opening price"
    idx8=0x60a5CB3042de82F6180B84483FE1ECC9F02Fc506 idx9=0xd8040A47299d5fEba6eb617Fa1DD022D15937d6a
    market probe: {"addr":"0x60a5CB3042de82F6180B84483FE1ECC9F02Fc506","hasCode":true,"isResolved":true,"isVoided":false,"payoutNumerators":["10000000","0"],"status":4}
    pool probe:   {"addr":"0xd8040A47299d5fEba6eb617Fa1DD022D15937d6a","hasCode":true,"isResolved":"ERR: The contract function \"isResolved\" reverted.\n\nContract Call:\n  address:   0xd8040A47299d5fEba6eb617Fa1DD022D15937d6a\n  f","isVoided":"ERR: The contract function \"isVoided\" reverted.\n\nContract Call:\n  address:   0xd8040A47299d5fEba6eb617Fa1DD022D15937d6a\n  fun","payoutNumerators":"ERR: The contract function \"payoutNumerators\" reverted.\n\nContract Call:\n  address:   0xd8040A47299d5fEba6eb617Fa1DD022D15937d","status":"ERR: The contract function \"status\" reverted.\n\nContract Call:\n  address:   0xd8040A47299d5fEba6eb617Fa1DD022D15937d6a\n  funct"}
  live market: 0x3a6d33bc5306ff32319dd8b25805884ccb57aaab ETH expiry=1789045200 (12min away) q="ETH closes at or above its opening price"
    idx8=0xb61dE2b2e423431CcB6d0E3d895Df5D576D48Bf8 idx9=0x3202d46De84105b62b1eD87944E28dfc9E3B4D55
    market probe: {"addr":"0xb61dE2b2e423431CcB6d0E3d895Df5D576D48Bf8","hasCode":true,"isResolved":true,"isVoided":false,"payoutNumerators":["0","10000000"],"status":4}
    pool probe:   {"addr":"0x3202d46De84105b62b1eD87944E28dfc9E3B4D55","hasCode":true,"isResolved":"ERR: The contract function \"isResolved\" reverted.\n\nContract Call:\n  address:   0x3202d46De84105b62b1eD87944E28dfc9E3B4D55\n  f","isVoided":"ERR: The contract function \"isVoided\" reverted.\n\nContract Call:\n  address:   0x3202d46De84105b62b1eD87944E28dfc9E3B4D55\n  fun","payoutNumerators":"ERR: The contract function \"payoutNumerators\" reverted.\n\nContract Call:\n  address:   0x3202d46De84105b62b1eD87944E28dfc9E3B4D","status":"ERR: The contract function \"status\" reverted.\n\nContract Call:\n  address:   0x3202d46De84105b62b1eD87944E28dfc9E3B4D55\n  funct"}
  live market: 0x6cc015afb745435b341326341f850dceca89c9d8 BTC expiry=1789045200 (12min away) q="BTC closes at or above its opening price"
    idx8=0x1B21D28f53a39aAF4c5E70477bCdb9f44213A737 idx9=0xA5d824732571E0a3C8496Bba5cd9458D54f0413d
    market probe: {"addr":"0x1B21D28f53a39aAF4c5E70477bCdb9f44213A737","hasCode":true,"isResolved":true,"isVoided":false,"payoutNumerators":["10000000","0"],"status":4}
    pool probe:   {"addr":"0xA5d824732571E0a3C8496Bba5cd9458D54f0413d","hasCode":true,"isResolved":"ERR: The contract function \"isResolved\" reverted.\n\nContract Call:\n  address:   0xA5d824732571E0a3C8496Bba5cd9458D54f0413d\n  f","isVoided":"ERR: The contract function \"isVoided\" reverted.\n\nContract Call:\n  address:   0xA5d824732571E0a3C8496Bba5cd9458D54f0413d\n  fun","payoutNumerators":"ERR: The contract function \"payoutNumerators\" reverted.\n\nContract Call:\n  address:   0xA5d824732571E0a3C8496Bba5cd9458D54f041","status":"ERR: The contract function \"status\" reverted.\n\nContract Call:\n  address:   0xA5d824732571E0a3C8496Bba5cd9458D54f0413d\n  funct"}
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
