// ── DreamDEX orderbook data via GraphQL polling ─────────────────
// NOTE: DreamDEX's proprietary WebSocket (wss://stg.api.dreamdex.io/v0/ws/public)
// requires internal auth — the `orderbook` channel always returns "subscription failed"
// from external clients. We use GraphQL polling as fallback.

const DEV_GRAPHQL_URL = "https://dev.smk.somnia.host/v1/graphql";
const PROD_GRAPHQL_URL = "https://prd.smk.somnia.host/v1/graphql";

export interface WsProbabilityUpdate {
  upPercent: number;
  downPercent: number;
  bestBid: number;
  bestAsk: number;
  midPrice: number;
  lastUpdate: number;
}

interface MarketState {
  bestBid: number;
  bestAsk: number;
  midPrice: number;
  upPercent: number;
  downPercent: number;
  lastUpdate: number;
}

export type WsListener = (update: WsProbabilityUpdate) => void;

const SCALE = 10 ** 18;
const POLL_INTERVAL = 3000;

const stateMap = new Map<string, MarketState>();
const activeSubs = new Map<string, Set<WsListener>>();
let pollTimer: ReturnType<typeof setInterval> | null = null;

function getOrCreateState(key: string): MarketState {
  let s = stateMap.get(key);
  if (!s) {
    s = { bestBid: 0, bestAsk: 0, midPrice: 0, upPercent: 50, downPercent: 50, lastUpdate: 0 };
    stateMap.set(key, s);
  }
  return s;
}

function broadcastLatest(marketAddress: string, listener: WsListener) {
  const s = stateMap.get(marketAddress.toLowerCase());
  if (s && s.lastUpdate > 0) {
    listener({
      upPercent: s.upPercent,
      downPercent: s.downPercent,
      bestBid: s.bestBid,
      bestAsk: s.bestAsk,
      midPrice: s.midPrice,
      lastUpdate: s.lastUpdate,
    });
  }
}

// ── GraphQL orderbook polling ──────────────────────────────────
async function fetchOrderBookFromIndexer(
  graphqlUrl: string,
  marketAddress: string
): Promise<{ bestBid: number; bestAsk: number } | null> {
  try {
    const query = `{
      Order(
        limit: 50,
        order_by: {price: desc},
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
    const res = await fetch(graphqlUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const data = await res.json();
    const orders = data?.data?.Order ?? [];
    if (orders.length === 0) return null;

    let bestBid = 0;
    let bestAsk = SCALE;

    for (const o of orders) {
      const price = Number(o.price) || 0;
      if (price <= 0 || price >= SCALE) continue;
      if (o.side === "BUY_YES" && price > bestBid) bestBid = price;
      if (o.side === "SELL_YES" && price < bestAsk) bestAsk = price;
    }

    if (bestBid === 0 && bestAsk === SCALE) return null;
    return { bestBid, bestAsk };
  } catch {
    return null;
  }
}

async function fetchOrderBookBothIndexers(
  marketAddress: string
): Promise<WsProbabilityUpdate | null> {
  const [prodResult, devResult] = await Promise.all([
    fetchOrderBookFromIndexer(PROD_GRAPHQL_URL, marketAddress),
    fetchOrderBookFromIndexer(DEV_GRAPHQL_URL, marketAddress),
  ]);

  const ob = prodResult || devResult;
  if (!ob) return null;

  const midPrice = (ob.bestBid + ob.bestAsk) / SCALE / 2;
  const upPercent = Math.round(midPrice * 100);
  const downPercent = 100 - upPercent;

  return {
    upPercent,
    downPercent,
    bestBid: ob.bestBid,
    bestAsk: ob.bestAsk,
    midPrice,
    lastUpdate: Date.now(),
  };
}

// ── Global polling loop ────────────────────────────────────────
function startPolling() {
  if (pollTimer) return;

  pollTimer = setInterval(async () => {
    const markets = Array.from(activeSubs.keys());
    if (markets.length === 0) {
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
      return;
    }

    for (const marketAddr of markets) {
      const listeners = activeSubs.get(marketAddr);
      if (!listeners || listeners.size === 0) continue;

      const update = await fetchOrderBookBothIndexers(marketAddr);
      if (!update) continue;

      const state = getOrCreateState(marketAddr);
      state.bestBid = update.bestBid;
      state.bestAsk = update.bestAsk;
      state.midPrice = update.midPrice;
      state.upPercent = update.upPercent;
      state.downPercent = update.downPercent;
      state.lastUpdate = update.lastUpdate;

      for (const listener of listeners) {
        listener(update);
      }
    }
  }, POLL_INTERVAL);
}

// ── Public API ─────────────────────────────────────────────────
export function subscribeOrderBook(
  marketAddress: string,
  listener: WsListener
): () => void {
  const marketKey = marketAddress.toLowerCase();

  // Add listener
  let subs = activeSubs.get(marketKey);
  if (!subs) {
    subs = new Set();
    activeSubs.set(marketKey, subs);
  }
  subs.add(listener);

  // Start polling if not already
  startPolling();

  // Broadcast existing state immediately
  broadcastLatest(marketAddress, listener);

  // Return unsubscribe
  return () => {
    subs?.delete(listener);
    if (subs && subs.size === 0) {
      activeSubs.delete(marketKey);
      stateMap.delete(marketKey);
    }
  };
}

export function getLatestState(marketAddress: string): MarketState | undefined {
  return stateMap.get(marketAddress.toLowerCase());
}
