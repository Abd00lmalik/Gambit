#### SECTION 8: ORACLE ANSWER SCHEMA + VALUES
OracleAnswer fields: {
  "data": {
    "__type": {
      "fields": [
        {
          "name": "id",
          "type": {
            "name": null,
            "kind": "NON_NULL",
            "ofType": {
              "name": "String"
            }
          }
        },
        {
          "name": "numericValue",
          "type": {
            "name": "numeric",
            "kind": "SCALAR",
            "ofType": null
          }
        },
        {
          "name": "oracleQuestionId",
          "type": {
            "name": null,
            "kind": "NON_NULL",
            "ofType": {
              "name": "numeric"
            }
          }
        },
        {
          "name": "outcomeIdx",
          "type": {
            "name": "Int",
            "kind": "SCALAR",
            "ofType": null
          }
        },
        {
          "name": "outcomeLabel",
          "type": {
            "name": "String",
            "kind": "SCALAR",
            "ofType": null
          }
        },
        {
          "name": "resolvedAt",
          "type": {
            "name": "numeric",
            "kind": "SCALAR",
            "ofType": null
          }
        },
        {
          "name": "txHash",
          "type": {
            "name": "String",
            "kind": "SCALAR",
            "ofType": null
          }
        },
        {
          "name": "voidReason",
          "type": {
            "name": "Int",
            "kind": "SCALAR",
            "ofType": null
          }
        },
        {
          "name": "voided",
          "type": {
            "name": "Boolean",
            "kind": "SCALAR",
            "ofType": null
          }
        }
      ]
    }
  }
}
OracleAnswer 56312 (select-all-safe): {"data":{"OracleAnswer":[{"id":"56312"}]}}
OracleAnswer 56301 (select-all-safe): {"data":{"OracleAnswer":[{"id":"56301"}]}}
OracleAnswer 56312 full: {
  "data": {
    "OracleAnswer": [
      {
        "id": "56312",
        "numericValue": "7796600",
        "oracleQuestionId": "56312",
        "outcomeIdx": 0,
        "outcomeLabel": ">= 0.00",
        "resolvedAt": "1789036202",
        "txHash": "0xb6d5465940533e5ab084932d7a128920423d1693eb107af551ac8184ce3d9a02",
        "voidReason": 0,
        "voided": false
      }
    ]
  }
}
OracleAnswer 56301 full: {
  "data": {
    "OracleAnswer": [
      {
        "id": "56301",
        "numericValue": "7797895",
        "oracleQuestionId": "56301",
        "outcomeIdx": 0,
        "outcomeLabel": ">= 0.00",
        "resolvedAt": "1789035302",
        "txHash": "0xad7728e5426cb0725562f7d567bd6479e6a9422a615781c38d90732651cedc7b",
        "voidReason": 0,
        "voided": false
      }
    ]
  }
}
#### SECTION 9: MARKET CONTRACT LOGS (settled duel market)
REPORTED DUEL MARKET (0x61Dd6bd8C15D6Df32F9C8Beb62400e9e2a76D116) — 3 logs (up to 30):
[
  {
    "txHash": "0x77b57e04597d2e3e042db2e1f3f31f2af2f856887df662061fc0dece05524877",
    "block": 458970995,
    "timestamp": "2026-08-11T17:30:01.000000Z",
    "topics": [
      "0xe1377aa21d49fa10bb9ece6a0cd4f75597a90a80c3750f7f7674967f49ab9a62",
      "0x0000000000000000000000000000000000000000000000000000000000000002",
      "0x0000000000000000000000000000000000000000000000000000000000000004",
      null
    ],
    "index": 12
  },
  {
    "txHash": "0x77b57e04597d2e3e042db2e1f3f31f2af2f856887df662061fc0dece05524877",
    "block": 458970995,
    "timestamp": "2026-08-11T17:30:01.000000Z",
    "topics": [
      "0x54f8b431494130aaf7827023337336e584c3e73cd8f785a438f09feb95ff7578",
      null,
      null,
      null
    ],
    "index": 11
  },
  {
    "txHash": "0x7722c0920f9b4220ed766fd6a5d73483a536a96d561728bc443b819a302fe0eb",
    "block": 458961980,
    "timestamp": "2026-08-11T17:15:00.000000Z",
    "topics": [
      "0xc7f505b2f371ae2175ee4913f4499e1f2633a7b5936321eed1cdaeb6115181d2",
      null,
      null,
      null
    ],
    "index": 108
  }
]
LIVE (TRADING) MARKET (0xAD0Ecd6A4c7e13B811f79eB583EBe6Cc32E5f92d) — 3 logs (up to 30):
[
  {
    "txHash": "0x82944558c6b9a0eadb1d7dbf4ac684ab0092ae40b1c052a932ee836ac68766e7",
    "block": 459222873,
    "timestamp": "2026-08-12T00:30:02.000000Z",
    "topics": [
      "0xe1377aa21d49fa10bb9ece6a0cd4f75597a90a80c3750f7f7674967f49ab9a62",
      "0x0000000000000000000000000000000000000000000000000000000000000002",
      "0x0000000000000000000000000000000000000000000000000000000000000004",
      null
    ],
    "index": 27
  },
  {
    "txHash": "0x82944558c6b9a0eadb1d7dbf4ac684ab0092ae40b1c052a932ee836ac68766e7",
    "block": 459222873,
    "timestamp": "2026-08-12T00:30:02.000000Z",
    "topics": [
      "0x54f8b431494130aaf7827023337336e584c3e73cd8f785a438f09feb95ff7578",
      null,
      null,
      null
    ],
    "index": 26
  },
  {
    "txHash": "0xd027c80601af96f84119ab6e4765c0c9917522dde684bf40a1a9487631264469",
    "block": 459213855,
    "timestamp": "2026-08-12T00:15:00.000000Z",
    "topics": [
      "0xc7f505b2f371ae2175ee4913f4499e1f2633a7b5936321eed1cdaeb6115181d2",
      null,
      null,
      null
    ],
    "index": 104
  }
]
block timestamp fetch failed: Unexpected token '<', "<html>
<h"... is not valid JSON
#### SECTION 10: PRICE FEED — OPENING (10:15Z) vs EXPIRY (10:30Z) on 2026-09-10
t=1789035300 (2026-09-10T10:15:00.000Z): [{"t":"2026-09-10T10:14:55.000Z","spotUsd":77970.84999999999},{"t":"2026-09-10T10:14:56.000Z","spotUsd":77970.805},{"t":"2026-09-10T10:14:57.000Z","spotUsd":77970.2}]
t=1789036200 (2026-09-10T10:30:00.000Z): [{"t":"2026-09-10T10:29:55.000Z","spotUsd":77963.8325},{"t":"2026-09-10T10:29:56.000Z","spotUsd":77963.8325},{"t":"2026-09-10T10:29:57.000Z","spotUsd":77962.74999999999}]
latest BTC/USDC: [{"spot":"77302805000000000000000","blockTimestamp":"1789051096"}]
#### SECTION 11: ORACLE QUESTION DETAILS
Question fields: undefined
OracleQuestion fields: ["bindCount","binds","createdAtBlock","createdAtTimestamp","id","oracleCost","oracleQuestionId","payoutDenominator","payoutNumerators","questionKey","resolvedAt","resolvedAtBlock","reuseCount","scheduler","supersededByQuestionId","voided"]
#### DEEP DIVE COMPLETE
#### SECTION 12: MODULE RECORD vs INDEXER EXPIRY (staleness pattern)
found 4 live markets

