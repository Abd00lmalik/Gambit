// Deep-dive: what actually signals FINAL resolution on DreamDEX markets?
// - OracleAnswer schema + values (final price vs opening price)
// - Market contract event logs (Resolved events) for a settled + a live market
// - Price feed around tradingStart/expiry
import { createPublicClient, http } from "viem";

const RPC = process.env.SOMNIA_RPC || "https://api.infra.testnet.somnia.network";
const client = createPublicClient({ transport: http(RPC, { timeout: 30_000, retryCount: 3 }) });

const DUEL_MARKET = "0x61Dd6bd8C15D6Df32F9C8Beb62400e9e2a76D116"; // idx8 of the reported duel's market
const LIVE_MARKET = "0xAD0Ecd6A4c7e13B811f79eB583EBe6Cc32E5f92d"; // idx8 of a still-trading market
const EXPLORER = "https://shannon-explorer.somnia.network";

async function gql(url, query) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  return res.json();
}

// ── 8. OracleAnswer schema + values ───────────────────────────
console.log("#### SECTION 8: ORACLE ANSWER SCHEMA + VALUES");
const schema = await gql("https://prd.smk.somnia.host/v1/graphql", `{ __type(name: "OracleAnswer") { fields { name type { name kind ofType { name } } } } }`);
console.log("OracleAnswer fields:", JSON.stringify(schema, null, 2));

for (const qid of ["56312", "56301"]) {
  const data = await gql("https://prd.smk.somnia.host/v1/graphql", `{
    OracleAnswer(where: {id: {_eq: "${qid}"}}, limit: 1) { id }
  }`).catch(() => null);
  console.log(`OracleAnswer ${qid} (select-all-safe):`, JSON.stringify(data));
}
// Try common field names based on schema output
const fields = schema?.data?.__type?.fields?.map((f) => f.name) || [];
if (fields.length > 0) {
  const sel = ["id", ...fields.filter((f) => f !== "id")].join(" ");
  for (const qid of ["56312", "56301"]) {
    const data = await gql("https://prd.smk.somnia.host/v1/graphql", `{ OracleAnswer(where: {id: {_eq: "${qid}"}}, limit: 1) { ${sel} } }`).catch((e) => String(e));
    console.log(`OracleAnswer ${qid} full:`, JSON.stringify(data, null, 2));
  }
}

// ── 9. Market contract event logs (the Resolved event trail) ──
console.log("#### SECTION 9: MARKET CONTRACT LOGS (settled duel market)");
async function fetchLogs(addr) {
  const res = await fetch(`${EXPLORER}/api/v2/addresses/${addr}/logs`);
  return res.json();
}
for (const [label, addr] of [["REPORTED DUEL MARKET", DUEL_MARKET], ["LIVE (TRADING) MARKET", LIVE_MARKET]]) {
  try {
    const data = await fetchLogs(addr);
    const items = (data.items || []).slice(0, 30).map((l) => ({
      txHash: l.transaction_hash,
      block: l.block_number,
      timestamp: l.block_timestamp,
      topics: l.topics,
      index: l.index,
    }));
    console.log(`${label} (${addr}) — ${data.items?.length ?? 0} logs (up to 30):`);
    console.log(JSON.stringify(items, null, 2));
  } catch (e) {
    console.log(`${label} log fetch failed:`, String(e?.message || e).slice(0, 200));
  }
}

// Block timestamps for the market's resolution blocks
try {
  const data = await fetchLogs(DUEL_MARKET);
  const blocks = [...new Set((data.items || []).map((l) => l.block_number))];
  for (const b of blocks.slice(0, 10)) {
    const res = await fetch(`${EXPLORER}/api/v2/blocks/${b}`);
    const blk = await res.json();
    console.log(`block ${b}: timestamp=${blk.timestamp}`);
  }
} catch (e) {
  console.log("block timestamp fetch failed:", String(e?.message || e).slice(0, 200));
}

// ── 10. Price feed: opening vs expiry price for the reported duel ──
console.log("#### SECTION 10: PRICE FEED — OPENING (10:15Z) vs EXPIRY (10:30Z) on 2026-09-10");
for (const ts of [1789035300, 1789036200]) {
  const q = `{
    PricePoint(limit: 3, order_by: {blockTimestamp: asc}, where: {feed_id: {_eq: "BTC/USDC"}, blockTimestamp: {_gte: ${ts - 5}, _lte: ${ts + 45}}}) { spot blockTimestamp }
  }`;
  try {
    const data = await gql("https://price-feed.prd.oracle.somnia.host/v1/graphql", q);
    const pts = (data?.data?.PricePoint || []).map((p) => ({
      t: new Date(Number(p.blockTimestamp) * 1000).toISOString(),
      spotUsd: Number(p.spot) / 1e18,
    }));
    console.log(`t=${ts} (${new Date(ts * 1000).toISOString()}):`, JSON.stringify(pts));
  } catch (e) {
    console.log(`price query failed @${ts}:`, String(e?.message || e).slice(0, 150));
  }
}
// Latest price now (sanity — feed is live)
try {
  const q = `{ PricePoint(limit: 1, order_by: {blockTimestamp: desc}, where: {feed_id: {_eq: "BTC/USDC"}}) { spot blockTimestamp } }`;
  const data = await gql("https://price-feed.prd.oracle.somnia.host/v1/graphql", q);
  console.log("latest BTC/USDC:", JSON.stringify(data?.data?.PricePoint));
} catch (e) { console.log("latest price failed:", String(e).slice(0, 100)); }

