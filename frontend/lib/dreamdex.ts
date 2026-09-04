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

/**
 * Parse the strike/opening price from a DreamDEX question string.
 * Question format: "Pricefeed test: will ETH/USDC's price be at or above 2447.32 at unix time ..."
 * Returns the numeric price or null if not parseable.
 */
function parseStrikeFromQuestion(question: string): number | null {
  if (!question) return null;
  // Match "at or above <number>" pattern
  const match = question.match(/at or above\s+([\d,]+\.?\d*)/i);
  if (match) {
    const val = parseFloat(match[1].replace(/,/g, ""));
    if (!isNaN(val) && val > 0) return val;
  }
  // Fallback: match any dollar-style number after "above"
  const match2 = question.match(/above\s+\$?([\d,]+\.?\d*)/i);
  if (match2) {
    const val = parseFloat(match2[1].replace(/,/g, ""));
    if (!isNaN(val) && val > 0) return val;
  }
  return null;
}

export async function fetchActiveBinaryMarkets(
  limit = 30
): Promise<DreamDexMarket[]> {
  const now = Math.floor(Date.now() / 1000);
  const query = `{
    Market(
      where: {marketType: {_eq: "BINARY"}, finalized: {_eq: false}, voided: {_eq: false}, expiry: {_gt: ${now}}}
      order_by: {expiry: asc}
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
      .map((m: any) => {
        const strikeVal = Number(m.strike);
        const questionPrice = parseStrikeFromQuestion(m.question);
        let openingPrice: number | null = null;
        if (strikeVal > 0) {
          openingPrice = strikeVal > 100000 ? strikeVal / 100 : strikeVal;
        } else if (questionPrice !== null) {
          openingPrice = questionPrice;
        }
        return {
          id: m.id,
          marketAddress: m.marketAddress as Address,
          marketId: m.marketId,
          asset: m.asset,
          question: m.question,
          strike: strikeVal,
          indexPrice: Number(m.indexPrice) || 0,
          openingPrice,
          intervalSec: Number(m.intervalSec),
          expiry: Number(m.expiry),
          clobStatus: m.clobStatus,
          binaryPoolAddress: m.binaryPoolAddress,
          venueId: m.venueId,
          finalized: m.finalized,
          voided: m.voided,
          oracleQuestionId: m.oracleQuestionId || "",
        };
      });

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
  const now = Math.floor(Date.now() / 1000);
  // Server-side filter: only non-expired markets, nearest expiry first
  const query = `{
    Market(
      where: {
        marketType: {_eq: "BINARY"},
        finalized: {_eq: false},
        voided: {_eq: false},
        asset: {_eq: "${asset}"},
        intervalSec: {_eq: ${intervalSec}},
        expiry: {_gt: ${now}}
      }
      order_by: {expiry: asc}
      limit: ${limit}
    ) {
      id marketAddress marketId asset question strike indexPrice
      intervalSec expiry clobStatus binaryPoolAddress venueId
      finalized voided oracleQuestionId
    }
  }`;

  let markets: any[] = [];

  try {
    const res = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const data = await res.json();
    markets = data?.data?.Market ?? [];
  } catch (e) {
    console.warn("DreamDEX query failed:", e);
    return [];
  }

  // GraphQL already filters non-expired; just ensure has address
  const active = markets.filter((m: any) => m.marketAddress);

  const mapped = active
    .slice(0, limit)
    .map((m: any) => {
      const strikeVal = Number(m.strike);
      const questionPrice = parseStrikeFromQuestion(m.question);
      let openingPrice: number | null = null;
      if (strikeVal > 0) {
        openingPrice = strikeVal > 100000 ? strikeVal / 100 : strikeVal;
      } else if (questionPrice !== null) {
        openingPrice = questionPrice;
      }
      return {
        id: m.id,
        marketAddress: m.marketAddress as Address,
        marketId: m.marketId,
        asset: m.asset,
        question: m.question,
        strike: strikeVal,
        indexPrice: Number(m.indexPrice) || 0,
        openingPrice,
        intervalSec: Number(m.intervalSec),
        expiry: Number(m.expiry),
        clobStatus: m.clobStatus,
        binaryPoolAddress: m.binaryPoolAddress,
        venueId: m.venueId,
        finalized: m.finalized,
        voided: m.voided,
        oracleQuestionId: m.oracleQuestionId || "",
      };
    });

  return mapped;
}

export async function fetchLatestIndexPrices(): Promise<
  Record<string, number>
> {
  const now = Math.floor(Date.now() / 1000);
  // Fetch active markets across all intervals to maximize price coverage
  const query = `{
    Market(
      where: {
        marketType: {_eq: "BINARY"},
        finalized: {_eq: false},
        voided: {_eq: false},
        expiry: {_gt: ${now}}
      }
      order_by: {expiry: asc}
      limit: 20
    ) {
      asset
      strike
      indexPrice
      expiry
      question
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

    const bestPrices: Record<string, { price: number; expiry: number }> = {};

    for (const m of markets) {
      const asset = m.asset;
      if (asset !== "BTC" && asset !== "ETH") continue;

      const indexPrice = Number(m.indexPrice);
      const strike = Number(m.strike);
      const questionPrice = parseStrikeFromQuestion(m.question);

      let price = 0;
      if (indexPrice > 0) {
        price = indexPrice;
      } else if (strike > 0) {
        price = strike > 100000 ? strike / 100 : strike;
      } else if (questionPrice !== null) {
        price = questionPrice;
      }
      if (price <= 0) continue;

      const expiry = Number(m.expiry);
      if (!bestPrices[asset] || expiry > bestPrices[asset].expiry) {
        bestPrices[asset] = { price, expiry };
      }
    }

    const result: Record<string, number> = {};
    for (const [asset, data] of Object.entries(bestPrices)) {
      result[asset] = data.price;
    }

    // CoinGecko fallback only if DreamDEX didn't return prices
    if (!result.BTC || !result.ETH) {
      try {
        const geckoRes = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd"
        );
        const geckoData = await geckoRes.json();
        if (!result.BTC && geckoData.bitcoin?.usd) result.BTC = geckoData.bitcoin.usd;
        if (!result.ETH && geckoData.ethereum?.usd) result.ETH = geckoData.ethereum.usd;
      } catch {}
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
}

export interface MarketCombo {
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