LIVE BTC marketAddress=0x645e0186ab2ceb39506ecbeb120423290ed38fce marketId=0x0000000000000000000000000000000000000000000000000000000000003fa7
  indexer: {"marketAddress":"0x645e0186ab2ceb39506ecbeb120423290ed38fce","expiry":1789051200,"expiryISO":"2026-09-10T14:40:00.000Z","tradingStartISO":"2026-09-10T14:35:00.000Z","binaryPoolAddress":"0x4c42f9ef7d0f51b91775d1f8f366e90f75d56c47"}
  module:  {"market":"0xDC77f4b5D0faDb168B42A46a482d8aA2951ee142","pool":"0x5E1f4797860Cd1E6B0Dd14b320683c8131436131","expiry":1786519800,"expiryISO":"2026-08-12T07:30:00.000Z","stale":true,"expiryMatchesIndexer":false}
  binaryPoolAddress probe: {"hasCode":false,"isResolved":"reverted","payoutNumerators":"reverted","expiry":"reverted"}

LIVE ETH marketAddress=0xaa3325ec5a26b5c497f8477d07432c0dd3ff420f marketId=0x0000000000000000000000000000000000000000000000000000000000003fa8
  indexer: {"marketAddress":"0xaa3325ec5a26b5c497f8477d07432c0dd3ff420f","expiry":1789051200,"expiryISO":"2026-09-10T14:40:00.000Z","tradingStartISO":"2026-09-10T14:35:00.000Z","binaryPoolAddress":"0x5c142b0b8d8bb1a62ea2931801f66be01aae88ac"}
  module:  {"market":"0x4e8EeB59FE20f9Fb06c3609BfDF14598199F61C4","pool":"0xC48C700a0D9076F492A81d06fd0491a4FC8fAab4","expiry":1786520700,"expiryISO":"2026-08-12T07:45:00.000Z","stale":true,"expiryMatchesIndexer":false}
  binaryPoolAddress probe: {"hasCode":false,"isResolved":"reverted","payoutNumerators":"reverted","expiry":"reverted"}

