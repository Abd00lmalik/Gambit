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
latest BTC/USDC: [{"spot":"77015075000000000000000","blockTimestamp":"1789045557"}]
#### SECTION 11: ORACLE QUESTION DETAILS
Question fields: undefined
OracleQuestion fields: ["bindCount","binds","createdAtBlock","createdAtTimestamp","id","oracleCost","oracleQuestionId","payoutDenominator","payoutNumerators","questionKey","resolvedAt","resolvedAtBlock","reuseCount","scheduler","supersededByQuestionId","voided"]
#### DEEP DIVE COMPLETE
#### SECTION 12: MODULE RECORD vs INDEXER EXPIRY (staleness pattern)
found 4 live markets

LIVE BTC marketAddress=0xb535e1b9771aebad4bcb6214ccd0c35846a53cdb marketId=0x0000000000000000000000000000000000000000000000000000000000003f75
  indexer: {"marketAddress":"0xb535e1b9771aebad4bcb6214ccd0c35846a53cdb","expiry":1789045800,"expiryISO":"2026-09-10T13:10:00.000Z","tradingStartISO":"2026-09-10T13:05:00.000Z","binaryPoolAddress":"0x363deb12f640de39b0575d158325dad098ba0d02"}
  module:  {"market":"0x47B9d08aD210c48CB5a34D94Da9748D52a227fa2","pool":"0x2E70ff399C771A7aF71948c550684343021e829D","expiry":1786502700,"expiryISO":"2026-08-12T02:45:00.000Z","stale":true,"expiryMatchesIndexer":false}
  binaryPoolAddress probe: {"hasCode":true,"isResolved":"reverted","payoutNumerators":"reverted","expiry":"reverted"}

LIVE ETH marketAddress=0x79ed58b8a29eb73d80fd03bcd58a9c8942ad6b69 marketId=0x0000000000000000000000000000000000000000000000000000000000003f76
  indexer: {"marketAddress":"0x79ed58b8a29eb73d80fd03bcd58a9c8942ad6b69","expiry":1789045800,"expiryISO":"2026-09-10T13:10:00.000Z","tradingStartISO":"2026-09-10T13:05:00.000Z","binaryPoolAddress":"0xc99109a3d4fe89a4b8f81b0f8d7efb595c6da4e5"}
  module:  {"market":"0x24c2a4092d2827E5e2b93Ac9bcc3439Ae9C9E804","pool":"0xa6899DA2a4f43defe2dFbCa25e94a601AEB79848","expiry":1786503600,"expiryISO":"2026-08-12T03:00:00.000Z","stale":true,"expiryMatchesIndexer":false}
  binaryPoolAddress probe: {"hasCode":false,"isResolved":"reverted","payoutNumerators":"reverted","expiry":"reverted"}

LIVE BTC marketAddress=0x6b54e9e8748e13c0c1a01391a23b69cff470f714 marketId=0x0000000000000000000000000000000000000000000000000000000000003f71
  indexer: {"marketAddress":"0x6b54e9e8748e13c0c1a01391a23b69cff470f714","expiry":1789046100,"expiryISO":"2026-09-10T13:15:00.000Z","tradingStartISO":"2026-09-10T13:00:00.000Z","binaryPoolAddress":"0xa475e7cff65bd47c3a0783d071e7075e035048a8"}
  module:  {"market":"0x14cfDff1Fd17AFD39EF295403C455b2E62e644c4","pool":"0x7af10cCf33CA4bb272836542EB762a3FBEE18929","expiry":1786500900,"expiryISO":"2026-08-12T02:15:00.000Z","stale":true,"expiryMatchesIndexer":false}
  binaryPoolAddress probe: {"hasCode":true,"isResolved":"reverted","payoutNumerators":"reverted","expiry":"reverted"}

LIVE ETH marketAddress=0x823141301b91fada2f94c91873f9fae5b11f53c9 marketId=0x0000000000000000000000000000000000000000000000000000000000003f72
  indexer: {"marketAddress":"0x823141301b91fada2f94c91873f9fae5b11f53c9","expiry":1789046100,"expiryISO":"2026-09-10T13:15:00.000Z","tradingStartISO":"2026-09-10T13:00:00.000Z","binaryPoolAddress":"0x4909d1d4487fd2da18cc4af698673b06562d3931"}
  module:  {"market":"0x1e5EDd5E758D1D44B9aAf3D8f25168CA83EB3E7a","pool":"0x2E4Acbd037D5dF1986137797fa94904043542327","expiry":1786501800,"expiryISO":"2026-08-12T02:30:00.000Z","stale":true,"expiryMatchesIndexer":false}
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
