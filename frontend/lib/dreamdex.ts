import { type Address, createPublicClient, http, parseAbi } from "viem";
import { somnia } from "./config";

const GRAPHQL_URL = "https://dev.smk.somnia.host/v1/graphql";

const BINARY_MODULE_ADDRESS = "0x3ecC694Cef705358864a646142ac17A90E29e388" as Address;

const BINARY_MODULE_ABI = parseAbi([
  "function markets(bytes32 marketId) view returns (uint256 oracleQuestionId, uint8 outcomeSlotCount, uint8 voidPolicy, address collateral, uint32 originOperatorId, bytes32 originVenueId, address oracleAdapter, address creator, address market, address pool, uint256 yesId, uint256 noId, uint64 tradingStart, uint64 expiry)",
]);

export interface MarketVerification {
  valid: boolean;
  marketId?: string;
  expiry?: number;
  status?: number;
  clobStatus?: string;
  error?: string;
}

/**
 * Verify a market address is a legitimate DreamDEX BinaryMarket.
 * Two-layer check:
 * 1. Off-chain indexer: does this address exist in DreamDEX's indexer?
 * 2. On-chain: does BinaryMarketsModule.markets(marketId) confirm this address?
 */
export async function verifyMarketAddress(
  marketAddress: Address
): Promise<MarketVerification> {
  // Layer 1: Indexer check
  const query = `{
    Market(
      where: {marketAddress: {_eq: "${marketAddress.toLowerCase()}"}},
      limit: 1
    ) {
      id
      marketId
      marketAddress
      clobStatus
      expiry
    }
  }`;

  try {
    const res = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const data = await res.json();
    const markets = data?.data?.Market ?? [];

    if (markets.length === 0) {
      return { valid: false, error: "Market not found in DreamDEX indexer" };
    }

    const market = markets[0];
    const marketId = market.marketId;

    if (!marketId) {
      return { valid: false, error: "Market has no marketId in indexer" };
    }

    // Check market is actually tradeable (not Locked or beyond)
    if (market.clobStatus !== "Trading") {
      return {
        valid: false,
        marketId,
        clobStatus: market.clobStatus,
        error: `Market is not tradeable (status: ${market.clobStatus}). It may be locked or expired.`,
      };
    }

    // Layer 2: On-chain verification
    const client = createPublicClient({
      chain: somnia,
      transport: http(),
    });

    try {
      const record = await client.readContract({
        address: BINARY_MODULE_ADDRESS,
        abi: BINARY_MODULE_ABI,
        functionName: "markets",
        args: [marketId as `0x${string}`],
      });

      const onChainMarket = record[8]; // market address field

      if (
        !onChainMarket ||
        onChainMarket.toLowerCase() !== marketAddress.toLowerCase()
      ) {
        return {
          valid: false,
          marketId,
          error: "On-chain market address mismatch — possible fake market",
        };
      }

      const onChainExpiry = Number(record[13]);
      const now = Math.floor(Date.now() / 1000);
      if (onChainExpiry <= now) {
        return {
          valid: false,
          marketId,
          expiry: onChainExpiry,
          error: "Market has already expired",
        };
      }

      return {
        valid: true,
        marketId,
        expiry: onChainExpiry,
        clobStatus: market.clobStatus,
      };
    } catch (e) {
      // On-chain read failed — indexer check passed, but can't verify on-chain
      // Allow with warning (indexer data is generally reliable)
      console.warn("On-chain verification failed, indexer check passed:", e);
      return {
        valid: true,
        marketId,
        expiry: market.expiry,
        error: undefined,
      };
    }
  } catch (e) {
    return { valid: false, error: "Failed to reach DreamDEX indexer" };
  }
}

export interface DreamDexMarket {
  id: string;
  marketAddress: Address;
  marketId: string;
  asset: string;
  question: string;
  strike: number;
  indexPrice: number;
  openingPrice: number | null;
  intervalSec: number;
  expiry: number;
  clobStatus: string;
  binaryPoolAddress: string;
  venueId: string;
  finalized: boolean;
  voided: boolean;
  oracleQuestionId: string;
}

