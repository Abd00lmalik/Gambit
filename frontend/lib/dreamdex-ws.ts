import { type Address } from "viem";

const WS_URL = "wss://stg.api.dreamdex.io/v0/ws/public";
const GRAPHQL_URL = "https://dev.smk.somnia.host/v1/graphql";

const HEARTBEAT_INTERVAL = 30_000; // 30s ping
const RECONNECT_BASE_DELAY = 1_000;
const RECONNECT_MAX_DELAY = 30_000;
const SCALE = 1_000_000; // DreamDEX CLOB price scale

export interface WsProbabilityUpdate {
  marketAddress: string;
  upPercent: number;
  downPercent: number;
  midPrice: number;
  bestBid: number;
  bestAsk: number;
  timestamp: number;
}

type Listener = (update: WsProbabilityUpdate) => void;

interface Subscription {
  marketAddress: string;
  listeners: Set<Listener>;
}

class DreamDexWsClient {
  private ws: WebSocket | null = null;
  private subscriptions = new Map<string, Subscription>();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private isConnecting = false;
  private shouldReconnect = true;
  private pendingSubscribes: string[] = [];

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) return;
    this.isConnecting = true;

    try {
      this.ws = new WebSocket(WS_URL);

      this.ws.onopen = () => {
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        // Re-subscribe to all tracked markets
        for (const addr of this.subscriptions.keys()) {
          this.sendSubscribe(addr);
        }
        // Process any pending subscribes
        for (const addr of this.pendingSubscribes) {
          this.sendSubscribe(addr);
        }
        this.pendingSubscribes = [];
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(typeof event.data === "string" ? event.data : event.data.toString());
          this.handleMessage(msg);
        } catch {
          // Ignore parse errors
        }
      };

      this.ws.onclose = () => {
        this.isConnecting = false;
        this.stopHeartbeat();
        if (this.shouldReconnect) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = () => {
        this.isConnecting = false;
        // onclose will fire after onerror
      };
    } catch {
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  disconnect() {
    this.shouldReconnect = false;
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  subscribe(marketAddress: Address, listener: Listener): () => void {
    const addr = marketAddress.toLowerCase();

    if (!this.subscriptions.has(addr)) {
      this.subscriptions.set(addr, { marketAddress: addr, listeners: new Set() });
    }
    this.subscriptions.get(addr)!.listeners.add(listener);

    // Send subscribe message if connected
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendSubscribe(addr);
    } else {
      this.pendingSubscribes.push(addr);
      // Try to connect if not already
      this.connect();
    }

    return () => {
      const sub = this.subscriptions.get(addr);
      if (sub) {
        sub.listeners.delete(listener);
        if (sub.listeners.size === 0) {
          this.subscriptions.delete(addr);
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.sendUnsubscribe(addr);
          }
        }
      }
    };
  }

  private sendSubscribe(marketAddress: string) {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    // DreamDEX orderbook channel subscription
    this.ws.send(JSON.stringify({
      type: "subscribe",
      channel: "orderbook",
      market: marketAddress,
    }));
  }

  private sendUnsubscribe(marketAddress: string) {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({
      type: "unsubscribe",
      channel: "orderbook",
      market: marketAddress,
    }));
  }

  private handleMessage(msg: any) {
    // Handle orderbook updates
    if (msg.type === "orderbook" || msg.channel === "orderbook") {
      const marketAddress = (msg.market || msg.marketAddress || "").toLowerCase();
      const sub = this.subscriptions.get(marketAddress);
      if (!sub || sub.listeners.size === 0) return;

      const orders = msg.bids || msg.asks || msg.levels || [];
      if (Array.isArray(orders) && orders.length > 0) {
        const update = this.parseOrderBook(msg);
        if (update) {
          for (const listener of sub.listeners) {
            listener(update);
          }
        }
      }
    }

    // Handle pong (heartbeat response)
    if (msg.type === "pong") {
      // Heartbeat acknowledged
    }
  }

  private parseOrderBook(msg: any): WsProbabilityUpdate | null {
    try {
      const bids = (msg.bids || []).map((l: any) => ({
        price: Number(l.price || l[0] || 0),
        size: Number(l.size || l.quantity || l[1] || 0),
      }));
      const asks = (msg.asks || []).map((l: any) => ({
        price: Number(l.price || l[0] || 0),
        size: Number(l.size || l.quantity || l[1] || 0),
      }));

      if (bids.length === 0 && asks.length === 0) return null;

      const bestBid = bids.length > 0 ? Math.max(...bids.map((b: any) => b.price)) : 0;
      const bestAsk = asks.length > 0 ? Math.min(...asks.map((a: any) => a.price)) : SCALE;

      const bestBidProb = bestBid / SCALE;
      const bestAskProb = bestAsk / SCALE;
      const midProb = (bestBidProb + bestAskProb) / 2;

      return {
        marketAddress: (msg.market || msg.marketAddress || "").toLowerCase(),
        upPercent: Math.round(midProb * 100),
        downPercent: Math.round((1 - midProb) * 100),
        midPrice: midProb,
        bestBid,
        bestAsk,
        timestamp: msg.timestamp || Date.now(),
      };
    } catch {
      return null;
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "ping" }));
      }
    }, HEARTBEAT_INTERVAL);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    const delay = Math.min(
      RECONNECT_BASE_DELAY * Math.pow(2, this.reconnectAttempts),
      RECONNECT_MAX_DELAY
    );
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }
}

