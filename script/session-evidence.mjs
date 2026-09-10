// One-off evidence script (run in CI where network is available).
// Traces tonight's test duels end-to-end: on-chain duel state → BinaryMarketsModule
// resolution → what the frontend's detection chain would see; price-feed queries as
// LiveChart issues them; deployed-bundle chart library check; PFP proxy vs DB.

const RPC = "https://api.infra.testnet.somnia.network";
const INDEXER_DEV = "https://dev.smk.somnia.host/v1/graphql";
const INDEXER_PROD = "https://prd.smk.somnia.host/v1/graphql";
const PRICE_FEED = "https://price-feed.prd.oracle.somnia.host/v1/graphql";
const SITE = "https://playgambit.vercel.app";

// selector: keccak256(sig)[0:4]
const S = {
  state: "0xc19d93fb",
  marketId: "0x6ed71ede",
  playerA: "0xa285c54a",
  playerB: "0x11bb1537",
  marketAddress: "0x95623641",
  isResolved: "0xdbb3f537",
  isVoided: "0x8db3db12",
  payoutNumerators: "0x24427007",
  status: "0x200d2ed2",
  joinDeadline: "0xd100b781",
  getPot: "0x403c9fa8",
  marketsBytes32: "0x7564912b", // markets(bytes32)
  resolvedMarketContract: "0x4277a5d0",
};

const MODULE = "0x3ecC694Cef705358864a646142ac17A90E29e388"; // BinaryMarketsModule per SDK + Wager.sol

// Clones from DuelCreated logs (2026-09-10 overnight session), oldest → newest
const CLONES = [
  { clone: "0xe171bdc91d4b442c24a57ec0776605740534514c", label: "duel#1 03:07Z stake 5 STT" },
  { clone: "0xfdbd1bea3922fea60b05ba0750289f96466e3c49", label: "duel#2 04:07Z stake 0.5" },
  { clone: "0xcceadd500e478f60ec01257d29c31af89041f8ce", label: "duel#3 04:17Z stake 0.1" },
  { clone: "0xde242a97277c1dbdeb2ca102592c32d694fd0dad", label: "duel#4 04:25Z stake 5" },
  { clone: "0x3e1aa04d8a759daa49c04abf8771f2c5dd3e1d19", label: "duel#5 04:18Z stake 5" },
  { clone: "0x39add9e67339994461e1d8d27c19cf4a7d0bda13", label: "duel#6 04:53Z stake 5" },
  { clone: "0x02d7d649704f13baa2816d805ae0fb5feb1d2e12", label: "duel#7 05:18Z stake 5" },
  { clone: "0xc277a8128bb755854a730f7a675d43783f377baa", label: "duel#8 05:37Z stake 5" },
  { clone: "0x3a55c77531cbef4fa751864020218d1754b6da40", label: "duel#9 05:43Z stake 2.5" },
  { clone: "0x7f87d009e4db3bcded38fcb43df628d3a0da8712", label: "duel#10 06:07Z stake 5 (latest)" },
];

let idSeq = 0;
async function rpc(method, params) {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++idSeq, method, params }),
  });
  const j = await res.json();
  if (j.error) return { error: j.error.message ?? j.error };
  return { result: j.result };
}

const hexToNum = (h) => (typeof h === "string" && h.startsWith("0x") ? Number(BigInt(h)) : h);

async function call(to, data) {
  const r = await rpc("eth_call", [{ to, data }, "latest"]);
  if (r.error) return { revert: r.error };
  const out = r.result ?? "0x";
  if (out === "0x") return { empty: true };
  return { raw: out };
}

async function code(to) {
  const r = await rpc("eth_getCode", [to, "latest"]);
  return { hasCode: !r.error && !!r.result && r.result !== "0x", len: r.result ? (r.result.length - 2) / 2 : 0 };
}

function decodeUintArray(raw) {
  // ABI-encoded uint256[]: len word + items
  const hex = raw.slice(2);
  const words = hex.match(/.{1,64}/g) || [];
  const n = Number(BigInt("0x" + words[0]));
  return words.slice(1, 1 + n).map((w) => BigInt("0x" + w).toString());
}

function decodeRecord(raw) {
  // markets(bytes32) → tuple of 14 heads (static in this struct) starting at word 0
  const hex = raw.slice(2);
  const words = (hex.match(/.{1,64}/g) || []).map((w) => "0x" + w);
  const addr = (w) => (w ? "0x" + w.slice(-40) : undefined);
  return {
    oracleQuestionId: words[0] ? BigInt(words[0]).toString() : null,
    collateral: addr(words[3]),
    market: addr(words[8]),
    pool: addr(words[9]),
    yesId: words[10] ? BigInt(words[10]).toString() : null,
    noId: words[11] ? BigInt(words[11]).toString() : null,
    tradingStart: words[12] ? Number(BigInt(words[12])) : null,
    expiry: words[13] ? Number(BigInt(words[13])) : null,
    rawWords: words.slice(0, 14),
  };
}