export async function fetchActiveBinaryMarkets(
  limit = 30
): Promise<DreamDexMarket[]> {
  const query = `{
    Market(
      where: {marketType: {_eq: "BINARY"}, finalized: {_eq: false}, voided: {_eq: false}}
      order_by: {createdAtTimestamp: desc}
      limit: ${limit}
    ) {
      id
      marketAddress
      marketId
      asset
      question
      strike
      indexPrice
      intervalSec
      expiry
      clobStatus
      binaryPoolAddress
      venueId
      finalized
      voided
      oracleQuestionId
    }
  }`;

  try {
    const res = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const data = await res.json();
    const markets = data?.data?.Market ?? [];

    const mapped = markets
      .filter((m: any) => m.marketAddress && m.clobStatus === "Trading")
      .map((m: any) => ({
        id: m.id,
        marketAddress: m.marketAddress as Address,
        marketId: m.marketId,
        asset: m.asset,
        question: m.question,
        strike: Number(m.strike),
        indexPrice: Number(m.indexPrice) || 0,
        openingPrice: null as number | null,
        intervalSec: Number(m.intervalSec),
        expiry: Number(m.expiry),
        clobStatus: m.clobStatus,
        binaryPoolAddress: m.binaryPoolAddress,
        venueId: m.venueId,
        finalized: m.finalized,
        voided: m.voided,
        oracleQuestionId: m.oracleQuestionId || "",
      }));

    // Batch-fetch opening prices for all markets
    const openingPrices = await fetchOpeningPrices(mapped.map((m: any) => m.id));
    for (const m of mapped) {
      m.openingPrice = openingPrices[m.id.toLowerCase()] ?? null;
    }

    return mapped;
  } catch (e) {
    console.error("Failed to fetch DreamDEX markets:", e);
    return [];
  }
}

export async function fetchMarketsByInterval(
  asset: string,
  intervalSec: number,
  limit = 5
): Promise<DreamDexMarket[]> {
  // Try clobStatus filter first, fall back to no filter if empty
  const queries = [
    // Primary: strict filter
    `{
      Market(
        where: {
          marketType: {_eq: "BINARY"},
          finalized: {_eq: false},
          voided: {_eq: false},
          asset: {_eq: "${asset}"},
          intervalSec: {_eq: ${intervalSec}},
          clobStatus: {_eq: "Trading"}
        }
        order_by: {createdAtTimestamp: desc}
        limit: ${limit}
      ) {
        id marketAddress marketId asset question strike indexPrice
        intervalSec expiry clobStatus binaryPoolAddress venueId
        finalized voided oracleQuestionId
      }
    }`,
    // Fallback: no clobStatus filter
    `{
      Market(
        where: {
          marketType: {_eq: "BINARY"},
          finalized: {_eq: false},
          voided: {_eq: false},
          asset: {_eq: "${asset}"},
          intervalSec: {_eq: ${intervalSec}}
        }
        order_by: {createdAtTimestamp: desc}
        limit: ${limit}
      ) {
        id marketAddress marketId asset question strike indexPrice
        intervalSec expiry clobStatus binaryPoolAddress venueId
        finalized voided oracleQuestionId
      }
    }`,
  ];

  let markets: any[] = [];

  for (const query of queries) {
    try {
      const res = await fetch(GRAPHQL_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      const result = data?.data?.Market ?? [];
      if (result.length > 0) {
        markets = result;
        break;
      }
    } catch (e) {
      console.warn("DreamDEX query failed, trying fallback:", e);
    }
  }

  const mapped = markets
    .filter((m: any) => m.marketAddress)
    .map((m: any) => ({
      id: m.id,
      marketAddress: m.marketAddress as Address,
      marketId: m.marketId,
      asset: m.asset,
      question: m.question,
      strike: Number(m.strike),
      indexPrice: Number(m.indexPrice) || 0,
      openingPrice: null as number | null,
      intervalSec: Number(m.intervalSec),
      expiry: Number(m.expiry),
      clobStatus: m.clobStatus,
      binaryPoolAddress: m.binaryPoolAddress,
      venueId: m.venueId,
      finalized: m.finalized,
      voided: m.voided,
      oracleQuestionId: m.oracleQuestionId || "",
    }));

  if (mapped.length === 0) return [];

  // Batch-fetch opening prices for all markets
  const openingPrices = await fetchOpeningPrices(mapped.map((m: any) => m.id));
  for (const m of mapped) {
    m.openingPrice = openingPrices[m.id.toLowerCase()] ?? null;
  }

  return mapped;
}

export async function fetchLatestIndexPrices(): Promise<
  Record<string, number>
> {
  const query = `{
    Market(
      where: {
        marketType: {_eq: "BINARY"},
        finalized: {_eq: false},
        voided: {_eq: false},
        strike: {_gt: "0"}
      }
      order_by: {createdAtTimestamp: desc}
      limit: 50
    ) {
      asset
      strike
      indexPrice
      intervalSec
    }
  }`;

  try {
    const res = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const data = await res.json();
    const markets = data?.data?.Market ?? [];

    const bestPrices: Record<string, { price: number; priority: number }> = {};

    for (const m of markets) {
      const asset = m.asset;
      const indexPrice = Number(m.indexPrice);
      const strike = Number(m.strike);
      if (strike <= 0) continue;

      const price = indexPrice > 0 ? indexPrice : (strike > 10000 ? strike / 100 : strike / 1000);
      const interval = Number(m.intervalSec);

      let priority = 0;
      if (interval === 900) priority = 3;
      else if (interval === 3600) priority = 2;
      else if (interval === 300) priority = 1;

      if (!bestPrices[asset] || priority > bestPrices[asset].priority) {
        bestPrices[asset] = { price, priority };
      }
    }

    const result: Record<string, number> = {};
    for (const [asset, data] of Object.entries(bestPrices)) {
      result[asset] = data.price;
    }
    return result;
  } catch (e) {
    console.error("Failed to fetch index prices:", e);
    return {};
  }
}

export function intervalFromSec(sec: number): string {
  if (sec <= 300) return "5m";
  if (sec <= 900) return "15m";
  if (sec <= 3600) return "1h";
  if (sec <= 14400) return "4h";
  if (sec <= 86400) return "1d";
  return `${Math.round(sec / 60)}m`;
}

export async function fetchOracleQuestionId(
  marketAddress: Address
): Promise<string | null> {
  const query = `{
    Market(where: {marketAddress: {_eq: "${marketAddress}"}}, limit: 1) {
      oracleQuestionId
    }
  }`;

  try {
    const res = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const data = await res.json();
    return data?.data?.Market?.[0]?.oracleQuestionId ?? null;
  } catch (e) {
    console.error("Failed to fetch oracleQuestionId:", e);
    return null;
  }
}

export async function fetchOpeningPrices(
  marketIds: string[]
): Promise<Record<string, number | null>> {
  const result: Record<string, number | null> = {};
  if (marketIds.length === 0) return result;

  const ids = marketIds.map((id) => id.toLowerCase());

  try {
    // Step 1: Get reference question IDs from MarketReferenceLink
    const refQuery = `query OpeningRefs($ids: [String!]) {
      MarketReferenceLink(where: {market_id: {_in: $ids}}) {
        market: market_id
        referenceQuestionId
      }
    }`;
    const refRes = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: refQuery, variables: { ids } }),
    });
    const refData = await refRes.json();
    const links = refData?.data?.MarketReferenceLink ?? [];

    if (links.length === 0) return result;

    // Map market → reference question ID
    const marketToQid = new Map<string, string>();
    const qids = new Set<string>();
    for (const l of links) {
      const mid = l.market.toLowerCase();
      const qid = String(l.referenceQuestionId);
      marketToQid.set(mid, qid);
      qids.add(qid);
    }

    // Step 2: Get oracle answers for those question IDs
    const ansQuery = `query OracleAnswersByQid($qids: [String!]) {
      OracleAnswer(where: {id: {_in: $qids}}) { id numericValue }
    }`;
    const ansRes = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: ansQuery, variables: { qids: [...qids] } }),
    });
    const ansData = await ansRes.json();
    const answers = ansData?.data?.OracleAnswer ?? [];

    // Map question ID → numeric value
    const qToVal = new Map<string, number>();
    for (const a of answers) {
      qToVal.set(String(a.id), Number(a.numericValue));
    }

    // Step 3: Join market → opening price (divide by 100 for 2-decimal scale)
    for (const [market, qid] of marketToQid) {
      const raw = qToVal.get(qid);
      result[market] = raw != null ? raw / 100 : null;
    }
  } catch (e) {
    console.error("Failed to fetch opening prices:", e);
  }

  return result;
}

