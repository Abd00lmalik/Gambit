import { type Address } from "viem";

const GRAPHQL_URL = "https://dev.smk.somnia.host/v1/graphql";

export interface OrderBookLevel {
  price: number;
  size: number;
  side: "BUY_YES" | "SELL_YES";
}

export interface MarketSentiment {
  upPercent: number;
  downPercent: number;
  totalBidDepth: number;
  totalAskDepth: number;
  midPrice: number;
  spread: number;
}

export async function fetchOrderBook(
  marketAddress: Address,
  depth = 20
): Promise<OrderBookLevel[]> {
  const query = `{
    Order(
      limit: ${depth * 2},
      order_by: {price: asc},
      where: {
        status: {_eq: "Open"},
        market: {marketAddress: {_eq: "${marketAddress}"}}
      }
    ) {
      price
      quantityRemaining
      side
    }
  }`;

  try {
    const res = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const data = await res.json();
    const orders = data?.data?.Order ?? [];

    return orders.map((o: any) => ({
      price: parseFloat(o.price),
      size: parseFloat(o.quantityRemaining),
      side: o.side as "BUY_YES" | "SELL_YES",
    }));
  } catch (e) {
    console.error("Failed to fetch order book:", e);
    return [];
  }
}

export function calculateSentiment(orders: OrderBookLevel[]): MarketSentiment {
  // BUY_YES = people buying YES tokens (betting UP) = UP side
  // SELL_YES = people selling YES tokens (betting DOWN) = DOWN side
  const bids = orders.filter((o) => o.side === "BUY_YES");
  const asks = orders.filter((o) => o.side === "SELL_YES");

  const totalBidDepth = bids.reduce((sum, o) => sum + o.size, 0);
  const totalAskDepth = asks.reduce((sum, o) => sum + o.size, 0);

  // DreamDEX CLOB prices are in micro-units: divide by 1,000,000 to get probability (0-1)
  // e.g. price 691000 = 0.691 = 69.1% probability of YES/UP
  const SCALE = 1_000_000;

  const bestBid = bids.length > 0 ? Math.max(...bids.map((o) => o.price)) : 0;
  const bestAsk = asks.length > 0 ? Math.min(...asks.map((o) => o.price)) : SCALE;

  const bestBidProb = bestBid / SCALE;
  const bestAskProb = bestAsk / SCALE;
  const midProb = (bestBidProb + bestAskProb) / 2;

  // Probability = mid-price between best bid and best ask (same as DreamDEX implied odds)
  const upPercent = Math.round(midProb * 100);
  const downPercent = 100 - upPercent;

  const spread = (bestAsk - bestBid) / SCALE;

  return {
    upPercent,
    downPercent,
    totalBidDepth,
    totalAskDepth,
    midPrice: midProb,
    spread,
  };
}

export async function fetchMarketSentiment(
  marketAddress: Address
): Promise<MarketSentiment | null> {
  const orders = await fetchOrderBook(marketAddress);
  if (orders.length === 0) return null;
  return calculateSentiment(orders);
}
