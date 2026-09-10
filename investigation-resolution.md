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
latest BTC/USDC: [{"spot":"77170035000000000000000","blockTimestamp":"1789048425"}]
#### SECTION 11: ORACLE QUESTION DETAILS
Question fields: undefined
OracleQuestion fields: ["bindCount","binds","createdAtBlock","createdAtTimestamp","id","oracleCost","oracleQuestionId","payoutDenominator","payoutNumerators","questionKey","resolvedAt","resolvedAtBlock","reuseCount","scheduler","supersededByQuestionId","voided"]
#### DEEP DIVE COMPLETE
#### SECTION 12: MODULE RECORD vs INDEXER EXPIRY (staleness pattern)
found 4 live markets

LIVE BTC marketAddress=0x732ad78cf4fb251057574eda8e4b4a66af176d23 marketId=0x0000000000000000000000000000000000000000000000000000000000003f8d
  indexer: {"marketAddress":"0x732ad78cf4fb251057574eda8e4b4a66af176d23","expiry":1789048500,"expiryISO":"2026-09-10T13:55:00.000Z","tradingStartISO":"2026-09-10T13:50:00.000Z","binaryPoolAddress":"0xa475e7cff65bd47c3a0783d071e7075e035048a8"}
  module:  {"market":"0xA1608AC8E740a2EAF8AD43110D12eddd320E85AE","pool":"0x713F702CE50EE264af12Ad0bcB94edeaaB5F3a95","expiry":1786510800,"expiryISO":"2026-08-12T05:00:00.000Z","stale":true,"expiryMatchesIndexer":false}
  binaryPoolAddress probe: {"hasCode":true,"isResolved":"reverted","payoutNumerators":"reverted","expiry":"reverted"}

LIVE ETH marketAddress=0xf0b6f09b6ac55858c4ea01cdd51931b6d74a028e marketId=0x0000000000000000000000000000000000000000000000000000000000003f8e
  indexer: {"marketAddress":"0xf0b6f09b6ac55858c4ea01cdd51931b6d74a028e","expiry":1789048500,"expiryISO":"2026-09-10T13:55:00.000Z","tradingStartISO":"2026-09-10T13:50:00.000Z","binaryPoolAddress":"0x4909d1d4487fd2da18cc4af698673b06562d3931"}
  module:  {"market":"0xbF1703142f3cea124239aa055450973aA66fBC73","pool":"0xc5e58A73162b4F304C47c49b4db8aB123ee701Cb","expiry":1786514400,"expiryISO":"2026-08-12T06:00:00.000Z","stale":true,"expiryMatchesIndexer":false}
  binaryPoolAddress probe: {"hasCode":false,"isResolved":"reverted","payoutNumerators":"reverted","expiry":"reverted"}

LIVE BTC marketAddress=0xeec56fc701d668e8d05bdaf8689ab44037633405 marketId=0x0000000000000000000000000000000000000000000000000000000000003f6f
  indexer: {"marketAddress":"0xeec56fc701d668e8d05bdaf8689ab44037633405","expiry":1789048800,"expiryISO":"2026-09-10T14:00:00.000Z","tradingStartISO":"2026-09-10T13:00:00.000Z","binaryPoolAddress":"0x30b6141d96fe4250e26402de17e5495fa87117d7"}
  module:  {"market":"0x12cD1Ff5f425468dB46A527a109FaDb7e0175359","pool":"0x56275310dA4e7991CAc79B7CEdcb034Aba51f897","expiry":1786503600,"expiryISO":"2026-08-12T03:00:00.000Z","stale":true,"expiryMatchesIndexer":false}
  binaryPoolAddress probe: {"hasCode":false,"isResolved":"reverted","payoutNumerators":"reverted","expiry":"reverted"}

LIVE ETH marketAddress=0xd4a6f57c00c845dd19119e62bc88f2683d4bcb43 marketId=0x0000000000000000000000000000000000000000000000000000000000003f70
  indexer: {"marketAddress":"0xd4a6f57c00c845dd19119e62bc88f2683d4bcb43","expiry":1789048800,"expiryISO":"2026-09-10T14:00:00.000Z","tradingStartISO":"2026-09-10T13:00:00.000Z","binaryPoolAddress":"0xe72e628a56d48f11cf37fbedb47ef11a40721bc1"}
  module:  {"market":"0xD7f874a72837D63b3F756067319BC6dED2792Db3","pool":"0x11CF2A7458A7522fd606C0BC685D4BAB18F0096A","expiry":1786500900,"expiryISO":"2026-08-12T02:15:00.000Z","stale":true,"expiryMatchesIndexer":false}
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
