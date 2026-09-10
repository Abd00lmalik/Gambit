// P3 verification: two different wallets → two genuinely different PFPs.
// Exercises the REAL route handlers (app/api/pfp/route.ts POST and
// app/api/pfp/[address]/route.ts GET) with the storage/db backends swapped for
// in-memory mocks via the __setPfpOverrides test seam.
import assert from "node:assert/strict";
import { register } from "node:module";

const blobMock = await import("./mocks/vercel-blob.mjs");
const dbMock = await import("./mocks/db.mjs");
const { __setPfpOverrides } = await import("../lib/pfpStore");
__setPfpOverrides({ blob: blobMock as any, db: dbMock as any });

const { POST } = await import("../app/api/pfp/route");
const { GET } = await import("../app/api/pfp/[address]/route");

const W1 = "0x7e0Af9e55184b2b4bd5bac455493c035d51eee3E"; // player A of the reported duel
const W2 = "0x73092e88D49946ac32b6Eb1a394f81bb553e411a"; // player B of the reported duel
const W_UNKNOWN = "0x1111111111111111111111111111111111111111";

function pngBytes(r, g, b) {
  // Tiny valid PNG (1x1) with a distinctive color — size/content distinguishable
  const b64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42m" +
    "P8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="; // 1x1 baseline png
  const buf = Buffer.from(b64, "base64");
  // Tack on distinct trailing bytes (ignored by decoders, compared by tests)
  return Buffer.concat([buf, Buffer.from([r, g, b])]);
}

async function upload(address: string, bytes: Buffer, type = "image/png", name = "avatar.png") {
  const form = new FormData();
  form.append("file", new Blob([bytes], { type }), name);
  form.append("address", address);
  const req = new Request("http://localhost/api/pfp", { method: "POST", body: form });
  return POST(req as any);
}

async function get(address: string, extraHeaders: Record<string, string> = {}) {
  const req = new Request(`http://localhost/api/pfp/${address}`, { headers: extraHeaders });
  return GET(req as any, { params: { address } } as any);
}

let passed = 0;
function ok(label: string) {
  passed++;
  console.log(`  ✓ ${label}`);
}

console.log("PFP per-wallet independence tests");

// ── 1. Two wallets upload two different images ────────────────
blobMock.__reset();
dbMock.__reset();

const RED = pngBytes(0xff, 0x00, 0x00);
const BLUE = pngBytes(0x00, 0x00, 0xff);

const res1 = await upload(W1, RED);
assert.equal(res1.status, 200, "upload wallet1 should succeed");
const body1 = await res1.json();
assert.ok(body1.pfpUrl.includes("pfps/0x7e0af9e55184b2b4bd5bac455493c035d51eee3e.png"), "wallet1 key is per-address");
ok("upload wallet1 (red) → per-address blob key");

const res2 = await upload(W2, BLUE);
assert.equal(res2.status, 200, "upload wallet2 should succeed");
const body2 = await res2.json();
assert.notEqual(body1.pfpUrl, body2.pfpUrl, "the two uploads must land on different keys");
ok("upload wallet2 (blue) → different storage key");

// ── 2. Each wallet reads back ITS OWN image (core regression) ─
const g1 = await get(W1);
assert.equal(g1.status, 200);
assert.equal(g1.headers.get("content-type"), "image/png");
const g1bytes = Buffer.from(await (g1 as any).arrayBuffer());
assert.ok(g1bytes.equals(RED), "wallet1 must see exactly wallet1's bytes");
assert.equal(g1.headers.get("x-pfp-pathname"), "pfps/0x7e0af9e55184b2b4bd5bac455493c035d51eee3e.png");
ok("GET wallet1 → wallet1's red image");

const g2 = await get(W2);
assert.equal(g2.status, 200);
const g2bytes = Buffer.from(await (g2 as any).arrayBuffer());
assert.ok(g2bytes.equals(BLUE), "wallet2 must see exactly wallet2's bytes");
assert.ok(!g2bytes.equals(g1bytes), "wallet2's image must NOT be wallet1's");
ok("GET wallet2 → wallet2's blue image (not wallet1's)");