LIVE BTC marketAddress=0x5d06f3ddaa0dddc8c4e598897cdd5921f40a14b9 marketId=0x0000000000000000000000000000000000000000000000000000000000003fa3
  indexer: {"marketAddress":"0x5d06f3ddaa0dddc8c4e598897cdd5921f40a14b9","expiry":1789051500,"expiryISO":"2026-09-10T14:45:00.000Z","tradingStartISO":"2026-09-10T14:30:00.000Z","binaryPoolAddress":"0x363deb12f640de39b0575d158325dad098ba0d02"}
  module:  {"market":"0x8D776B59aB75c1C09f7cABd3Fdd8f4aB3D0cE84B","pool":"0x60005cbb6a5C6b302c3504C75306e0cEfc2bf874","expiry":1786521600,"expiryISO":"2026-08-12T08:00:00.000Z","stale":true,"expiryMatchesIndexer":false}
  binaryPoolAddress probe: {"hasCode":true,"isResolved":"reverted","payoutNumerators":"reverted","expiry":"reverted"}

LIVE ETH marketAddress=0x28dbba6605e64166337e372abeb6d692ef44117a marketId=0x0000000000000000000000000000000000000000000000000000000000003fa4
  indexer: {"marketAddress":"0x28dbba6605e64166337e372abeb6d692ef44117a","expiry":1789051500,"expiryISO":"2026-09-10T14:45:00.000Z","tradingStartISO":"2026-09-10T14:30:00.000Z","binaryPoolAddress":"0xd79b8e01c591ded158e5a782f1bb0a712e8ad2bd"}
  module:  {"market":"0x50dd8570820acfc447D211D8716aD8cf1f67984B","pool":"0xF2F125019f8b8b0f722a5aA08f2935C76e10EC68","expiry":1786518900,"expiryISO":"2026-08-12T07:15:00.000Z","stale":true,"expiryMatchesIndexer":false}
  binaryPoolAddress probe: {"hasCode":false,"isResolved":"reverted","payoutNumerators":"reverted","expiry":"reverted"}

#### SECTION 13: REPORTED DUEL MARKET SUMMARY
module record: {
  "market": "0x61Dd6bd8C15D6Df32F9C8Beb62400e9e2a76D116",
  "pool": "0xBc38935791a003196830e43c8632a498DBd76849",
  "expiry": 1786469400,
  "expiryISO": "2026-08-11T17:30:00.000Z"
}
oracle answers: [
  {
    "id": "56301",
    "numericValue": "7797895",
    "outcomeIdx": 0,
    "resolvedAt": "1789035302",
    "voided": false,
    "txHash": "0xad7728e5426cb0725562f7d567bd6479e6a9422a615781c38d90732651cedc7b"
  },
  {
    "id": "56312",
    "numericValue": "7796600",
    "outcomeIdx": 0,
    "resolvedAt": "1789036202",
    "voided": false,
    "txHash": "0xb6d5465940533e5ab084932d7a128920423d1693eb107af551ac8184ce3d9a02"
  }
]
RESOLUTION MATH: final($ 77966 ) vs opening($ 77978.95 ) → DOWN WON (final below opening)

#### SECTION 14: CREATION CHECKS ON LIVE MARKETS (post-fix logic)
  PASS BTC 0x5d06f3ddaa0dddc8c4e598897cdd5921f40a14b9: {"asset":"BTC","checks":{"indexerRow":true,"clobStatusTrading":true,"marketContractRegistered":true,"marketContractHasCode":true},"informational_moduleWindowEnds":"2026-08-12T08:00:00.000Z","informational_moduleIsPastWindow":true}
  PASS ETH 0x28dbba6605e64166337e372abeb6d692ef44117a: {"asset":"ETH","checks":{"indexerRow":true,"clobStatusTrading":true,"marketContractRegistered":true,"marketContractHasCode":true},"informational_moduleWindowEnds":"2026-08-12T07:15:00.000Z","informational_moduleIsPastWindow":true}
  PASS BTC 0xfb1569f9eb20505130136dfca835c60117289115: {"asset":"BTC","checks":{"indexerRow":true,"clobStatusTrading":true,"marketContractRegistered":true,"marketContractHasCode":true},"informational_moduleWindowEnds":"2026-08-12T05:15:00.000Z","informational_moduleIsPastWindow":true}
CREATION CHECKS: 3/3 live markets pass the (post-fix) creation flow
P0 creation checks RESOLVED (creation not blocked) ✅