// ── 11. The duel's oracle question (56312) from prd oracle graph ──
console.log("#### SECTION 11: ORACLE QUESTION DETAILS");
for (const qid of ["56312", "56301"]) {
  for (const base of ["https://prd.smk.somnia.host/v1/graphql", "https://dev.smk.somnia.host/v1/graphql"]) {
    const data = await gql(base, `{ Question(where: {id: {_eq: "${qid}"}}, limit: 1) { id } }`).catch(() => null);
    if (data?.data?.Question) {
      console.log(`Question ${qid} exists on ${base}:`, JSON.stringify(data));
      break;
    }
  }
}
const qSchema = await gql("https://prd.smk.somnia.host/v1/graphql", `{ __type(name: "Question") { fields { name } } }`);
console.log("Question fields:", JSON.stringify(qSchema?.data?.__type?.fields?.map((f) => f.name)));
const oqSchema = await gql("https://prd.smk.somnia.host/v1/graphql", `{ __type(name: "OracleQuestion") { fields { name } } }`);
console.log("OracleQuestion fields:", JSON.stringify(oqSchema?.data?.__type?.fields?.map((f) => f.name)));

console.log("#### DEEP DIVE COMPLETE");

// ── 12. Systematic staleness check: module record expiry vs indexer expiry ──
console.log("#### SECTION 12: MODULE RECORD vs INDEXER EXPIRY (staleness pattern)");
const MODULE = "0x3ecC694Cef705358864a646142ac17A90E29e388";
const MODULE_ABI2 = [{
  name: "markets", type: "function", stateMutability: "view",
  inputs: [{ name: "marketId", type: "bytes32" }],
  outputs: [{
    name: "", type: "tuple", components: [
      { name: "oracleQuestionId", type: "uint256" }, { name: "outcomeSlotCount", type: "uint8" },
      { name: "voidPolicy", type: "uint8" }, { name: "collateral", type: "address" },
      { name: "originOperatorId", type: "uint32" }, { name: "originVenueId", type: "bytes32" },
      { name: "oracleAdapter", type: "address" }, { name: "creator", type: "address" },
      { name: "market", type: "address" }, { name: "pool", type: "address" },
      { name: "yesId", type: "uint256" }, { name: "noId", type: "uint256" },
      { name: "tradingStart", type: "uint64" }, { name: "expiry", type: "uint64" },
    ],
  }],
}];

const now2 = Math.floor(Date.now() / 1000);
const liveQ = `{
  Market(where: {marketType: {_eq: "BINARY"}, clobStatus: {_eq: "Trading"}, expiry: {_gt: ${now2 + 60}}}, order_by: {expiry: asc}, limit: 4) {
    marketAddress marketId asset expiry tradingStart binaryPoolAddress
  }
}`;
const live = await gql("https://prd.smk.somnia.host/v1/graphql", liveQ);
const rows = live?.data?.Market ?? [];
console.log(`found ${rows.length} live markets`);
for (const m of rows) {
  const indexer = {
    marketAddress: m.marketAddress,
    expiry: Number(m.expiry),
    expiryISO: new Date(Number(m.expiry) * 1000).toISOString(),
    tradingStartISO: new Date(Number(m.tradingStart) * 1000).toISOString(),
    binaryPoolAddress: m.binaryPoolAddress,
  };
  console.log(`\nLIVE ${m.asset} marketAddress=${m.marketAddress} marketId=${m.marketId}`);
  console.log("  indexer:", JSON.stringify(indexer));
  try {
    const rec = await client.readContract({ address: MODULE, abi: MODULE_ABI2, functionName: "markets", args: [m.marketId] });
    const moduleInfo = {
      market: rec.market,
      pool: rec.pool,
      expiry: Number(rec.expiry),
      expiryISO: new Date(Number(rec.expiry) * 1000).toISOString(),
      stale: Number(rec.expiry) < now2,
      expiryMatchesIndexer: Math.abs(Number(rec.expiry) - Number(m.expiry)) < 120,
    };
    console.log("  module: ", JSON.stringify(moduleInfo));
  } catch (e) {
    console.log("  module read failed:", String(e?.message || e).slice(0, 120));
  }
  // Probe the indexer's binaryPoolAddress for IBinaryMarket-style views
  if (m.binaryPoolAddress) {
    try {
      const code = await client.getCode({ address: m.binaryPoolAddress });
      const probe = { hasCode: !!(code && code !== "0x") };
      for (const fn of ["isResolved", "payoutNumerators", "expiry"]) {
        try {
          const v = await client.readContract({
            address: m.binaryPoolAddress,
            abi: [{ name: fn, type: "function", stateMutability: "view", inputs: [], outputs: [{ type: fn === "expiry" ? "uint64" : fn === "isResolved" ? "bool" : "uint256[]" }] }],
            functionName: fn,
          });
          probe[fn] = fn === "payoutNumerators" ? v.map(String) : typeof v === "bigint" ? Number(v) : v;
        } catch (e) {
          probe[fn] = "reverted";
        }
      }
      console.log("  binaryPoolAddress probe:", JSON.stringify(probe));
    } catch (e) {
      console.log("  binaryPoolAddress probe failed:", String(e?.message || e).slice(0, 120));
    }
  }
}

