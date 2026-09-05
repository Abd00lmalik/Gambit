import { type Address } from "viem";

const DEV_GRAPHQL_URL = "https://dev.smk.somnia.host/v1/graphql";
const PROD_GRAPHQL_URL = "https://prd.smk.somnia.host/v1/graphql";

// ── Shared GraphQL helper ──────────────────────────────────────
async function gqlFetch(url: string, query: string): Promise<any[]> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const data = await res.json();
    return data?.data?.Market ?? [];
  } catch {
    return [];
  }
}

async function gqlRaw(url: string, query: string): Promise<any> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const data = await res.json();
    return data?.data ?? {};
  } catch {
    return {};
  }
}

// ── Opening price resolution ───────────────────────────────────
// Primary source: DreamDEX prod price feed (exact match)
const PRICE_FEED_URL = "https://price-feed.prd.oracle.somnia.host/v1/graphql";

// Cache: key = "asset|tradingStart", value = price
const openingPriceCache = new Map<string, number | null>();

// Fallback: CoinGecko (used only if price feed has no data)
let geckoCache: { prices: Record<string, number>; ts: number } = { prices: {}, ts: 0 };
const GECKO_CACHE_MS = 10_000;

async function fetchCoinGeckoPrices(): Promise<Record<string, number>> {
  const now = Date.now();
  if (geckoCache.prices.BTC && now - geckoCache.ts < GECKO_CACHE_MS) {
    return geckoCache.prices;
  }
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd"
    );
    const data = await res.json();
    const prices: Record<string, number> = {};
    if (data.bitcoin?.usd) prices.BTC = data.bitcoin.usd;
    if (data.ethereum?.usd) prices.ETH = data.ethereum.usd;
    geckoCache = { prices, ts: now };
    return prices;
  } catch {
    return geckoCache.prices;
  }
}

/**
 * Get opening price from DreamDEX's prod price feed.
 * Queries PricePoint table for the BTC/USDC or ETH/USDC spot price
 * at or just after the market's tradingStart timestamp.
 */
async function fetchPriceFeedOpeningPrice(
  asset: string,
  tradingStart: number
): Promise<number | null> {
  if (tradingStart <= 0) return null;

  const feedId = `${asset}/USDC`;
  const cacheKey = `${asset}|${tradingStart}`;

  if (openingPriceCache.has(cacheKey)) {
    return openingPriceCache.get(cacheKey)!;
  }

  try {
    // Get the first price at or after tradingStart (the opening candle)
    const query = `{
      PricePoint(
        limit: 1,
        order_by: {blockTimestamp: asc},
        where: {feed_id: {_eq: "${feedId}"}, blockTimestamp: {_gte: ${tradingStart}}}
      ) { spot blockTimestamp }
    }`;
    const data = await gqlRaw(PRICE_FEED_URL, query);
    const pp = data.PricePoint?.[0];
    if (pp?.spot) {
      const price = Number(pp.spot) / 10 ** 18;
      if (price > 0) {
        openingPriceCache.set(cacheKey, price);
        return price;
      }
    }
  } catch {
    // fall through to CoinGecko
  }

  // If market hasn't started yet, get the latest price as proxy
  try {
    const query = `{
      PricePoint(
        limit: 1,
        order_by: {blockTimestamp: desc},
        where: {feed_id: {_eq: "${feedId}"}}
      ) { spot }
    }`;
    const data = await gqlRaw(PRICE_FEED_URL, query);
    const pp = data.PricePoint?.[0];
    if (pp?.spot) {
      const price = Number(pp.spot) / 10 ** 18;
      if (price > 0) {
        openingPriceCache.set(cacheKey, price);
        return price;
      }
    }
  } catch {
    // fall through
  }

  return null;
}

function parseStrikeFromQuestion(question: string): number | null {
  if (!question) return null;
  const match = question.match(/at or above\s+([\d,]+\.?\d*)/i);
  if (match) {
    const val = parseFloat(match[1].replace(/,/g, ""));
    if (!isNaN(val) && val > 0) return val;
  }
  return null;
}

function deriveOpeningPrice(strike: number, question: string): number | null {
  if (strike > 0) {
    return strike > 100000 ? strike / 100 : strike;
  }
  return parseStrikeFromQuestion(question);
}

// ── Build DreamDEX-style question ──────────────────────────────
function buildMarketQuestion(
  asset: string,
  openingPrice: number | null,
  expiry: number,
  isApproximate: boolean = true
): string {
  const expiryTime = new Date(expiry * 1000).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    hour12: false,
  });
  if (openingPrice !== null && openingPrice > 0) {
    const prefix = isApproximate ? "~" : "";
    return `Will ${asset} settle above ${prefix}$${openingPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} at ${expiryTime} UTC?`;
  }
  return `Will ${asset} close above its opening price at ${expiryTime} UTC?`;
}

