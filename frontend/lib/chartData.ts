// Chart data pipeline — extracted from LiveChart so the math is unit-testable.
//
// Invariants (verified against the live feed 2026-09-10):
//  - The price feed GraphQL endpoint caps every query at 5000 rows. A 2h window
//    holds ~7000 points (~57 pts/min), so fetching the window needs TWO pages.
//  - Pages MUST be fetched `desc` (newest first). An ascending fetch with a row
//    cap returns the OLDEST points of the window and silently drops the most
//    recent ones — which left a multi-hour hole before "now", so the realtime
//    candle appeared disconnected from the historical candles.
//  - Candles are always built from points in chronological order:
//    open = first price in bucket, close = last, high = max, low = min.
//  - Realtime updates continue the CURRENT candle (same bucket key, same time
//    coordinate system); points older than the newest rendered candle are
//    already-rendered history and must never repaint it.

export const FEED_URL = "https://price-feed.prd.oracle.somnia.host/v1/graphql";
export const CHART_WINDOW_SEC = 2 * 60 * 60; // 2h lookback
export const FEED_PAGE_LIMIT = 5000; // server-side row cap per query

export interface RawPricePoint {
  spot: string | number;
  blockTimestamp: string | number;
}

export interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  time: number; // UTC seconds, bucket start
}

export function feedIdFor(asset: string): string {
  return asset === "BTC" ? "BTC/USDC" : "ETH/USDC";
}

/** Price at human scale — feed stores 18-decimal fixed-point strings. */
export function spotToPrice(spot: string | number): number {
  return Number(spot) / 1e18;
}

/** Bucket key (UTC seconds) a timestamp falls into. */
export function bucketKey(ts: number, bucketSec: number): number {
  return Math.floor(ts / bucketSec) * bucketSec;
}

// P2 (chart density): pick a candle bucket that yields trading-view-style
// density from the available price points (~60-150 candles on screen).
export function bucketSizeFor(points: RawPricePoint[]): number {
  if (!points || points.length < 2) return 60;
  const ts = (p: RawPricePoint) => Number(p.blockTimestamp);
  let min = ts(points[0]);
  let max = ts(points[0]);
  for (const p of points) {
    const t = ts(p);
    if (t < min) min = t;
    if (t > max) max = t;
  }
  const span = max - min;
  if (span <= 15 * 60) return 10; // dense feed, short window → 10s candles
  if (span <= 45 * 60) return 30; // → 30s candles
  return 60;                      // → 1m candles (2h window ≈ 120 candles)
}

/**
 * Fold raw price points into OHLC candles. Input order does not matter —
 * points are sorted chronologically first, so open/close/high/low are always
 * correct even when the fetch returns rows newest-first.
 */
export function buildCandles(points: RawPricePoint[], bucketSec: number): Candle[] {
  const chronological = [...points].sort(
    (a, b) => Number(a.blockTimestamp) - Number(b.blockTimestamp)
  );

  const candles = new Map<number, Candle>();
  for (const p of chronological) {
    const price = spotToPrice(p.spot);
    if (!(price > 0)) continue;
    const ts = Math.floor(Number(p.blockTimestamp));
    const key = bucketKey(ts, bucketSec);
    const existing = candles.get(key);
    if (existing) {
      if (price > existing.high) existing.high = price;
      if (price < existing.low) existing.low = price;
      existing.close = price;
    } else {
      candles.set(key, {
        open: price,
        high: price,
        low: price,
        close: price,
        time: key,
      });
    }
  }
  return Array.from(candles.values()).sort((a, b) => a.time - b.time);
}

function feedQuery(where: string, orderBy: "asc" | "desc", limit: number): string {
  return `{
    PricePoint(
      limit: ${limit},
      order_by: {blockTimestamp: ${orderBy}},
      where: {${where}}
    ) { spot blockTimestamp }
  }`;
}

/** Initial window load — enough pages (desc) to cover the whole lookback. */
export function windowQuery(feedId: string, since: number, before: number): string {
  return feedQuery(
    `feed_id: {_eq: "${feedId}"}, blockTimestamp: {_gte: ${since}, _lt: ${before}}`,
    "desc",
    FEED_PAGE_LIMIT
  );
}

/** Realtime tail — every point at/after `since`, oldest first, so the current
 *  candle continues exactly where the window left off (true open on rollover). */
export function tailQuery(feedId: string, since: number): string {
  return feedQuery(
    `feed_id: {_eq: "${feedId}"}, blockTimestamp: {_gte: ${since}}`,
    "asc",
    FEED_PAGE_LIMIT
  );
}

type FetchLike = (url: string, init: any) => Promise<Response>;

/**
 * Fetch the full lookback window, paging backwards (desc) when the feed's row
 * cap truncates the result. Returns points in ARBITRARY order (callers must
 * build candles via buildCandles, which normalizes order).
 */
export async function fetchWindowPoints(
  asset: string,
  nowSec: number,
  fetchImpl: FetchLike = fetch
): Promise<RawPricePoint[]> {
  const feedId = feedIdFor(asset);
  const since = nowSec - CHART_WINDOW_SEC;

  const rows: RawPricePoint[] = [];
  let upper = nowSec + 1; // exclusive upper bound for the next, older page
  for (let page = 0; page < 2; page++) {
    const res = await fetchImpl(FEED_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: windowQuery(feedId, since, upper) }),
    });
    const data = await res.json();
    if (data?.errors) break; // row cap / query error — work with what we have
    const pageRows: RawPricePoint[] = data?.data?.PricePoint || [];
    rows.push(...pageRows);
    if (pageRows.length < FEED_PAGE_LIMIT) break; // window fully covered
    const oldest = Math.floor(Number(pageRows[pageRows.length - 1].blockTimestamp));
    if (!(oldest > since)) break; // nothing older left in the window
    upper = oldest; // next page: strictly older than this page's oldest row
  }
  return rows;
}
