// Regression tests for the chart data pipeline and the DuelCreated event topic.
// Run: npx tsx scripts/test-chart-data.mts
import assert from "node:assert/strict";
import {
  bucketSizeFor,
  bucketKey,
  buildCandles,
  fetchWindowPoints,
  FEED_PAGE_LIMIT,
} from "../lib/chartData";
import { toEventSelector } from "viem";
import { FACTORY_ABI } from "../lib/contracts";

let passed = 0;
function ok(label: string) {
  passed++;
  console.log(`  ✓ ${label}`);
}

// ── 1. OHLC math: open = first, close = last, high = max, low = min ──
{
  const points = [
    { spot: "1000000000000000000", blockTimestamp: 100 }, // 1.00
    { spot: "3000000000000000000", blockTimestamp: 130 }, // 3.00
    { spot: "2000000000000000000", blockTimestamp: 110 }, // 2.00
    { spot: "500000000000000000",  blockTimestamp: 150 }, // 0.50 (next bucket @60s)
    { spot: "4000000000000000000", blockTimestamp: 119 }, // 4.00 (out of order — must sort)
  ];
  const candles = buildCandles(points, 60);
  assert.equal(candles.length, 2);
  const [c0, c1] = candles;
  // Bucket [60,120): points 1.00@100, 2.00@110, 4.00@119 (out-of-order input)
  assert.equal(c0.time, 60);
  assert.equal(c0.open, 1.0, "open = first price chronologically");
  assert.equal(c0.high, 4.0, "high = max price in bucket");
  assert.equal(c0.low, 1.0, "low = min price in bucket");
  assert.equal(c0.close, 4.0, "close = last price chronologically in bucket");
  // Bucket [120,180): points 3.00@130, 0.50@150
  assert.equal(c1.open, 3.0);
  assert.equal(c1.high, 3.0);
  assert.equal(c1.low, 0.5);
  assert.equal(c1.close, 0.5);
  ok("buildCandles: OHLC from chronological order (input order agnostic)");
}

// ── 2. Bucket keys are stable UTC-second boundaries ──
{
  assert.equal(bucketKey(1789056348, 60), 1789056300);
  assert.equal(bucketKey(1789056300, 60), 1789056300);
  assert.equal(bucketKey(0, 10), 0);
  ok("bucketKey: floor-to-boundary in UTC seconds");
}

// ── 3. Bucket selection yields ~trading-view density ──
{
  const dense = Array.from({ length: 300 }, (_, i) => ({
    spot: "1000000000000000000",
    blockTimestamp: i * 3, // 15 min window
  }));
  assert.equal(bucketSizeFor(dense), 10);
  const medium = Array.from({ length: 300 }, (_, i) => ({
    spot: "1000000000000000000",
    blockTimestamp: i * 9, // 45 min window
  }));
  assert.equal(bucketSizeFor(medium), 30);
  const wide = Array.from({ length: 300 }, (_, i) => ({
    spot: "1000000000000000000",
    blockTimestamp: i * 24, // 2h window
  }));
  assert.equal(bucketSizeFor(wide), 60);
  ok("bucketSizeFor: 10s/30s/60s by span");
}

// ── 4. DESC paging covers the full window (regression: asc+cap dropped the
//      most recent data and left a multi-hour hole before "now") ──
{
  // Simulated feed: 6000 points across 2h, server cap 5000 rows/query.
  const WINDOW = 7200;
  const now = 1_789_056_000;
  const perSec = 6000 / WINDOW;
  const all: { spot: string; blockTimestamp: number }[] = [];
  for (let i = 0; i < 6000; i++) {
    const ts = now - WINDOW + Math.floor(i / perSec);
    all.push({ spot: "1000000000000000000", blockTimestamp: ts });
  }
  const server = (_url: string, init: any) => {
    const query = JSON.parse(init.body).query as string;
    const since = Number(/_gte: (\d+)/.exec(query)![1]);
    const before = Number(/_lt: (\d+)/.exec(query)![1]);
    const rows = all
      .filter((p) => p.blockTimestamp >= since && p.blockTimestamp < before)
      .sort((a, b) => b.blockTimestamp - a.blockTimestamp) // desc
      .slice(0, FEED_PAGE_LIMIT); // row cap
    return Promise.resolve(new Response(JSON.stringify({ data: { PricePoint: rows } })));
  };
  const points = await fetchWindowPoints("BTC", now, server as any);
  assert.ok(points.length > 5000, `paged fetch should exceed one page (got ${points.length})`);
  const newest = Math.max(...points.map((p) => Number(p.blockTimestamp)));
  assert.ok(newest >= now - 60, `newest point must be recent (got ${newest} vs now ${now})`);
  const candles = buildCandles(points, 60);
  const last = candles[candles.length - 1];
  assert.ok(last.time >= now - 120, "last candle must be at 'now', not 85 minutes ago");
  ok("fetchWindowPoints: 2-page desc fetch reaches 'now' (no trailing hole)");
}

// ── 5. The event the frontend listens for IS the event the factory emits.
//      Regression: hardcoded 0x068f7dba… (pre-creatorIsUp signature) never
//      matched, so the invite link degraded to /arena?highlight=… and the
//      Arena listing found zero duels. ──
{
  const duelCreated = FACTORY_ABI.find(
    (item: any) => item.type === "event" && item.name === "DuelCreated"
  );
  assert.ok(duelCreated, "FACTORY_ABI must declare DuelCreated");
  const topic = toEventSelector(duelCreated as any);
  assert.equal(
    topic,
    "0x67be7dd7ba49a413c7aa0a1a0c82d5c9907c493e86e52a4bb4807179255486dc",
    "DuelCreated topic must match the deployed 6-field event (observed on-chain)"
  );
  assert.notEqual(
    topic,
    "0x068f7dba6a893c40cac4a9566681d8fbb4ee83dd3b803d2f44adf1b85422ad5b",
    "must NOT be the stale 5-arg topic"
  );
  ok("DuelCreated topic hash matches the on-chain event");
}

console.log(`\n${passed} chart/event regression tests passed`);
process.exit(0);
