import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import { createSystemEvent, type RingMessage } from "../shared/protocol.js";
import { MESSAGE_BUFFER_SIZE } from "../shared/config.js";

interface Participant {
  name: string;
  ws: WebSocket;
  lastSeq: number;
}

export class RingServer {
  private wss: WebSocketServer | null = null;
  private participants: Map<WebSocket, Participant> = new Map();
  private messageBuffer: RingMessage[] = [];
  private port: number;

  constructor(port: number) {
    this.port = port;
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.wss = new WebSocketServer({ port: this.port }, () => {
        resolve();
      });

      this.wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
        const name = (req.headers["x-participant-name"] as string) || "Anonymous";
        this.participants.set(ws, { name, ws, lastSeq: -1 });

        // Snapshot the buffer at connection time for catch-up delivery
        const catchUpSnapshot = [...this.messageBuffer];

        // Broadcast join event to existing participants
        const count = this.participants.size;
        const joinEvent = createSystemEvent(
          `${name} has joined the ring`,
          count
        );
        this.broadcast(joinEvent, ws);
        // Also send to the joining client so they know the count
        ws.send(JSON.stringify(joinEvent));
        this.addToBuffer(joinEvent);

        // Send catch-up snapshot to new connection after a short delay so the
        // client's "open" handler and any downstream listeners are registered
        setTimeout(() => {
          for (const msg of catchUpSnapshot) {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify(msg));
            }
          }
        }, 10);

        ws.on("message", (data: Buffer) => {
          try {
            const msg: RingMessage = JSON.parse(data.toString());
            const participant = this.participants.get(ws);

            // Deduplicate by seq: drop messages with seq <= lastSeq
            if (
              participant &&
              msg.type === "message" &&
              msg.seq <= participant.lastSeq
            ) {
              return;
            }
            if (participant && msg.type === "message") {
              participant.lastSeq = msg.seq;
            }

            this.addToBuffer(msg);
            this.broadcast(msg, ws);
          } catch {
            // Ignore malformed messages
          }
        });

        ws.on("close", () => {
          const participant = this.participants.get(ws);
          this.participants.delete(ws);
          if (participant) {
            const leaveEvent = createSystemEvent(
              `${participant.name} has left the ring`,
              this.participants.size
            );
            this.broadcast(leaveEvent);
            this.addToBuffer(leaveEvent);
          }
        });
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      for (const [ws] of this.participants) {
        ws.close();
      }
      this.participants.clear();
      this.wss?.close(() => resolve());
    });
  }

  getParticipants(): string[] {
    return Array.from(this.participants.values()).map((p) => p.name);
  }

  private broadcast(msg: RingMessage, exclude?: WebSocket): void {
    const data = JSON.stringify(msg);
    for (const [ws] of this.participants) {
      if (ws !== exclude && ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    }
  }

  private addToBuffer(msg: RingMessage): void {
    this.messageBuffer.push(msg);
    if (this.messageBuffer.length > MESSAGE_BUFFER_SIZE) {
      this.messageBuffer.shift();
    }
  }
}
