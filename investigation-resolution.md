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
latest BTC/USDC: [{"spot":"76993750000000000000000","blockTimestamp":"1789058649"}]
#### SECTION 11: ORACLE QUESTION DETAILS
Question fields: undefined
OracleQuestion fields: ["bindCount","binds","createdAtBlock","createdAtTimestamp","id","oracleCost","oracleQuestionId","payoutDenominator","payoutNumerators","questionKey","resolvedAt","resolvedAtBlock","reuseCount","scheduler","supersededByQuestionId","voided"]
#### DEEP DIVE COMPLETE
#### SECTION 12: MODULE RECORD vs INDEXER EXPIRY (staleness pattern)
found 2 live markets

LIVE BTC marketAddress=0x5dd64de473f2851c242c54aa8b76d8a2227a651c marketId=0x0000000000000000000000000000000000000000000000000000000000003fd5
  indexer: {"marketAddress":"0x5dd64de473f2851c242c54aa8b76d8a2227a651c","expiry":1789059600,"expiryISO":"2026-09-10T17:00:00.000Z","tradingStartISO":"2026-09-10T16:00:00.000Z","binaryPoolAddress":"0x363deb12f640de39b0575d158325dad098ba0d02"}
  module:  {"market":"0x45ef40687B1a400BFC20857D9AF2D644DF458Fb2","pool":"0x227E4d7F97A068c861a0C5f833B936D2bBeB6fdf","expiry":1786536000,"expiryISO":"2026-08-12T12:00:00.000Z","stale":true,"expiryMatchesIndexer":false}
  binaryPoolAddress probe: {"hasCode":true,"isResolved":"reverted","payoutNumerators":"reverted","expiry":"reverted"}

LIVE ETH marketAddress=0xdd5a730076397cb1632f4661773ac2faf0d23b5b marketId=0x0000000000000000000000000000000000000000000000000000000000003fd6
  indexer: {"marketAddress":"0xdd5a730076397cb1632f4661773ac2faf0d23b5b","expiry":1789059600,"expiryISO":"2026-09-10T17:00:00.000Z","tradingStartISO":"2026-09-10T16:00:00.000Z","binaryPoolAddress":"0xd79b8e01c591ded158e5a782f1bb0a712e8ad2bd"}
  module:  {"market":"0x29e697691Df338f41bde31A68E5f7BD9e57131B6","pool":"0xB92f4f2FEf1480Eb8F16819c3f49f1c5E9746C9e","expiry":1786550400,"expiryISO":"2026-08-12T16:00:00.000Z","stale":true,"expiryMatchesIndexer":false}
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
  PASS BTC 0x5dd64de473f2851c242c54aa8b76d8a2227a651c: {"asset":"BTC","checks":{"indexerRow":true,"clobStatusTrading":true,"marketContractRegistered":true,"marketContractHasCode":true},"informational_moduleWindowEnds":"2026-08-12T12:00:00.000Z","informational_moduleIsPastWindow":true}
  PASS ETH 0xdd5a730076397cb1632f4661773ac2faf0d23b5b: {"asset":"ETH","checks":{"indexerRow":true,"clobStatusTrading":true,"marketContractRegistered":true,"marketContractHasCode":true},"informational_moduleWindowEnds":"2026-08-12T16:00:00.000Z","informational_moduleIsPastWindow":true}
CREATION CHECKS: 2/2 live markets pass the (post-fix) creation flow
P0 creation checks RESOLVED (creation not blocked) ✅