// ── 3. Case-insensitive address keying ────────────────────────
const gUpper = await get("0x" + W2.slice(2).toUpperCase());
const gUpperBytes = Buffer.from(await (gUpper as any).arrayBuffer());
assert.ok(gUpperBytes.equals(BLUE), "checksummed address resolves to the same wallet's blob");
ok("GET with checksummed address → same wallet's blob");

// ── 4. Unknown wallet → 404; invalid → 400 ────────────────────
const g404 = await get(W_UNKNOWN);
assert.equal(g404.status, 404, "unknown wallet must 404 (no shared fallback)");
ok("GET unknown wallet → 404 (no shared/fallback key)");

const gBad = await get("not-an-address");
assert.equal(gBad.status, 400);
ok("GET invalid address → 400");

const upBad = await upload("undefined", RED);
assert.equal(upBad.status, 400, "upload with bogus address must be rejected");
ok("POST with bogus address ('undefined') → 400 (no shared key writes)");

// ── 5. Updating wallet1 never changes wallet2 ─────────────────
const GREEN = pngBytes(0x00, 0xff, 0x00);
const res1b = await upload(W1, GREEN);
assert.equal(res1b.status, 200);
const g1b = await get(W1);
const g1bBytes = Buffer.from(await (g1b as any).arrayBuffer());
assert.ok(g1bBytes.equals(GREEN), "wallet1 sees its NEW image after re-upload");
const g2b = await get(W2);
const g2bBytes = Buffer.from(await (g2b as any).arrayBuffer());
assert.ok(g2bBytes.equals(BLUE), "wallet2 STILL sees wallet2's image (no bleed)");
ok("re-upload wallet1 (green) → wallet1 updated, wallet2 untouched");

// ── 6. Extension switch leaves no stale duplicate ─────────────
const WEBP_BYTES = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x99, 0x88, 0x77]);
const resWebp = await upload(W1, WEBP_BYTES, "image/webp", "avatar.webp");
assert.equal(resWebp.status, 200);
const dump1 = blobMock.__dump().filter((e) => e.pathname.startsWith("pfps/0x7e0af9"));
assert.equal(dump1.length, 1, `wallet1 should have exactly ONE blob after ext switch (got ${dump1.length})`);
assert.ok(dump1[0].pathname.endsWith(".webp"));
const gWebp = await get(W1);
assert.equal(gWebp.headers.get("content-type"), "image/webp");
ok("extension switch (png→webp) → stale blob deleted, single blob remains");

// ── 7. Caching: ETag + 304 + per-address cache scope ──────────
const etag = gWebp.headers.get("etag");
assert.ok(etag, "ETag present");
const g304 = await get(W1, { "if-none-match": etag! });
assert.equal(g304.status, 304, "If-None-Match → 304 (bandwidth saver)");
const gFresh = await get(W1, { "if-none-match": '"stale-etag"' });
assert.equal(gFresh.status, 200);
assert.equal(gFresh.headers.get("cache-control"), "public, max-age=60");
ok("ETag/304 + short per-address Cache-Control");

// ── 8. DB records are per-address too ─────────────────────────
const dbRows = dbMock.__dump();
const w1rows = dbRows.filter((r) => r.address === W1.toLowerCase());
const w2rows = dbRows.filter((r) => r.address === W2.toLowerCase());
assert.equal(w1rows.length, 1, "wallet1 has exactly one profile record");
assert.equal(w2rows.length, 1, "wallet2 has exactly one profile record");
assert.notEqual(w1rows[0].pfp_url, w2rows[0].pfp_url, "profile records point at different blobs");
assert.ok(w1rows[0].pfp_url.includes("0x7e0af9"), "wallet1 record → wallet1 blob");
assert.ok(w2rows[0].pfp_url.includes("0x73092e"), "wallet2 record → wallet2 blob");
ok("DB profile records per-address and pointing at distinct blobs");

console.log(`\nALL ${passed} PFP TEST GROUPS PASSED ✅`);
console.log(`  final store: ${JSON.stringify(blobMock.__dump(), null, 2)}`);
