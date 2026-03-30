import WebSocket from "ws";
import { parseMessage, type RingMessage } from "../shared/protocol.js";

export interface ListenerEvents {
  onMessage: (msg: RingMessage) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onError: (err: Error) => void;
}

/**
 * Cliente WebSocket que conecta el daemon al ring.
 * Maneja reconexión automática con backoff exponencial.
 */
export class Listener {
  private ws: WebSocket | null = null;
  private url: string;
  private name: string;
  private events: ListenerEvents;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private destroyed = false;

  constructor(url: string, name: string, events: ListenerEvents) {
    this.url = url;
    this.name = name;
    this.events = events;
  }

  /**
   * Conecta al ring como "Claude-<name>".
   */
  connect(): void {
    this.ws = new WebSocket(this.url, {
      headers: { "x-participant-name": `Claude-${this.name}` },
    });

    this.ws.on("open", () => {
      console.log(`[listener] Connected to ${this.url} as Claude-${this.name}`);
      this.reconnectAttempts = 0;
      this.events.onConnect();
    });

    this.ws.on("message", (data: Buffer) => {
      const msg = parseMessage(data.toString());
      if (msg) {
        this.events.onMessage(msg);
      }
    });

    this.ws.on("close", () => {
      console.log(`[listener] Disconnected from ${this.url}`);
      this.events.onDisconnect();
      if (!this.destroyed) {
        this.reconnect();
      }
    });

    this.ws.on("error", (err: Error) => {
      console.error(`[listener] WebSocket error:`, err.message);
      this.events.onError(err);
    });
  }

  /**
   * Envía un mensaje JSON al ring.
   */
  send(data: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    } else {
      console.warn("[listener] Cannot send: not connected");
    }
  }

  /**
   * Destruye el listener y previene reconexión.
   */
  destroy(): void {
    console.log("[listener] Destroying...");
    this.destroyed = true;
    this.ws?.close();
  }

  /**
   * Reconecta con backoff exponencial (máx 30s).
   */
  private reconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      const err = new Error("Max reconnection attempts reached");
      console.error("[listener]", err.message);
      this.events.onError(err);
      return;
    }

    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30000);
    this.reconnectAttempts++;

    console.log(
      `[listener] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
    );

    setTimeout(() => {
      if (!this.destroyed) {
        this.connect();
      }
    }, delay);
  }
}