// ── Map raw GraphQL market to DreamDexMarket ───────────────────
function mapMarketRaw(m: any): any {
  const strikeVal = Number(m.strike) || 0;
  const expiry = Number(m.expiry);
  const tradingStart = Number(m.tradingStart || 0);
  return {
    id: m.id,
    marketAddress: m.marketAddress as Address,
    marketId: m.marketId || "",
    asset: m.asset,
    question: m.question,
    displayQuestion: "",
    strike: strikeVal,
    indexPrice: Number(m.indexPrice) || 0,
    openingPrice: deriveOpeningPrice(strikeVal, m.question),
    intervalSec: Number(m.intervalSec),
    expiry,
    tradingStart,
    clobStatus: m.clobStatus,
    binaryPoolAddress: m.binaryPoolAddress || "",
    venueId: m.venueId || "",
    oracleQuestionId: m.oracleQuestionId || "",
    priceIsApproximate: true,
  };
}

async function enrichMarketWithPrice(raw: any): Promise<DreamDexMarket> {
  const m = { ...raw };

  // Try price feed first (exact DreamDEX-native price)
  if (m.openingPrice === null || m.openingPrice === 0) {
    const feedPrice = await fetchPriceFeedOpeningPrice(m.asset, m.tradingStart);
    if (feedPrice !== null) {
      m.openingPrice = feedPrice;
    }
  }

  // Build display question with the resolved opening price
  m.displayQuestion = buildMarketQuestion(m.asset, m.openingPrice, m.expiry, m.priceIsApproximate);

  return m as DreamDexMarket;
}

// ── Query both indexers and merge ──────────────────────────────
async function queryBothIndexers(whereClause: string, orderBy: string, limit: number): Promise<any[]> {
  const query = `{
    Market(
      where: {${whereClause}}
      order_by: {${orderBy}}
      limit: ${limit}
    ) {
      id marketAddress marketId asset question strike indexPrice
      intervalSec expiry tradingStart clobStatus binaryPoolAddress venueId oracleQuestionId
    }
  }`;

  const [devMarkets, prodMarkets] = await Promise.all([
    gqlFetch(DEV_GRAPHQL_URL, query),
    gqlFetch(PROD_GRAPHQL_URL, query),
  ]);

  const seenAddrs = new Set<string>();
  const seenAssetIv = new Set<string>();
  const merged: any[] = [];

  for (const m of prodMarkets) {
    const addr = m.marketAddress?.toLowerCase();
    if (!addr || seenAddrs.has(addr)) continue;
    seenAddrs.add(addr);
    seenAssetIv.add(`${m.asset}-${m.intervalSec}`);
    merged.push(m);
  }

  for (const m of devMarkets) {
    const addr = m.marketAddress?.toLowerCase();
    const combo = `${m.asset}-${m.intervalSec}`;
    if (!addr || seenAddrs.has(addr) || seenAssetIv.has(combo)) continue;
    seenAddrs.add(addr);
    merged.push(m);
  }

  return merged;
}

// ── Market verification ────────────────────────────────────────
export interface MarketVerification {
  valid: boolean;
  marketId?: string;
  expiry?: number;
  clobStatus?: string;
  error?: string;
}

export async function verifyMarketAddress(
  marketAddress: Address
): Promise<MarketVerification> {
  const query = `{
    Market(
      where: {marketAddress: {_eq: "${marketAddress.toLowerCase()}"}},
      limit: 1
    ) {
      id marketId marketAddress clobStatus expiry
    }
  }`;

  for (const url of [PROD_GRAPHQL_URL, DEV_GRAPHQL_URL]) {
    try {
      const data = await gqlRaw(url, query);
      const markets = data.Market ?? [];
      if (markets.length === 0) continue;

      const market = markets[0];
      const marketId = market.marketId;
      if (!marketId) return { valid: false, error: "Market has no marketId in indexer" };
      if (market.clobStatus !== "Trading") {
        return { valid: false, marketId, clobStatus: market.clobStatus, error: `Market is not tradeable (status: ${market.clobStatus})` };
      }
      return { valid: true, marketId, expiry: market.expiry, clobStatus: market.clobStatus };
    } catch { continue; }
  }
  return { valid: false, error: "Market not found in any DreamDEX indexer" };
}

// ── DreamDexMarket type ────────────────────────────────────────
export interface DreamDexMarket {
  id: string;
  marketAddress: Address;
  marketId: string;
  asset: string;
  question: string;
  displayQuestion: string;
  strike: number;
  indexPrice: number;
  openingPrice: number | null;
  intervalSec: number;
  expiry: number;
  tradingStart: number;
  clobStatus: string;
  binaryPoolAddress: string;
  venueId: string;
  oracleQuestionId: string;
  priceIsApproximate: boolean;
}