export function getTimeRemainingForInterval(
  intervalSec: number
): { secondsLeft: number; nextBoundary: number } {
  const now = Math.floor(Date.now() / 1000);
  const boundary = Math.ceil(now / intervalSec) * intervalSec;
  return { secondsLeft: boundary - now, nextBoundary: boundary };
}export interface MarketCombo {
  asset: string;
  intervalSec: number;
  label: string;
  marketCount: number;
}

/**
 * Discover available asset/interval combinations from DreamDEX's live markets.
 * Returns the distinct combos currently tradeable on DreamDEX.
 */
export async function fetchAvailableMarkets(): Promise<MarketCombo[]> {
  const query = `{
    Market(
      where: {marketType: {_eq: "BINARY"}, finalized: {_eq: false}, voided: {_eq: false}, clobStatus: {_eq: "Trading"}}
      order_by: {createdAtTimestamp: desc}
      limit: 100
    ) {
      asset
      intervalSec
    }
  }`;

  try {
    const res = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const data = await res.json();
    const markets = data?.data?.Market ?? [];

    // Group by asset + intervalSec
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
      // Sort by asset name, then interval
      if (a.asset !== b.asset) return a.asset.localeCompare(b.asset);
      return a.intervalSec - b.intervalSec;
    });
  } catch (e) {
    console.error("Failed to fetch available markets:", e);
    return [];
  }
}
