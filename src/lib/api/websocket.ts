import { WS_BASE_URL } from "./client";

export type WebSocketEventHandler = (event: { type: string; payload: any; timestamp: string }) => void;

function getActiveRestaurantId(): string {
  if (typeof window !== "undefined") {
    try {
      const sess = localStorage.getItem("chotu_user_session");
      if (sess) {
        const parsed = JSON.parse(sess);
        if (parsed.restaurantId) return parsed.restaurantId;
      }
    } catch {
      // fallback
    }
  }
  return "default";
}

class WebSocketClient {
  private socket: WebSocket | null = null;
  private restaurantId: string = "default";
  private listeners: Set<WebSocketEventHandler> = new Set();
  private reconnectTimeout: any = null;
  private pingInterval: any = null;

  public connect(restaurantId?: string) {
    if (typeof window === "undefined") return;
    const resolvedId = restaurantId || getActiveRestaurantId();
    this.restaurantId = resolvedId;

    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      const url = `${WS_BASE_URL}/ws/${resolvedId}`;
      this.socket = new WebSocket(url);

      this.socket.onopen = () => {
        // Connected
        if (this.pingInterval) clearInterval(this.pingInterval);
        this.pingInterval = setInterval(() => {
          if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send("ping");
          }
        }, 25000);
      };

      this.socket.onmessage = (event) => {
        if (event.data === "pong") return;
        try {
          const parsed = JSON.parse(event.data);
          const rawEvent = parsed.event || parsed.type || "";
          const normalized = {
            ...parsed,
            event: rawEvent,
            type: parsed.type || (rawEvent ? String(rawEvent).toLowerCase() : ""),
            data: parsed.data || parsed.payload || {},
            payload: parsed.payload || parsed.data || {},
            timestamp: parsed.timestamp || new Date().toISOString(),
          };
          this.listeners.forEach((handler) => handler(normalized));
        } catch {
          // Non-json frame
        }
      };

      this.socket.onclose = () => {
        this.cleanup();
        this.scheduleReconnect();
      };

      this.socket.onerror = () => {
        if (this.socket) {
          this.socket.close();
        }
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = setTimeout(() => {
      this.connect(this.restaurantId);
    }, 4000);
  }

  private cleanup() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  public subscribe(handler: WebSocketEventHandler): () => void {
    this.listeners.add(handler);
    return () => {
      this.listeners.delete(handler);
    };
  }

  public disconnect() {
    this.cleanup();
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}

export const wsClient = new WebSocketClient();