// ── Fetch markets ──────────────────────────────────────────────
export async function fetchActiveBinaryMarkets(limit = 30): Promise<DreamDexMarket[]> {
  const now = Math.floor(Date.now() / 1000);
  const markets = await queryBothIndexers(
    `marketType: {_eq: "BINARY"}, clobStatus: {_eq: "Trading"}, expiry: {_gt: ${now}}`,
    `expiry: asc`,
    limit
  );

  const filtered = markets.filter((m: any) => m.marketAddress).map(mapMarketRaw);
  return Promise.all(filtered.map(enrichMarketWithPrice));
}

export async function fetchMarketsByInterval(
  asset: string,
  intervalSec: number,
  limit = 5
): Promise<DreamDexMarket[]> {
  const now = Math.floor(Date.now() / 1000);
  const markets = await queryBothIndexers(
    `marketType: {_eq: "BINARY"}, clobStatus: {_eq: "Trading"}, asset: {_eq: "${asset}"}, intervalSec: {_eq: ${intervalSec}}, expiry: {_gt: ${now}}`,
    `expiry: asc`,
    limit
  );

  const filtered = markets
    .filter((m: any) => m.marketAddress)
    .slice(0, limit)
    .map(mapMarketRaw);
  return Promise.all(filtered.map(enrichMarketWithPrice));
}

export async function fetchLatestIndexPrices(): Promise<Record<string, number>> {
  const result: Record<string, number> = {};

  // Get latest prices from the prod price feed (real-time, exact)
  for (const asset of ["BTC", "ETH"]) {
    try {
      const query = `{
        PricePoint(
          limit: 1,
          order_by: {blockTimestamp: desc},
          where: {feed_id: {_eq: "${asset}/USDC"}}
        ) { spot }
      }`;
      const data = await gqlRaw(PRICE_FEED_URL, query);
      const pp = data.PricePoint?.[0];
      if (pp?.spot) {
        result[asset] = Number(pp.spot) / 10 ** 18;
      }
    } catch {}
  }

  // CoinGecko fallback
  if (!result.BTC || !result.ETH) {
    const gecko = await fetchCoinGeckoPrices();
    if (!result.BTC && gecko.BTC) result.BTC = gecko.BTC;
    if (!result.ETH && gecko.ETH) result.ETH = gecko.ETH;
  }

  return result;
}

// ── Utilities ──────────────────────────────────────────────────
export function intervalFromSec(sec: number): string {
  if (sec <= 60) return "60s";
  if (sec <= 300) return "5m";
  if (sec <= 900) return "15m";
  if (sec <= 3600) return "1h";
  if (sec <= 14400) return "4h";
  if (sec <= 86400) return "1d";
  return `${Math.round(sec / 60)}m`;
}

export async function fetchOracleQuestionId(marketAddress: Address): Promise<string | null> {
  for (const url of [PROD_GRAPHQL_URL, DEV_GRAPHQL_URL]) {
    const data = await gqlRaw(url, `{
      Market(where: {marketAddress: {_eq: "${marketAddress}"}}, limit: 1) {
        oracleQuestionId
      }
    }`);
    const qid = data?.Market?.[0]?.oracleQuestionId;
    if (qid) return qid;
  }
  return null;
}

export async function fetchOpeningPrices(marketIds: string[]): Promise<Record<string, number | null>> {
  const result: Record<string, number | null> = {};
  if (marketIds.length === 0) return result;
  const gecko = await fetchCoinGeckoPrices();
  for (const id of marketIds) {
    result[id] = gecko.BTC || gecko.ETH || null;
  }
  return result;
}

export function getTimeRemainingForInterval(intervalSec: number): { secondsLeft: number; nextBoundary: number } {
  const now = Math.floor(Date.now() / 1000);
  const boundary = Math.ceil(now / intervalSec) * intervalSec;
  return { secondsLeft: boundary - now, nextBoundary: boundary };
}

export interface MarketCombo {
  asset: string;
  intervalSec: number;
  label: string;
  marketCount: number;
}

export async function fetchAvailableMarkets(): Promise<MarketCombo[]> {
  const now = Math.floor(Date.now() / 1000);
  const markets = await queryBothIndexers(
    `marketType: {_eq: "BINARY"}, clobStatus: {_eq: "Trading"}, expiry: {_gt: ${now}}`,
    `expiry: asc`,
    100
  );

  const comboMap = new Map<string, MarketCombo>();
  for (const m of markets) {
    const key = `${m.asset}-${m.intervalSec}`;
    if (comboMap.has(key)) {
      comboMap.get(key)!.marketCount++;
    } else {
      comboMap.set(key, {
        asset: m.asset,
        intervalSec: m.intervalSec,
        label: intervalFromSec(m.intervalSec),
        marketCount: 1,
      });
    }
  }

  return [...comboMap.values()].sort((a, b) => {
    if (a.asset !== b.asset) return a.asset.localeCompare(b.asset);
    return a.intervalSec - b.intervalSec;
  });
}