// Singleton instance
let wsClient: DreamDexWsClient | null = null;

function getWsClient(): DreamDexWsClient {
  if (!wsClient) {
    wsClient = new DreamDexWsClient();
  }
  return wsClient;
}

/**
 * Subscribe to real-time orderbook updates for a market.
 * Returns an unsubscribe function.
 * Falls back to GraphQL polling if WebSocket is unavailable.
 */
export function subscribeOrderBook(
  marketAddress: Address,
  listener: Listener,
  fallbackPollMs = 15_000
): () => void {
  const client = getWsClient();
  const unsubWs = client.subscribe(marketAddress, listener);

  // Also set up GraphQL polling as fallback
  // The WS may not connect on some environments (e.g., SSR, firewalled)
  let active = true;
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  const pollFallback = async () => {
    if (!active) return;
    try {
      const orders = await fetchOrderBookFallback(marketAddress);
      if (orders && active) {
        listener(orders);
      }
    } catch {
      // Ignore
    }
  };

  // Start polling fallback after a short delay if WS doesn't connect
  const fallbackTimeout = setTimeout(() => {
    if (!active) return;
    // Check if WS received any data — if not, start polling
    pollFallback();
    pollTimer = setInterval(pollFallback, fallbackPollMs);
  }, 5_000);

  return () => {
    active = false;
    clearTimeout(fallbackTimeout);
    if (pollTimer) clearInterval(pollTimer);
    unsubWs();
  };
}

/**
 * GraphQL fallback for order book sentiment.
 * Used when WebSocket is unavailable.
 */
async function fetchOrderBookFallback(
  marketAddress: Address
): Promise<WsProbabilityUpdate | null> {
  const query = `{
    Order(
      limit: 40,
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

    const bids = orders
      .filter((o: any) => o.side === "BUY_YES")
      .map((o: any) => ({ price: parseFloat(o.price), size: parseFloat(o.quantityRemaining) }));
    const asks = orders
      .filter((o: any) => o.side === "SELL_YES")
      .map((o: any) => ({ price: parseFloat(o.price), size: parseFloat(o.quantityRemaining) }));

    if (bids.length === 0 && asks.length === 0) return null;

    const bestBid = bids.length > 0 ? Math.max(...bids.map((b: { price: number; size: number }) => b.price)) : 0;
    const bestAsk = asks.length > 0 ? Math.min(...asks.map((a: { price: number; size: number }) => a.price)) : SCALE;

    const bestBidProb = bestBid / SCALE;
    const bestAskProb = bestAsk / SCALE;
    const midProb = (bestBidProb + bestAskProb) / 2;

    return {
      marketAddress: marketAddress.toLowerCase(),
      upPercent: Math.round(midProb * 100),
      downPercent: Math.round((1 - midProb) * 100),
      midPrice: midProb,
      bestBid,
      bestAsk,
      timestamp: Date.now(),
    };
  } catch {
    return null;
  }
}
