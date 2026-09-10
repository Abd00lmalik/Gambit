// TEMPORARY — debug probe for this PR's live verification. Do NOT merge.
// Read-only checks replicating the frontend's detection chain against tonight's
// test duels + proving the PFP proxy/blob situation. Delete after debugging.
import { NextRequest, NextResponse } from "next/server";

const RPC = "https://api.infra.testnet.somnia.network";
const PRICE_FEED = "https://price-feed.prd.oracle.somnia.host/v1/graphql";
const MODULE = "0x3ecC694Cef705358864a646142ac17A90E29e388";
const S = {
  state: "0xc19d93fb",
  marketId: "0x6ed71ede",
  isResolved: "0xdbb3f537",
  isVoided: "0x8db3db12",
  payoutNumerators: "0x24427007",
  status: "0x200d2ed2",
  marketsBytes32: "0x7564912b",
  resolvedMarketContract: "0x4277a5d0",
};

let idSeq = 0;
async function rpc(method: string, params: any[]) {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++idSeq, method, params }),
  });
  const j = await res.json();
  return j.error ? { error: j.error.message ?? j.error } : { result: j.result };
}
async function call(to: string, data: string) {
  const r = await rpc("eth_call", [{ to, data }, "latest"]);
  if (r.error) return { revert: String(r.error).slice(0, 160) };
  return { raw: r.result };
}
async function getCode(to: string) {
  const r = await rpc("eth_getCode", [to, "latest"]);
  return { hasCode: !r.error && !!r.result && r.result !== "0x", bytes: r.result ? (r.result.length - 2) / 2 : 0 };
}
const word = (raw: string, i: number) => "0x" + (raw.slice(2).match(/.{1,64}/g) ?? [])[i];
const asNum = (raw?: string) => (typeof raw === "string" && raw.length > 2 ? parseInt(raw, 16) : raw === "0x" ? null : undefined);
const asAddr = (raw?: string) => (raw && raw.length >= 66 ? "0x" + raw.slice(-40) : undefined);
function decodePayouts(raw?: string) {
  if (!raw || raw === "0x") return [];
  const words = raw.slice(2).match(/.{1,64}/g) ?? [];
  const n = words[0] ? Number(BigInt(words[0])) : 0;
  return words.slice(1, 1 + n).map((w) => (w ? BigInt("0x" + w).toString() : "0"));
}

// Tonight's duels (DuelCreated → clones), with the marketId (bytes32) each clone stores.
const DUELS = [
  { name: "duel#6 04:53Z", clone: "0x39add9e67339994461e1d8d27c19cf4a7d0bda13" },
  { name: "duel#7 05:18Z", clone: "0x02d7d649704f13baa2816d805ae0fb5feb1d2e12" },
  { name: "duel#8 05:37Z", clone: "0xc277a8128bb755854a730f7a675d43783f377baa" },
  { name: "duel#9 05:43Z", clone: "0x3a55c77531cbef4fa751864020218d1754b6da40" },
  { name: "duel#10 latest", clone: "0x7f87d009e4db3bcded38fcb43df628d3a0da8712" },
];

async function probeDuel(d: { name: string; clone: string }) {
  const [st, mid, stored] = await Promise.all([
    call(d.clone, S.state),
    call(d.clone, S.marketId),
    call(d.clone, S.resolvedMarketContract),
  ]);
  const out: any = {
    ...d,
    state: asNum(st.raw),
    marketId: mid.raw,
    storedMarket: asAddr(stored.raw) ?? stored.revert ?? stored,
  };
  if (!mid.raw || mid.raw === "0x" || /^0x0+$/.test(mid.raw)) return out;

  // module.markets(marketId) — exactly what useResolvedMarketAddress does
  const rec = await call(MODULE, S.marketsBytes32 + mid.raw.slice(2));
  if (rec.revert) {
    out.moduleCall = { revert: rec.revert };
  } else if (rec.raw) {
    const words = rec.raw.slice(2).match(/.{1,64}/g) ?? [];
    out.moduleRecord = { wordCount: words.length, market: asAddr(word(rec.raw, 8)), pool: asAddr(word(rec.raw, 9)) };
    const targets: Record<string, string | undefined> = {
      stored: out.storedMarket && !out.storedMarket.revert ? out.storedMarket : undefined,
      module_market: out.moduleRecord.market,
      module_pool: out.moduleRecord.pool,
    };
    out.reads = {};
    for (const [label, addr] of Object.entries(targets)) {
      if (!addr || addr === "0x0000000000000000000000000000000000000000") continue;
      const [code, isRes, isVoid, payouts, status] = await Promise.all([
        getCode(addr),
        call(addr, S.isResolved),
        call(addr, S.isVoided),
        call(addr, S.payoutNumerators),
        call(addr, S.status),
      ]);
      out.reads[label] = {
        addr,
        hasCode: code.hasCode,
        isResolved: isRes.raw !== undefined ? asNum(isRes.raw) : isRes.revert,
        isVoided: isVoid.raw !== undefined ? asNum(isVoid.raw) : isVoid.revert,
        payoutNumerators: payouts.raw !== undefined ? decodePayouts(payouts.raw) : payouts.revert,
        status: status.raw !== undefined ? asNum(status.raw) : status.revert,
      };
    }
  }
  return out;
}

