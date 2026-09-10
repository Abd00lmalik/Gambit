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
