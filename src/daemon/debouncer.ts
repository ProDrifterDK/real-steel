import type { ChatMessage, RingMessage } from "../shared/protocol.js";

type DebouncerCallback = (messages: RingMessage[]) => void;

export class Debouncer {
  private buffer: RingMessage[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private debounceMs: number;
  private callback: DebouncerCallback;

  constructor(debounceMs: number, callback: DebouncerCallback) {
    this.debounceMs = debounceMs;
    this.callback = callback;
  }

  push(msg: RingMessage): void {
    this.buffer.push(msg);
    this.resetTimer();
  }

  destroy(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.buffer = [];
  }

  private resetTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => this.flush(), this.debounceMs);
  }

  private flush(): void {
    const messages = this.buffer;
    this.buffer = [];
    this.timer = null;

    if (messages.length === 0) return;

    // Circuit breaker: require at least one human message
    const hasHumanMessage = messages.some(
      (msg) => msg.type === "message" && (msg as ChatMessage).role === "human"
    );

    if (!hasHumanMessage) return;

    this.callback(messages);
  }
}
