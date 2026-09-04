import { type Address } from "viem";

const GRAPHQL_URL = "https://dev.smk.somnia.host/v1/graphql";

export interface OrderBookLevel {
  price: number;
  size: number;
  side: "BUY" | "SELL";
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
        status: {_eq: "OPEN"},
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
      side: o.side as "BUY" | "SELL",
    }));
  } catch (e) {
    console.error("Failed to fetch order book:", e);
    return [];
  }
}

export function calculateSentiment(orders: OrderBookLevel[]): MarketSentiment {
  const bids = orders.filter((o) => o.side === "BUY");
  const asks = orders.filter((o) => o.side === "SELL");

  const totalBidDepth = bids.reduce((sum, o) => sum + o.size * o.price, 0);
  const totalAskDepth = asks.reduce((sum, o) => sum + o.size * o.price, 0);
  const totalDepth = totalBidDepth + totalAskDepth;

  const upPercent = totalDepth > 0 ? (totalBidDepth / totalDepth) * 100 : 50;
  const downPercent = totalDepth > 0 ? (totalAskDepth / totalDepth) * 100 : 50;

  const bestBid = bids.length > 0 ? Math.max(...bids.map((o) => o.price)) : 0;
  const bestAsk = asks.length > 0 ? Math.min(...asks.map((o) => o.price)) : 1;
  const midPrice = (bestBid + bestAsk) / 2;
  const spread = bestAsk - bestBid;

  return {
    upPercent: Math.round(upPercent),
    downPercent: Math.round(downPercent),
    totalBidDepth,
    totalAskDepth,
    midPrice,
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
