// On-chain + indexer investigation for the premature-settlement bug report.
// Runs in GitHub Actions (sandbox blocks the RPC).
// Outputs a JSON + human-readable report to the workflow log.
import { createPublicClient, http, formatEther } from "viem";

const RPC = process.env.SOMNIA_RPC || "https://api.infra.testnet.somnia.network";
const client = createPublicClient({ transport: http(RPC, { timeout: 30_000, retryCount: 3 }) });

const DUEL = (process.env.DUEL || "0xe0ab413d485c80256dc46a07ba483bb85850fbf5").toLowerCase();
const MODULE = "0x3ecC694Cef705358864a646142ac17A90E29e388";
const FACTORY = "0x089079B21dD6A495D4c3f6844ABCab806fcf5d9E";

const WAGER_ABI = [
  { name: "playerA", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { name: "playerB", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { name: "state", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { name: "marketId", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "bytes32" }] },
  { name: "marketAddress", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { name: "getPot", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "resolvedMarketContract", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { name: "joinDeadline", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "stakeAmount", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
];

const MARKET_ABI = [
  { name: "isResolved", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { name: "isVoided", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { name: "payoutNumerators", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256[]" }] },
  { name: "status", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
];

const MODULE_ABI = [
  {
    name: "markets",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "marketId", type: "bytes32" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "oracleQuestionId", type: "uint256" },
          { name: "outcomeSlotCount", type: "uint8" },
          { name: "voidPolicy", type: "uint8" },
          { name: "collateral", type: "address" },
          { name: "originOperatorId", type: "uint32" },
          { name: "originVenueId", type: "bytes32" },
          { name: "oracleAdapter", type: "address" },
          { name: "creator", type: "address" },
          { name: "market", type: "address" },
          { name: "pool", type: "address" },
          { name: "yesId", type: "uint256" },
          { name: "noId", type: "uint256" },
          { name: "tradingStart", type: "uint64" },
          { name: "expiry", type: "uint64" },
        ],
      },
    ],
  },
];

async function gql(url, query) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  return res.json();
}

const hasCode = async (addr) => {
  const code = await client.getCode({ address: addr });
  return !!(code && code !== "0x");
};

async function marketSnapshot(addr) {
  if (!addr || addr === "0x0000000000000000000000000000000000000000") return { addr, zero: true };
  const out = { addr, hasCode: await hasCode(addr) };
  if (!out.hasCode) return out;
  for (const fn of ["isResolved", "isVoided", "payoutNumerators", "status"]) {
    try {
      const v = await client.readContract({ address: addr, abi: MARKET_ABI, functionName: fn });
      out[fn] = fn === "payoutNumerators" ? v.map(String) : typeof v === "bigint" ? Number(v) : v;
    } catch (e) {
      out[fn] = "ERR: " + String(e?.message || e).slice(0, 120);
    }
  }
  return out;
}

// ── 1. Duel clone state ───────────────────────────────────────
console.log("#### SECTION 1: DUEL CLONE STATE");
const [playerA, playerB, state, marketId, rawMarketAddress, pot, resolvedContract, joinDeadline, stakeAmount] =
  await Promise.all([
    client.readContract({ address: DUEL, abi: WAGER_ABI, functionName: "playerA" }),
    client.readContract({ address: DUEL, abi: WAGER_ABI, functionName: "playerB" }),
    client.readContract({ address: DUEL, abi: WAGER_ABI, functionName: "state" }),
    client.readContract({ address: DUEL, abi: WAGER_ABI, functionName: "marketId" }),
    client.readContract({ address: DUEL, abi: WAGER_ABI, functionName: "marketAddress" }),
    client.readContract({ address: DUEL, abi: WAGER_ABI, functionName: "getPot" }),
    client.readContract({ address: DUEL, abi: WAGER_ABI, functionName: "resolvedMarketContract" }),
    client.readContract({ address: DUEL, abi: WAGER_ABI, functionName: "joinDeadline" }),
    client.readContract({ address: DUEL, abi: WAGER_ABI, functionName: "stakeAmount" }),
  ]);
const duelInfo = {
  duel: DUEL,
  playerA,
  playerB,
  state: Number(state),
  stake: formatEther(stakeAmount),
  pot: formatEther(pot),
  rawMarketAddress,
  resolvedMarketContract: resolvedContract,
  marketId,
  joinDeadline: Number(joinDeadline),
  joinDeadlineISO: new Date(Number(joinDeadline) * 1000).toISOString(),
};
console.log(JSON.stringify(duelInfo, null, 2));

// ── 2. Market record from BinaryMarketsModule ─────────────────
console.log("#### SECTION 2: MARKET RECORD");
const rec = await client.readContract({ address: MODULE, abi: MODULE_ABI, functionName: "markets", args: [marketId] });
const recInfo = {
  market: rec.market,
  pool: rec.pool,
  yesId: String(rec.yesId),
  noId: String(rec.noId),
  tradingStart: Number(rec.tradingStart),
  tradingStartISO: new Date(Number(rec.tradingStart) * 1000).toISOString(),
  expiry: Number(rec.expiry),
  expiryISO: new Date(Number(rec.expiry) * 1000).toISOString(),
};
console.log(JSON.stringify(recInfo, null, 2));

// ── 3. Resolution state on market (idx 8) and pool (idx 9) ────
console.log("#### SECTION 3: RESOLUTION STATE (final, on-chain)");
console.log("market(idx8):", JSON.stringify(await marketSnapshot(rec.market), null, 2));
console.log("pool(idx9):  ", JSON.stringify(await marketSnapshot(rec.pool), null, 2));
console.log("raw duel.marketAddress:", JSON.stringify(await marketSnapshot(rawMarketAddress), null, 2));

// ── 4. THE SMOKING GUN EXPERIMENT ─────────────────────────────
// The duel page treats "payoutNumerators non-zero" as proof of resolution
// (effectiveIsResolved = isResolved || poolMarket.isResolved || marketHasPayouts || poolHasPayouts).
// If a market that is STILL TRADING returns non-zero payouts on market or pool, the UI
// would show the winner popup before resolution. Probe live markets right now.
console.log("#### SECTION 4: LIVE-MARKET PAYOUT PROBE (markets that have NOT expired yet)");
const now = Math.floor(Date.now() / 1000);
const liveQuery = `{
  Market(where: {marketType: {_eq: "BINARY"}, clobStatus: {_eq: "Trading"}, expiry: {_gt: ${now + 60}}}, order_by: {expiry: asc}, limit: 5) {
    marketAddress marketId asset expiry question
  }
}`;
for (const url of ["https://prd.smk.somnia.host/v1/graphql", "https://dev.smk.somnia.host/v1/graphql"]) {
  try {
    const data = await gql(url, liveQuery);
    const markets = data?.data?.Market ?? [];
    console.log(`Indexer ${url}: ${markets.length} live markets`);
    if (markets.length > 0) {
      for (const m of markets.slice(0, 5)) {
        console.log(`  live market: ${m.marketAddress} ${m.asset} expiry=${m.expiry} (${Math.round((m.expiry - now) / 60)}min away) q="${String(m.question).slice(0, 60)}"`);
        try {
          const r = await client.readContract({ address: MODULE, abi: MODULE_ABI, functionName: "markets", args: [m.marketId] });
          console.log(`    idx8=${r.market} idx9=${r.pool}`);
          console.log("    market probe:", JSON.stringify(await marketSnapshot(r.market)));
          console.log("    pool probe:  ", JSON.stringify(await marketSnapshot(r.pool)));
        } catch (e) {
          console.log("    probe failed:", String(e?.message || e).slice(0, 150));
        }
      }
      break;
    }
  } catch (e) {
    console.log(`Indexer ${url} failed: ${String(e?.message || e).slice(0, 100)}`);
  }
}

// ── 5. DreamDEX indexer: the duel's market row + oracle answer ─
console.log("#### SECTION 5: DREAMDEX INDEXER DATA (final resolved outcome)");
const mAddr = String(rawMarketAddress).toLowerCase();
for (const url of ["https://prd.smk.somnia.host/v1/graphql", "https://dev.smk.somnia.host/v1/graphql"]) {
  const data = await gql(url, `{
    Market(where: {marketAddress: {_eq: "${mAddr}"}}, limit: 1) {
      id marketAddress marketId asset question strike indexPrice intervalSec expiry tradingStart clobStatus oracleQuestionId binaryPoolAddress
    }
  }`).catch((e) => ({ errors: [String(e)] }));
  console.log(`Indexer ${url}:`, JSON.stringify(data, null, 2));
  const m = data?.data?.Market?.[0];
  if (m?.oracleQuestionId) {
    // Oracle answer = the FINAL settlement value DreamDEX used
    const ansData = await gql(url, `{ OracleAnswer(where: {id: {_eq: "${m.oracleQuestionId}"}}, limit: 1) { id numericValue value answeredAt } }`).catch(() => null);
    console.log("OracleAnswer:", JSON.stringify(ansData, null, 2));
    // Also try the reference link pattern the app uses
    const refData = await gql(url, `{ MarketReferenceLink(where: {market_id: {_eq: "${m.id}"}}, limit: 1) { referenceQuestionId } }`).catch(() => null);
    console.log("MarketReferenceLink:", JSON.stringify(refData, null, 2));
    if (refData?.data?.MarketReferenceLink?.[0]?.referenceQuestionId) {
      const rid = refData.data.MarketReferenceLink[0].referenceQuestionId;
      const ans2 = await gql(url, `{ OracleAnswer_by_pk(id: "${rid}") { id numericValue value } }`).catch(() => null);
      console.log("OracleAnswer_by_pk:", JSON.stringify(ans2, null, 2));
    }
  }
  if (m) break;
}

// ── 6. Price at expiry (what SHOULD have determined the winner) ─
console.log("#### SECTION 6: PRICE FEED AT EXPIRY vs STRIKE");
const priceQuery = `{
  PricePoint(limit: 1, order_by: {blockTimestamp: asc}, where: {feed_id: {_eq: "${duelAsset(recInfo)}/USDC"}, blockTimestamp: {_gte: ${recInfo.expiry - 20}, _lte: ${recInfo.expiry + 20}}}) { spot blockTimestamp }
}`;
function duelAsset(rec) {
  return "BTC"; // refined below once we know the asset from section 5
}
// Re-run with correct asset once known (section 5 printed it); do a best-effort for BTC and ETH
for (const asset of ["BTC", "ETH"]) {
  const q = `{
    PricePoint(limit: 2, order_by: {blockTimestamp: asc}, where: {feed_id: {_eq: "${asset}/USDC"}, blockTimestamp: {_gte: ${recInfo.expiry - 30}, _lte: ${recInfo.expiry + 30}}}) { spot blockTimestamp }
  }`;
  for (const url of ["https://price-feed.prd.oracle.somnia.host/v1/graphql"]) {
    try {
      const data = await gql(url, q);
      console.log(`${asset} price at expiry:`, JSON.stringify(data, null, 2));
    } catch (e) {
      console.log(`${asset} price query failed:`, String(e?.message || e).slice(0, 100));
    }
  }
}

// ── 7. Clone transaction history from the explorer ────────────
console.log("#### SECTION 7: CLONE TX HISTORY (explorer API)");
try {
  const res = await fetch(`https://shannon-explorer.somnia.network/api/v2/addresses/${DUEL}/transactions`);
  const data = await res.json();
  const items = (data.items || []).map((t) => ({
    hash: t.hash,
    from: t.from?.hash,
    to: t.to?.hash,
    value: t.value,
    method: t.method,
    status: t.status,
    timestamp: t.timestamp,
    block: t.block_number,
    result: t.result,
    revert_reason: t.revert_reason,
    decoded_input: t.decoded_input ? Object.keys(t.decoded_input) : undefined,
  }));
  console.log(JSON.stringify(items, null, 2));
} catch (e) {
  console.log("explorer tx fetch failed:", String(e?.message || e).slice(0, 200));
}
// Internal txns (settlement payouts)
try {
  const res = await fetch(`https://shannon-explorer.somnia.network/api/v2/addresses/${DUEL}/internal-transactions`);
  const data = await res.json();
  const items = (data.items || []).map((t) => ({
    from: t.from?.hash, to: t.to?.hash, value: t.value, type: t.type, block: t.block_number,
  }));
  console.log("INTERNAL TXNS:", JSON.stringify(items, null, 2));
} catch (e) {
  console.log("explorer internal tx fetch failed:", String(e?.message || e).slice(0, 200));
}

console.log("#### INVESTIGATION COMPLETE");