// ── 13. The reported duel's market: module vs indexer vs oracle ──
console.log("\n#### SECTION 13: REPORTED DUEL MARKET SUMMARY");
const duelMarketId = "0x0000000000000000000000000000000000000000000000000000000000003f13";
try {
  const rec = await client.readContract({ address: MODULE, abi: MODULE_ABI2, functionName: "markets", args: [duelMarketId] });
  console.log("module record:", JSON.stringify({
    market: rec.market, pool: rec.pool,
    expiry: Number(rec.expiry), expiryISO: new Date(Number(rec.expiry) * 1000).toISOString(),
  }, null, 2));
} catch (e) {
  console.log("module read failed:", String(e?.message || e).slice(0, 120));
}
// Oracle answers (final vs opening) — the ACTUAL resolution data
const ansQ = `{
  OracleAnswer(where: {oracleQuestionId: {_in: ["56312", "56301"]}}) { id numericValue outcomeIdx resolvedAt voided txHash }
}`;
const ansData = await gql("https://prd.smk.somnia.host/v1/graphql", ansQ);
const answers = ansData?.data?.OracleAnswer ?? [];
const final = answers.find((a) => a.oracleQuestionId !== undefined);
console.log("oracle answers:", JSON.stringify(answers, null, 2));
const finalAns = answers.find((a) => a.id === "56312");
const openAns = answers.find((a) => a.id === "56301");
if (finalAns && openAns) {
  const finalCents = Number(finalAns.numericValue);
  const openCents = Number(openAns.numericValue);
  console.log("RESOLUTION MATH: final($", (finalCents / 100), ") vs opening($", (openCents / 100), ") →",
    finalCents >= openCents ? "UP WON (final at or above opening)" : "DOWN WON (final below opening)");
}


// ── 14. Creation checks (post-P0-fix logic) against live markets ──
// Mirrors verifyMarketAddress() after the P0 fix: indexer row + Trading +
// module contract exists. The module-vs-indexer expiry comparison is
// INFORMATIONAL ONLY (module records are slot registrations that don't track
// window rotation — the normal state for every market).
console.log("\n#### SECTION 14: CREATION CHECKS ON LIVE MARKETS (post-fix logic)");
const checkQ = `{
  Market(where: {marketType: {_eq: "BINARY"}, clobStatus: {_eq: "Trading"}, expiry: {_gt: ${now2 + 120}}}, order_by: {expiry: asc}, limit: 6) {
    marketAddress marketId asset expiry clobStatus
  }
}`;
const checkData = await gql("https://prd.smk.somnia.host/v1/graphql", checkQ);
const checkRows = checkData?.data?.Market ?? [];
let checked = 0;
let passedCreation = 0;
const seenKeys = new Set();
for (const m of checkRows) {
  const key = `${m.asset}-${m.expiry}`;
  if (seenKeys.has(key) || checked >= 3) continue;
  seenKeys.add(key);
  checked++;
  const result = { asset: m.asset, checks: {} };
  result.checks.indexerRow = true;
  result.checks.clobStatusTrading = m.clobStatus === "Trading";
  try {
    const rec = await client.readContract({ address: MODULE, abi: MODULE_ABI2, functionName: "markets", args: [m.marketId] });
    const zero = "0x0000000000000000000000000000000000000000";
    const hasCode = rec.market && rec.market !== zero
      ? ((await client.getCode({ address: rec.market })) || "0x") !== "0x"
      : false;
    result.checks.marketContractRegistered = true;
    result.checks.marketContractHasCode = hasCode;
    // informational only — never gates creation
    result.informational_moduleWindowEnds = new Date(Number(rec.expiry) * 1000).toISOString();
    result.informational_moduleIsPastWindow = Number(rec.expiry) < now2;
  } catch (e) {
    result.checks.marketContractRegistered = false;
  }
  const allPass = Object.values(result.checks).every(Boolean);
  if (allPass) passedCreation++;
  console.log(`  ${allPass ? "PASS" : "FAIL"} ${m.asset} ${m.marketAddress}: ${JSON.stringify(result)}`);
}
console.log(`CREATION CHECKS: ${passedCreation}/${checked} live markets pass the (post-fix) creation flow`);
if (passedCreation < 2 || checked < 2) {
  console.log("::error::P0 unresolved — fewer than 2 live markets pass creation checks");
  process.exit(1);
}
console.log("P0 creation checks RESOLVED (creation not blocked) ✅");