async function probePriceFeed() {
  // OLD query (as shipped): limit 200, order ASC → oldest rows in the table.
  const oldQ = `{ PricePoint(limit: 200, order_by: {blockTimestamp: asc}, where: {feed_id: {_eq: "BTC/USDC"}}) { spot blockTimestamp } }`;
  // NEW query: latest rows, descending.
  const newQ = `{ PricePoint(limit: 1000, order_by: {blockTimestamp: desc}, where: {feed_id: {_eq: "BTC/USDC"}}) { spot blockTimestamp } }`;
  const run = async (query: string) => {
    const res = await fetch(PRICE_FEED, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query }) });
    const j = await res.json();
    const rows = j?.data?.PricePoint ?? [];
    const now = Math.floor(Date.now() / 1000);
    const first = rows[0], last = rows[rows.length - 1];
    return {
      count: rows.length,
      firstTs: first ? Number(first.blockTimestamp) : null,
      firstAgeH: first ? +(((now - Number(first.blockTimestamp)) / 3600).toFixed(1)) : null,
      lastTs: last ? Number(last.blockTimestamp) : null,
      lastAgeS: last ? now - Number(last.blockTimestamp) : null,
      firstSpot: first ? Number(first.spot) / 1e18 : null,
      lastSpot: last ? Number(last.spot) / 1e18 : null,
      errors: j?.errors ?? undefined,
    };
  };
  return { oldAscQuery: await run(oldQ), newDescQuery: await run(newQ) };
}

async function probePfp() {
  const addr = "0x7e0af9e55184b2b4bd5bac455493c035d51eee3e";
  const { getDownloadUrl } = await import("@vercel/blob");
  const { getPfpBlobPath } = await import("@/lib/db");
  const out: any = {};
  out.storedPathFromDb = await getPfpBlobPath(addr);
  for (const ext of ["jpg", "jpeg", "png", "webp", "gif"]) {
    try {
      const url = getDownloadUrl(`pfps/${addr}.${ext}`);
      const r = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(8000) });
      out[`blob_${ext}`] = r.status;
    } catch (e: any) {
      out[`blob_${ext}`] = String(e?.message ?? e).slice(0, 100);
    }
  }
  if (out.storedPathFromDb) {
    try {
      const r = await fetch(getDownloadUrl(out.storedPathFromDb), { signal: AbortSignal.timeout(8000) });
      out.storedPathFetch = { status: r.status, type: r.headers.get("content-type"), bytes: r.ok ? (await r.arrayBuffer()).byteLength : undefined };
    } catch (e: any) {
      out.storedPathFetch = { error: String(e?.message ?? e).slice(0, 100) };
    }
  }
  // Synthetic end-to-end: save → resolve exact path → serve → cleanup.
  const testAddr = "0x000000000000000000000000000000000000dead";
  try {
    const png = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0));
    const { put, del } = await import("@vercel/blob");
    const { updateProfilePfp } = await import("@/lib/db");
    const blob = await put(`pfps/${testAddr}.jpeg`, new Blob([png], { type: "image/jpeg" }), { access: "private", contentType: "image/jpeg", addRandomSuffix: false, allowOverwrite: true });
    await updateProfilePfp(testAddr, blob.url); // NOTE: legacy-style .jpeg path on purpose — the new getPfpBlobPath must still find it
    out.synthetic = { savedPath: `pfps/${testAddr}.jpeg` };
    out.synthetic.resolvedPath = await getPfpBlobPath(testAddr);
    const served = await fetch(getDownloadUrl(`pfps/${testAddr}.jpeg`));
    out.synthetic.serveStatus = served.status;
    await del(`pfps/${testAddr}.jpeg`);
    await updateProfilePfp(testAddr, "");
  } catch (e: any) {
    out.synthetic = { error: String(e?.message ?? e).slice(0, 200) };
  }
  return out;
}

export async function GET(req: NextRequest) {
  const only = req.nextUrl.searchParams.get("only");
  const out: any = { ts: new Date().toISOString(), rpcBlock: (await rpc("eth_blockNumber", [])).result };
  try {
    if (!only || only === "duels") out.duels = await Promise.all(DUELS.map(probeDuel));
    if (!only || only === "feed") out.priceFeed = await probePriceFeed();
    if (!only || only === "pfp") out.pfp = await probePfp();
  } catch (e: any) {
    out.error = String(e?.stack ?? e).slice(0, 500);
  }
  return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
}