async function gql(url, query) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  return res.json();
}

async function main() {
  const report = {};

  report.rpcBlock = (await rpc("eth_blockNumber", [])).result;

  // ── 1) Duel clones on-chain state + full frontend detection chain ──
  report.duels = [];
  for (const { clone, label } of CLONES) {
    const d = { label, clone };
    const [st, mid, rm, pa, pb] = await Promise.all([
      call(clone, S.state),
      call(clone, S.marketId),
      call(clone, S.resolvedMarketContract),
      call(clone, S.playerA),
      call(clone, S.playerB),
    ]);
    d.state = st.raw !== undefined ? hexToNum(st.raw) : st;
    d.marketId = mid.raw;
    d.resolvedMarketContract_stored = rm.raw ? "0x" + rm.raw.slice(-40) : rm;
    d.playerA = pa.raw ? "0x" + pa.raw.slice(-40) : pa;
    d.playerB = pb.raw ? "0x" + pb.raw.slice(-40) : pb;

    // ── what useResolvedMarketAddress() does: markets(bytes32) on the module ──
    if (mid.raw) {
      const moduleCode = await code(MODULE);
      d.moduleCode = moduleCode;
      const mk = await call(MODULE, S.marketsBytes32 + mid.raw.slice(2));
      if (mk.raw) {
        const rec = decodeRecord(mk.raw);
        d.moduleRecord = { market: rec.market, pool: rec.pool, expiry: rec.expiry, tradingStart: rec.tradingStart, yesId: rec.yesId, noId: rec.noId, oracleQuestionId: rec.oracleQuestionId };
        // frontend useMarketStatus(resolvedMarketAddress= rec.market)
        const [codeMarket, codePool, isRes, payouts, isVoid, status] = await Promise.all([
          code(rec.market),
          rec.pool && rec.pool !== "0x0000000000000000000000000000000000000000" ? code(rec.pool) : null,
          call(rec.market, S.isResolved),
          call(rec.market, S.payoutNumerators),
          call(rec.market, S.isVoided),
          call(rec.market, S.status),
        ]);
        d.marketHasCode = codeMarket;
        d.poolHasCode = codePool;
        d.market_isResolved = isRes.raw !== undefined ? hexToNum(isRes.raw) : isRes;
        d.market_payoutNumerators = payouts.raw ? decodeUintArray(payouts.raw) : payouts;
        d.market_isVoided = isVoid.raw !== undefined ? hexToNum(isVoid.raw) : isVoid;
        d.market_status = status.raw !== undefined ? hexToNum(status.raw) : status;
        if (codePool?.hasCode) {
          const [pRes, pPay] = await Promise.all([call(rec.pool, S.isResolved), call(rec.pool, S.payoutNumerators)]);
          d.pool_isResolved = pRes.raw !== undefined ? hexToNum(pRes.raw) : pRes;
          d.pool_payoutNumerators = pPay.raw ? decodeUintArray(pPay.raw) : pPay;
        }
        // also check the stored resolvedMarketContract if it differs from rec.market
        if (d.resolvedMarketContract_stored && d.resolvedMarketContract_stored !== rec.market && !String(d.resolvedMarketContract_stored).startsWith("{")) {
          const [c2, r2, p2] = await Promise.all([
            code(d.resolvedMarketContract_stored),
            call(d.resolvedMarketContract_stored, S.isResolved),
            call(d.resolvedMarketContract_stored, S.payoutNumerators),
          ]);
          d.storedContract = { addr: d.resolvedMarketContract_stored, code: c2, isResolved: r2.raw !== undefined ? hexToNum(r2.raw) : r2, payouts: p2.raw ? decodeUintArray(p2.raw) : p2 };
        }
      } else {
        d.moduleCall = mk;
      }
    }
    report.duels.push(d);
  }

  // ── 2) DreamDEX indexer rows for these duels' market addresses ──
  const marketAddrs = [...new Set(CLONES.map((c) => c.clone))];
  // we need duel.marketAddress — re-read via marketAddress()
  const mm = {};
  for (const clone of marketAddrs) {
    const r = await call(clone, S.marketAddress);
    if (r.raw) mm[clone] = "0x" + r.raw.slice(-40);
  }
  report.duelMarketAddresses = mm;
  const addrList = [...new Set(Object.values(mm))].map((a) => `"${a}"`).join(",");
  if (addrList) {
    const q = `{ Market(where: {marketAddress: {_in: [${addrList}]}}, limit: 20) { id marketAddress marketId asset question strike indexPrice intervalSec expiry tradingStart clobStatus binaryPoolAddress venueId oracleQuestionId } }`;
    const dev = await gql(INDEXER_DEV, q);
    const prod = await gql(INDEXER_PROD, q);
    report.indexerMarkets = {
      dev: dev?.data?.Market ?? dev?.errors?.[0]?.message ?? null,
      prod: prod?.data?.Market ?? prod?.errors?.[0]?.message ?? null,
    };
  }

  // ── 3) Price feed: exactly as LiveChart queries it (bug hunt) ──
  const liveChartQuery = `{ PricePoint(limit: 200, order_by: {blockTimestamp: asc}, where: {feed_id: {_eq: "BTC/USDC"}}) { spot blockTimestamp } }`;
  const lc = await gql(PRICE_FEED, liveChartQuery);
  const pts = lc?.data?.PricePoint ?? [];
  const nowSec = Math.floor(Date.now() / 1000);
  report.priceFeed = {
    rowsReturned: pts.length,
    firstRow: pts[0] ?? null,
    lastRow: pts[pts.length - 1] ?? null,
    firstAgeHours: pts[0] ? +(((nowSec - Number(pts[0].blockTimestamp)) / 3600).toFixed(1)) : null,
    lastAgeSeconds: pts.length ? nowSec - Number(pts[pts.length - 1].blockTimestamp) : null,
    latestDescQuery: await gql(PRICE_FEED, `{ PricePoint(limit: 5, order_by: {blockTimestamp: desc}, where: {feed_id: {_eq: "BTC/USDC"}}) { spot blockTimestamp } }`),
  };
  // spot scale sanity: /1e18 interpretation
  if (pts.length) {
    const p = Number(pts[pts.length - 1].spot) / 1e18;
    report.priceFeed.btc_ifDivide1e18 = p;
    report.priceFeed.btc_raw = Number(pts[pts.length - 1].spot);
  }

  // ── 4) What's actually deployed on Vercel: tradingview vs lightweight-charts ──
  try {
    const htmlRes = await fetch(`${SITE}/duel/${CLONES[8].clone}`);
    const html = await htmlRes.text();
    const chunks = [...new Set([...html.matchAll(/\/_next\/static\/[^"' ]+\.js/g)].map((m) => m[0]))];
    let tradingviewHits = 0;
    let lightweightHits = 0;
    for (const c of chunks) {
      try {
        const t = await (await fetch(SITE + c)).text();
        if (/tradingview/i.test(t)) tradingviewHits++;
        if (/lightweight-charts|createPriceLine/i.test(t)) lightweightHits++;
      } catch {}
    }
    // also check html itself
    if (/tradingview/i.test(html)) tradingviewHits++;
    report.deployed = {
      pageStatus: htmlRes.status,
      xVercelId: htmlRes.headers.get("x-vercel-id"),
      lastModified: htmlRes.headers.get("last-modified") ?? htmlRes.headers.get("x-vercel-cache"),
      chunkCount: chunks.length,
      tradingviewHits,
      lightweightHits,
      htmlContainsIframe: html.includes("tradingview"),
    };
  } catch (e) {
    report.deployed = { error: String(e) };
  }

  // ── 5) PFP: deployed proxy vs DB truth (extension mismatch check) ──
  for (const a of ["0x7e0af9e55184b2b4bd5bac455493c035d51eee3e", "0x73092e88d49946ac32b6eb1a394f81bb553e411a"]) {
    try {
      const prof = await fetch(`${SITE}/api/profile?address=${a}`).then((r) => r.json());
      const p = await fetch(`${SITE}/api/pfp/${a}`, { method: "GET" });
      report[`pfp_${a.slice(0, 8)}`] = {
        dbPfpUrl: prof?.profile?.pfp_url ?? null,
        updatedAt: prof?.profile?.updated_at ?? null,
        proxyStatus: p.status,
        proxyContentType: p.headers.get("content-type"),
      };
    } catch (e) {
      report[`pfp_${a.slice(0, 8)}`] = { error: String(e) };
    }
  }

  console.log("====EVIDENCE-REPORT====");
  console.log(JSON.stringify(report, null, 2));
  console.log("====END-EVIDENCE-REPORT====");
}

main().catch((e) => {
  console.error("EVIDENCE FAILED:", e);
  process.exit(1);
});
