# Real Steel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a collaborative terminal chat where 2+ humans work alongside their Claude Code AI agents in a shared "ring".

**Architecture:** A single CLI tool (`real-steel`) with four components: a WebSocket relay server (the ring), an Ink-based chat TUI, a daemon that bridges the ring to Claude Code via `--resume --print`, and a privacy filter. Each participant runs the CLI locally; the server is exposed via automatic tunnel for remote access.

**Tech Stack:** TypeScript, Node.js, Ink (React for terminal), ws (WebSocket), vitest (testing), commander (CLI)

**Spec:** `docs/superpowers/specs/2026-03-24-real-steel-design.md`

---

## File Structure

```
real-steel/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── src/
│   ├── cli.ts                  → Entry point, parses serve/join commands
│   ├── server/
│   │   ├── ring.ts             → WebSocket broadcast relay server
│   │   └── tunnel.ts           → Expose server via localtunnel
│   ├── client/
│   │   ├── App.tsx             → Ink root component, wires TUI together
│   │   ├── ChatView.tsx        → Scrollable message list with date separators
│   │   ├── MessageBubble.tsx   → Single message: timestamp, name, content, markdown
│   │   ├── InputBar.tsx        → Text input at bottom
│   │   ├── Header.tsx          → Ring URL + participant count
│   │   └── hooks/
│   │       └── useRing.ts      → WebSocket connection hook with reconnect
│   ├── daemon/
│   │   ├── daemon.ts           → Orchestrator: wires listener+debouncer+bridge
│   │   ├── listener.ts         → WebSocket client, receives ring messages
│   │   ├── debouncer.ts        → Accumulates messages, fires on pause
│   │   └── bridge.ts           → Invokes claude CLI, parses response
│   ├── shared/
│   │   ├── protocol.ts         → Message types, serialization, UUID generation
│   │   └── config.ts           → Config types and defaults
│   └── privacy/
│       └── filter.ts           → Generates system prompt from privacy config
└── tests/
    ├── server/
    │   └── ring.test.ts
    ├── daemon/
    │   ├── debouncer.test.ts
    │   ├── bridge.test.ts
    │   └── daemon.test.ts
    ├── privacy/
    │   └── filter.test.ts
    └── shared/
        └── protocol.test.ts
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `src/shared/protocol.ts` (placeholder)

- [ ] **Step 1: Initialize npm project**

```bash
cd "/home/prodrifterdk/Documentos/projects/Real Steel"
npm init -y
```

Update `package.json` name to `real-steel`, set `"type": "module"`, add `"bin"`:

```json
{
  "name": "real-steel",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "real-steel": "./dist/cli.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 2: Install dependencies**

```bash
npm install ws commander uuid ink ink-text-input react marked marked-terminal localtunnel
npm install -D typescript @types/node @types/ws @types/react @types/uuid @types/marked-terminal vitest ink-testing-library
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "jsx": "react-jsx",
    "jsxImportSource": "react",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 4: Create vitest.config.ts**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
  },
});
```

- [ ] **Step 5: Verify setup compiles**

Create a minimal placeholder:

```bash
mkdir -p src/shared
echo 'export const VERSION = "0.1.0";' > src/shared/protocol.ts
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Create .gitignore**

```
node_modules/
dist/
*.tsbuildinfo
```

- [ ] **Step 7: Commit**

```bash
git add .gitignore package.json package-lock.json tsconfig.json vitest.config.ts src/shared/protocol.ts
git commit -m "chore: scaffold project with TypeScript, Ink, ws, vitest"
```

---

## Task 2: Shared Protocol Types

**Files:**
- Create: `src/shared/protocol.ts`
- Create: `src/shared/config.ts`
- Test: `tests/shared/protocol.test.ts`

- [ ] **Step 1: Write the failing tests for protocol**

Create `tests/shared/protocol.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  createChatMessage,
  createSystemEvent,
  parseMessage,
  type ChatMessage,
  type SystemEvent,
  type RingMessage,
} from "../src/shared/protocol.js";

describe("protocol", () => {
  describe("createChatMessage", () => {
    it("creates a human chat message with id, seq, and timestamp", () => {
      const msg = createChatMessage("Pedro", "human", "hello", 1);
      expect(msg.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
      expect(msg.seq).toBe(1);
      expect(msg.type).toBe("message");
      expect(msg.from).toBe("Pedro");
      expect(msg.role).toBe("human");
      expect(msg.content).toBe("hello");
      expect(msg.timestamp).toBeDefined();
    });

    it("creates an agent chat message", () => {
      const msg = createChatMessage("Claude-Pedro", "agent", "I see the issue", 5);
      expect(msg.role).toBe("agent");
      expect(msg.from).toBe("Claude-Pedro");
    });
  });

  describe("createSystemEvent", () => {
    it("creates a system event with type system", () => {
      const evt = createSystemEvent("Pedro has joined the ring");
      expect(evt.type).toBe("system");
      expect(evt.content).toBe("Pedro has joined the ring");
      expect(evt.id).toBeDefined();
    });
  });

  describe("parseMessage", () => {
    it("parses a valid chat message JSON string", () => {
      const msg = createChatMessage("Pedro", "human", "test", 1);
      const json = JSON.stringify(msg);
      const parsed = parseMessage(json);
      expect(parsed).toEqual(msg);
    });

    it("returns null for invalid JSON", () => {
      expect(parseMessage("not json")).toBeNull();
    });

    it("returns null for JSON missing required fields", () => {
      expect(parseMessage('{"type": "message"}')).toBeNull();
    });

    it("returns null for message missing seq or timestamp", () => {
      expect(
        parseMessage('{"type": "message", "id": "x", "from": "A", "role": "human", "content": "hi"}')
      ).toBeNull();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/shared/protocol.test.ts
```

Expected: FAIL - cannot find module.

- [ ] **Step 3: Implement protocol.ts**

Write `src/shared/protocol.ts`:

```typescript
import { v4 as uuidv4 } from "uuid";

export type Role = "human" | "agent";

export interface ChatMessage {
  id: string;
  seq: number;
  type: "message";
  from: string;
  role: Role;
  content: string;
  timestamp: string;
}

export interface SystemEvent {
  id: string;
  seq: number;
  type: "system";
  content: string;
  timestamp: string;
}

export type RingMessage = ChatMessage | SystemEvent;

export function createChatMessage(
  from: string,
  role: Role,
  content: string,
  seq: number
): ChatMessage {
  return {
    id: uuidv4(),
    seq,
    type: "message",
    from,
    role,
    content,
    timestamp: new Date().toISOString(),
  };
}

export function createSystemEvent(content: string): SystemEvent {
  return {
    id: uuidv4(),
    seq: 0,
    type: "system",
    content,
    timestamp: new Date().toISOString(),
  };
}

export function parseMessage(raw: string): RingMessage | null {
  try {
    const data = JSON.parse(raw);
    if (data.type === "message") {
      if (
        !data.id || !data.from || !data.role ||
        data.content === undefined || data.seq === undefined ||
        !data.timestamp
      ) {
        return null;
      }
      return data as ChatMessage;
    }
    if (data.type === "system") {
      if (!data.id || data.content === undefined || !data.timestamp) {
        return null;
      }
      return data as SystemEvent;
    }
    return null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/shared/protocol.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Implement config.ts**

Write `src/shared/config.ts`:

```typescript
export type PrivacyMode = "whitelist" | "blacklist" | "claude-decides";

export interface PrivacyConfig {
  mode: PrivacyMode;
  paths: string[];
}

export interface DaemonConfig {
  debounceMs: number;
  maxInvocationsPerMinute: number;
  privacy: PrivacyConfig;
}

export interface JoinConfig {
  ringUrl: string;
  name: string;
  noClaude: boolean;
  daemon: DaemonConfig;
}

export interface ServeConfig {
  port: number;
  customUrl?: string;
}

export const DEFAULT_DAEMON_CONFIG: DaemonConfig = {
  debounceMs: 5000,
  maxInvocationsPerMinute: 2,
  privacy: {
    mode: "whitelist",
    paths: [],
  },
};

export const DEFAULT_PORT = 3000;
export const MESSAGE_BUFFER_SIZE = 200;
```

- [ ] **Step 6: Verify compilation**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/shared/ tests/shared/
git commit -m "feat: add shared protocol types and config defaults"
```

---

## Task 3: Ring Server

**Files:**
- Create: `src/server/ring.ts`
- Test: `tests/server/ring.test.ts`

- [ ] **Step 1: Write failing tests for the ring server**

Create `tests/server/ring.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import WebSocket from "ws";
import { RingServer } from "../src/server/ring.js";
import { type RingMessage, createChatMessage } from "../src/shared/protocol.js";

function connectClient(port: number, name: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}`, {
      headers: { "x-participant-name": name },
    });
    ws.on("open", () => resolve(ws));
    ws.on("error", reject);
  });
}

function waitForMessage(ws: WebSocket): Promise<RingMessage> {
  return new Promise((resolve) => {
    ws.once("message", (data) => {
      resolve(JSON.parse(data.toString()));
    });
  });
}

describe("RingServer", () => {
  let server: RingServer;
  const port = 9871;

  beforeEach(async () => {
    server = new RingServer(port);
    await server.start();
  });

  afterEach(async () => {
    await server.stop();
  });

  it("broadcasts a message to all other connected clients", async () => {
    const client1 = await connectClient(port, "Pedro");
    const client2 = await connectClient(port, "Samuel");

    const msgPromise = waitForMessage(client2);

    const msg = createChatMessage("Pedro", "human", "hello", 1);
    client1.send(JSON.stringify(msg));

    const received = await msgPromise;
    expect(received.type).toBe("message");
    expect((received as any).content).toBe("hello");

    client1.close();
    client2.close();
  });

  it("does not echo message back to sender", async () => {
    const client1 = await connectClient(port, "Pedro");
    const client2 = await connectClient(port, "Samuel");

    let client1Received = false;
    client1.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === "message") client1Received = true;
    });

    const msg = createChatMessage("Pedro", "human", "hello", 1);
    client1.send(JSON.stringify(msg));

    // Wait for client2 to receive it (confirms broadcast happened)
    await waitForMessage(client2);

    // Give a brief window for client1 to potentially receive it
    await new Promise((r) => setTimeout(r, 100));
    expect(client1Received).toBe(false);

    client1.close();
    client2.close();
  });

  it("sends system events on connect and disconnect", async () => {
    const client1 = await connectClient(port, "Pedro");
    const joinPromise = waitForMessage(client1);

    const client2 = await connectClient(port, "Samuel");
    const joinMsg = await joinPromise;
    expect(joinMsg.type).toBe("system");
    expect(joinMsg.content).toContain("Samuel");

    const leavePromise = waitForMessage(client1);
    client2.close();
    const leaveMsg = await leavePromise;
    expect(leaveMsg.type).toBe("system");
    expect(leaveMsg.content).toContain("Samuel");

    client1.close();
  });

  it("sends catch-up buffer to new connections", async () => {
    const client1 = await connectClient(port, "Pedro");

    // Send a message before client2 connects
    const msg = createChatMessage("Pedro", "human", "earlier message", 1);
    client1.send(JSON.stringify(msg));

    // Small delay to ensure server processed it
    await new Promise((r) => setTimeout(r, 50));

    const client2 = await connectClient(port, "Samuel");

    // client2 should receive the catch-up message(s) + join system event
    // The first messages will be catch-up, then system events
    const received = await waitForMessage(client2);
    // Could be catch-up or system event depending on ordering
    expect(received).toBeDefined();

    client1.close();
    client2.close();
  });

  it("returns participant list", async () => {
    const client1 = await connectClient(port, "Pedro");
    const client2 = await connectClient(port, "Samuel");

    // Give time for connections to register
    await new Promise((r) => setTimeout(r, 50));

    expect(server.getParticipants()).toContain("Pedro");
    expect(server.getParticipants()).toContain("Samuel");

    client1.close();
    client2.close();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/server/ring.test.ts
```

Expected: FAIL - cannot find module `../src/server/ring.js`.

- [ ] **Step 3: Implement ring.ts**

Write `src/server/ring.ts`:

```typescript
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
        const name = req.headers["x-participant-name"] as string || "Anonymous";
        this.participants.set(ws, { name, ws, lastSeq: -1 });

        // Send catch-up buffer to new connection
        for (const msg of this.messageBuffer) {
          ws.send(JSON.stringify(msg));
        }

        // Broadcast join event
        const joinEvent = createSystemEvent(`${name} has joined the ring`);
        this.broadcast(joinEvent, ws);
        this.addToBuffer(joinEvent);

        ws.on("message", (data: Buffer) => {
          try {
            const msg: RingMessage = JSON.parse(data.toString());
            const participant = this.participants.get(ws);

            // Deduplicate by seq: drop messages with seq <= lastSeq
            if (participant && msg.type === "message" && msg.seq <= participant.lastSeq) {
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
              `${participant.name} has left the ring`
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/server/ring.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/ring.ts tests/server/ring.test.ts
git commit -m "feat: add ring server with broadcast, participant tracking, and message buffer"
```

---

## Task 4: Tunnel

**Files:**
- Create: `src/server/tunnel.ts`

This is a thin wrapper around localtunnel. No unit tests needed as it wraps an external service - tested via integration.

- [ ] **Step 1: Implement tunnel.ts**

Write `src/server/tunnel.ts`:

```typescript
import localtunnel from "localtunnel";

export interface TunnelInfo {
  url: string;
  close: () => void;
}

export async function openTunnel(port: number): Promise<TunnelInfo> {
  const tunnel = await localtunnel({ port });

  tunnel.on("error", (err: Error) => {
    console.error("Tunnel error:", err.message);
  });

  tunnel.on("close", () => {
    console.error("Tunnel closed unexpectedly");
  });

  return {
    url: tunnel.url.replace("https://", "wss://").replace("http://", "ws://"),
    close: () => tunnel.close(),
  };
}
```

- [ ] **Step 2: Create localtunnel type declarations**

Create `src/server/localtunnel.d.ts` (localtunnel does not ship types):

```typescript
declare module "localtunnel" {
  interface Tunnel {
    url: string;
    on(event: string, cb: (...args: any[]) => void): void;
    close(): void;
  }
  interface Options {
    port: number;
    subdomain?: string;
  }
  export default function localtunnel(opts: Options): Promise<Tunnel>;
}
```

- [ ] **Step 3: Verify compilation**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/server/tunnel.ts src/server/localtunnel.d.ts
git commit -m "feat: add tunnel wrapper for exposing ring server to internet"
```

---

## Task 5: Privacy Filter

**Files:**
- Create: `src/privacy/filter.ts`
- Test: `tests/privacy/filter.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/privacy/filter.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { generatePrivacyPrompt, generateToolRestrictions } from "../src/privacy/filter.js";
import type { PrivacyConfig } from "../src/shared/config.js";

describe("privacy filter", () => {
  describe("generatePrivacyPrompt", () => {
    it("generates whitelist prompt with paths", () => {
      const config: PrivacyConfig = { mode: "whitelist", paths: ["/repo-x", "/project-y"] };
      const prompt = generatePrivacyPrompt(config);
      expect(prompt).toContain("whitelist");
      expect(prompt).toContain("/repo-x");
      expect(prompt).toContain("/project-y");
    });

    it("generates blacklist prompt with paths", () => {
      const config: PrivacyConfig = { mode: "blacklist", paths: [".env", "credentials"] };
      const prompt = generatePrivacyPrompt(config);
      expect(prompt).toContain("Do not share");
      expect(prompt).toContain(".env");
    });

    it("generates claude-decides prompt", () => {
      const config: PrivacyConfig = { mode: "claude-decides", paths: [] };
      const prompt = generatePrivacyPrompt(config);
      expect(prompt).toContain("judgment");
    });
  });

  describe("generateToolRestrictions", () => {
    it("returns allowedTools for whitelist mode", () => {
      const config: PrivacyConfig = { mode: "whitelist", paths: ["/repo-x"] };
      const restrictions = generateToolRestrictions(config);
      expect(restrictions.type).toBe("allowed");
      expect(restrictions.tools).toContain("Read(/repo-x/*)");
    });

    it("returns disallowedTools for blacklist mode", () => {
      const config: PrivacyConfig = { mode: "blacklist", paths: [".env"] };
      const restrictions = generateToolRestrictions(config);
      expect(restrictions.type).toBe("disallowed");
      expect(restrictions.tools).toContain("Read(*.env*)");
    });

    it("returns no restrictions for claude-decides mode", () => {
      const config: PrivacyConfig = { mode: "claude-decides", paths: [] };
      const restrictions = generateToolRestrictions(config);
      expect(restrictions.type).toBe("none");
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/privacy/filter.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement filter.ts**

Write `src/privacy/filter.ts`:

```typescript
import type { PrivacyConfig } from "../shared/config.js";

export interface ToolRestrictions {
  type: "allowed" | "disallowed" | "none";
  tools: string[];
}

export function generatePrivacyPrompt(config: PrivacyConfig): string {
  switch (config.mode) {
    case "whitelist": {
      const pathList = config.paths.join(", ");
      return (
        `Privacy mode: whitelist. You may only share information from these allowed paths: ${pathList}. ` +
        `Do not reference, quote, or describe the contents of any file outside these paths.`
      );
    }
    case "blacklist": {
      const pathList = config.paths.join(", ");
      return (
        `Privacy mode: blacklist. Do not share anything related to: ${pathList}. ` +
        `Do not reference, quote, or describe the contents of files matching those patterns.`
      );
    }
    case "claude-decides":
      return (
        `Privacy mode: use your judgment. You have full access to the local file system. ` +
        `Decide what is appropriate to share based on context. Avoid sharing secrets, credentials, or personal data.`
      );
  }
}

export function generateToolRestrictions(config: PrivacyConfig): ToolRestrictions {
  switch (config.mode) {
    case "whitelist":
      return {
        type: "allowed",
        tools: config.paths.map((p) => `Read(${p}/*)`),
      };
    case "blacklist":
      return {
        type: "disallowed",
        tools: config.paths.map((p) => `Read(*${p}*)`),
      };
    case "claude-decides":
      return { type: "none", tools: [] };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/privacy/filter.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/privacy/filter.ts tests/privacy/filter.test.ts
git commit -m "feat: add privacy filter with whitelist/blacklist/claude-decides modes"
```

---

## Task 6: Daemon - Debouncer

**Files:**
- Create: `src/daemon/debouncer.ts`
- Test: `tests/daemon/debouncer.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/daemon/debouncer.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Debouncer } from "../src/daemon/debouncer.js";
import { createChatMessage } from "../src/shared/protocol.js";

describe("Debouncer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires callback after debounce period with accumulated messages", async () => {
    const callback = vi.fn();
    const debouncer = new Debouncer(1000, callback);

    const msg1 = createChatMessage("Pedro", "human", "hello", 1);
    const msg2 = createChatMessage("Samuel", "human", "hi", 1);

    debouncer.push(msg1);
    debouncer.push(msg2);

    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith([msg1, msg2]);
  });

  it("resets timer when new message arrives within debounce period", () => {
    const callback = vi.fn();
    const debouncer = new Debouncer(1000, callback);

    debouncer.push(createChatMessage("Pedro", "human", "msg1", 1));
    vi.advanceTimersByTime(800);
    debouncer.push(createChatMessage("Pedro", "human", "msg2", 2));
    vi.advanceTimersByTime(800);

    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(200);

    expect(callback).toHaveBeenCalledTimes(1);
    const msgs = callback.mock.calls[0][0];
    expect(msgs).toHaveLength(2);
  });

  it("does not fire if batch contains only agent messages (circuit breaker)", () => {
    const callback = vi.fn();
    const debouncer = new Debouncer(1000, callback);

    debouncer.push(createChatMessage("Claude-Pedro", "agent", "I think...", 1));
    debouncer.push(createChatMessage("Claude-Samuel", "agent", "I agree...", 1));

    vi.advanceTimersByTime(1000);

    expect(callback).not.toHaveBeenCalled();
  });

  it("fires if batch contains at least one human message mixed with agent messages", () => {
    const callback = vi.fn();
    const debouncer = new Debouncer(1000, callback);

    debouncer.push(createChatMessage("Claude-Pedro", "agent", "I think...", 1));
    debouncer.push(createChatMessage("Samuel", "human", "interesting", 1));

    vi.advanceTimersByTime(1000);

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("clears accumulated messages after firing", () => {
    const callback = vi.fn();
    const debouncer = new Debouncer(1000, callback);

    debouncer.push(createChatMessage("Pedro", "human", "first batch", 1));
    vi.advanceTimersByTime(1000);

    debouncer.push(createChatMessage("Samuel", "human", "second batch", 1));
    vi.advanceTimersByTime(1000);

    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback.mock.calls[0][0]).toHaveLength(1);
    expect(callback.mock.calls[1][0]).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/daemon/debouncer.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement debouncer.ts**

Write `src/daemon/debouncer.ts`:

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/daemon/debouncer.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/daemon/debouncer.ts tests/daemon/debouncer.test.ts
git commit -m "feat: add debouncer with configurable delay and agent loop circuit breaker"
```

---

## Task 7: Daemon - Bridge (Claude Code Invocation)

**Files:**
- Create: `src/daemon/bridge.ts`
- Test: `tests/daemon/bridge.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/daemon/bridge.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ClaudeBridge, formatMessagesForClaude } from "../src/daemon/bridge.js";
import { createChatMessage } from "../src/shared/protocol.js";

describe("formatMessagesForClaude", () => {
  it("formats messages as timestamped lines", () => {
    const msgs = [
      createChatMessage("Pedro", "human", "hello", 1),
      createChatMessage("Samuel", "human", "hi there", 1),
    ];
    const formatted = formatMessagesForClaude(msgs);
    expect(formatted).toContain("Pedro");
    expect(formatted).toContain("hello");
    expect(formatted).toContain("Samuel");
    expect(formatted).toContain("hi there");
  });

  it("includes role prefix for agent messages", () => {
    const msgs = [
      createChatMessage("Claude-Pedro", "agent", "I see the issue", 1),
    ];
    const formatted = formatMessagesForClaude(msgs);
    expect(formatted).toContain("Claude-Pedro");
    expect(formatted).toContain("I see the issue");
  });
});

describe("ClaudeBridge", () => {
  describe("rate limiting", () => {
    it("respects max invocations per minute", () => {
      const bridge = new ClaudeBridge({
        userName: "Pedro",
        maxInvocationsPerMinute: 2,
        systemPrompt: "test",
        permissionMode: "auto",
      });

      expect(bridge.canInvoke()).toBe(true);
      bridge.recordInvocation();
      expect(bridge.canInvoke()).toBe(true);
      bridge.recordInvocation();
      expect(bridge.canInvoke()).toBe(false);
    });
  });

  describe("busy lock", () => {
    it("tracks busy state", () => {
      const bridge = new ClaudeBridge({
        userName: "Pedro",
        maxInvocationsPerMinute: 10,
        systemPrompt: "test",
        permissionMode: "auto",
      });

      expect(bridge.isBusy()).toBe(false);
      bridge.setBusy(true);
      expect(bridge.isBusy()).toBe(true);
      bridge.setBusy(false);
      expect(bridge.isBusy()).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/daemon/bridge.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement bridge.ts**

Write `src/daemon/bridge.ts`:

```typescript
import { spawn } from "child_process";
import { v4 as uuidv4 } from "uuid";
import type { RingMessage, ChatMessage } from "../shared/protocol.js";

export interface BridgeConfig {
  userName: string;
  maxInvocationsPerMinute: number;
  systemPrompt: string;
  permissionMode: string;
  toolRestrictions?: { type: string; tools: string[] };
}

export function formatMessagesForClaude(messages: RingMessage[]): string {
  return messages
    .map((msg) => {
      if (msg.type === "system") {
        return `[system]: ${msg.content}`;
      }
      const time = new Date(msg.timestamp).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      return `[${time} ${msg.from}]: ${msg.content}`;
    })
    .join("\n");
}

export class ClaudeBridge {
  private sessionId: string | null = null;
  private busy = false;
  private invocationTimestamps: number[] = [];
  private config: BridgeConfig;

  constructor(config: BridgeConfig) {
    this.config = config;
  }

  isBusy(): boolean {
    return this.busy;
  }

  setBusy(busy: boolean): void {
    this.busy = busy;
  }

  canInvoke(): boolean {
    const now = Date.now();
    const oneMinuteAgo = now - 60_000;
    this.invocationTimestamps = this.invocationTimestamps.filter(
      (t) => t > oneMinuteAgo
    );
    return this.invocationTimestamps.length < this.config.maxInvocationsPerMinute;
  }

  recordInvocation(): void {
    this.invocationTimestamps.push(Date.now());
  }

  async invoke(messages: RingMessage[]): Promise<string | null> {
    if (!this.canInvoke()) return null;

    this.setBusy(true);
    this.recordInvocation();

    try {
      const formatted = formatMessagesForClaude(messages);
      const prompt =
        `New messages in the ring:\n${formatted}\n\n` +
        `Respond only if you have something genuinely useful to contribute. ` +
        `If you have nothing to add, respond with exactly: [SILENT]`;

      const args = this.buildArgs(prompt);
      const response = await this.execClaude(args);

      return this.parseResponse(response);
    } finally {
      this.setBusy(false);
    }
  }

  private parseResponse(raw: string): string | null {
    if (!raw) return null;

    try {
      // --output-format json returns a JSON object with a "result" field
      const data = JSON.parse(raw);
      const text = data.result || "";
      if (!text || text.trim().toUpperCase() === "[SILENT]") {
        return null;
      }
      // Capture session ID from first invocation if available
      if (!this.sessionId && data.session_id) {
        this.sessionId = data.session_id;
      }
      return text.trim();
    } catch {
      // Fallback: treat as plain text
      if (!raw.trim() || raw.trim().toUpperCase() === "[SILENT]") {
        return null;
      }
      return raw.trim();
    }
  }

  private buildArgs(prompt: string): string[] {
    const args = [
      "--print",
      "--output-format",
      "json",
      "--permission-mode",
      this.config.permissionMode,
    ];

    if (this.sessionId) {
      args.push("--resume", this.sessionId);
    } else {
      this.sessionId = uuidv4();
      args.push("--session-id", this.sessionId);
      args.push("--append-system-prompt", this.config.systemPrompt);
    }

    if (this.config.toolRestrictions) {
      if (this.config.toolRestrictions.type === "allowed") {
        args.push("--allowedTools", ...this.config.toolRestrictions.tools);
      } else if (this.config.toolRestrictions.type === "disallowed") {
        args.push("--disallowedTools", ...this.config.toolRestrictions.tools);
      }
    }

    args.push(prompt);
    return args;
  }

  private execClaude(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn("claude", args, {
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      proc.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on("close", (code) => {
        if (code !== 0) {
          console.error(`Claude exited with code ${code}: ${stderr}`);
          resolve("");
        } else {
          resolve(stdout);
        }
      });

      proc.on("error", (err) => {
        console.error(`Failed to spawn claude: ${err.message}`);
        resolve("");
      });
    });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/daemon/bridge.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/daemon/bridge.ts tests/daemon/bridge.test.ts
git commit -m "feat: add Claude bridge with rate limiting, busy lock, and session management"
```

---

## Task 8: Daemon - Listener

**Files:**
- Create: `src/daemon/listener.ts`

The listener is a thin WebSocket client wrapper. It will be tested via integration in the daemon orchestrator tests.

- [ ] **Step 1: Implement listener.ts**

Write `src/daemon/listener.ts`:

```typescript
import WebSocket from "ws";
import { parseMessage, type RingMessage } from "../shared/protocol.js";

export interface ListenerEvents {
  onMessage: (msg: RingMessage) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onError: (err: Error) => void;
}

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

  connect(): void {
    this.ws = new WebSocket(this.url, {
      headers: { "x-participant-name": `Claude-${this.name}` },
    });

    this.ws.on("open", () => {
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
      this.events.onDisconnect();
      if (!this.destroyed) {
        this.reconnect();
      }
    });

    this.ws.on("error", (err: Error) => {
      this.events.onError(err);
    });
  }

  send(data: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.ws?.close();
  }

  private reconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.events.onError(new Error("Max reconnection attempts reached"));
      return;
    }

    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30000);
    this.reconnectAttempts++;

    setTimeout(() => {
      if (!this.destroyed) {
        this.connect();
      }
    }, delay);
  }
}
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/daemon/listener.ts
git commit -m "feat: add ring listener with auto-reconnect and exponential backoff"
```

---

## Task 9: Daemon Orchestrator

**Files:**
- Create: `src/daemon/daemon.ts`
- Test: `tests/daemon/daemon.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/daemon/daemon.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import WebSocket from "ws";
import { RingServer } from "../src/server/ring.js";
import { Daemon } from "../src/daemon/daemon.js";
import { createChatMessage } from "../src/shared/protocol.js";
import type { DaemonConfig } from "../src/shared/config.js";

describe("Daemon", () => {
  let server: RingServer;
  const port = 9872;

  const daemonConfig: DaemonConfig = {
    debounceMs: 200,
    maxInvocationsPerMinute: 10,
    privacy: { mode: "claude-decides", paths: [] },
  };

  beforeEach(async () => {
    server = new RingServer(port);
    await server.start();
  });

  afterEach(async () => {
    await server.stop();
  });

  it("connects to the ring as Claude-<name>", async () => {
    const daemon = new Daemon(`ws://localhost:${port}`, "Pedro", daemonConfig);
    await daemon.start();

    // Give time for connection
    await new Promise((r) => setTimeout(r, 100));

    expect(server.getParticipants()).toContain("Claude-Pedro");

    await daemon.stop();
  });

  it("stops cleanly", async () => {
    const daemon = new Daemon(`ws://localhost:${port}`, "Pedro", daemonConfig);
    await daemon.start();
    await new Promise((r) => setTimeout(r, 100));

    await daemon.stop();
    await new Promise((r) => setTimeout(r, 100));

    expect(server.getParticipants()).not.toContain("Claude-Pedro");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/daemon/daemon.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement daemon.ts**

Write `src/daemon/daemon.ts`:

```typescript
import { Listener } from "./listener.js";
import { Debouncer } from "./debouncer.js";
import { ClaudeBridge, formatMessagesForClaude } from "./bridge.js";
import {
  createChatMessage,
  type RingMessage,
  type ChatMessage,
} from "../shared/protocol.js";
import type { DaemonConfig } from "../shared/config.js";
import {
  generatePrivacyPrompt,
  generateToolRestrictions,
} from "../privacy/filter.js";

export class Daemon {
  private listener: Listener;
  private debouncer: Debouncer;
  private bridge: ClaudeBridge;
  private pendingMessages: RingMessage[] = [];
  private url: string;
  private name: string;
  private seq = 0;

  constructor(url: string, name: string, config: DaemonConfig) {
    this.url = url;
    this.name = name;

    const privacyPrompt = generatePrivacyPrompt(config.privacy);
    const toolRestrictions = generateToolRestrictions(config.privacy);

    const systemPrompt =
      `You are in a Real Steel ring - a group chat with other humans and AI agents. ` +
      `You are the agent of ${name}. You participate as an equal. ` +
      `Don't respond to every message - only when you have something genuinely useful to contribute. ` +
      `You have access to the local files and projects of ${name}. ` +
      `When you have nothing to add, respond with exactly: [SILENT]\n\n` +
      `${privacyPrompt}`;

    this.bridge = new ClaudeBridge({
      userName: name,
      maxInvocationsPerMinute: config.maxInvocationsPerMinute,
      systemPrompt,
      permissionMode: "auto",
      toolRestrictions:
        toolRestrictions.type !== "none" ? toolRestrictions : undefined,
    });

    this.debouncer = new Debouncer(config.debounceMs, (messages) =>
      this.handleBatch(messages)
    );

    this.listener = new Listener(url, name, {
      onMessage: (msg) => this.onMessage(msg),
      onConnect: () => console.log(`[daemon] Connected to ring as Claude-${name}`),
      onDisconnect: () => console.log("[daemon] Disconnected from ring"),
      onError: (err) => console.error("[daemon] Error:", err.message),
    });
  }

  async start(): Promise<void> {
    this.listener.connect();
  }

  async stop(): Promise<void> {
    this.debouncer.destroy();

    // Wait for any in-progress Claude invocation to finish
    if (this.bridge.isBusy()) {
      await new Promise<void>((resolve) => {
        const interval = setInterval(() => {
          if (!this.bridge.isBusy()) {
            clearInterval(interval);
            resolve();
          }
        }, 200);
      });
    }

    this.listener.destroy();
  }

  private onMessage(msg: RingMessage): void {
    // Ignore own messages
    if (msg.type === "message" && msg.from === `Claude-${this.name}`) {
      return;
    }

    if (this.bridge.isBusy()) {
      this.pendingMessages.push(msg);
    } else {
      this.debouncer.push(msg);
    }
  }

  private async handleBatch(messages: RingMessage[]): Promise<void> {
    if (this.bridge.isBusy()) {
      this.pendingMessages.push(...messages);
      return;
    }

    const response = await this.bridge.invoke(messages);

    if (response) {
      this.seq++;
      const msg = createChatMessage(
        `Claude-${this.name}`,
        "agent",
        response,
        this.seq
      );
      this.listener.send(JSON.stringify(msg));
    }

    // Process any messages that arrived while Claude was busy
    if (this.pendingMessages.length > 0) {
      const pending = this.pendingMessages;
      this.pendingMessages = [];
      for (const msg of pending) {
        this.debouncer.push(msg);
      }
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/daemon/daemon.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/daemon/daemon.ts tests/daemon/daemon.test.ts
git commit -m "feat: add daemon orchestrator wiring listener, debouncer, and bridge"
```

---

## Task 10: Chat TUI - Core Components

**Files:**
- Create: `src/client/Header.tsx`
- Create: `src/client/MessageBubble.tsx`
- Create: `src/client/InputBar.tsx`

- [ ] **Step 1: Implement Header.tsx**

Write `src/client/Header.tsx`:

```tsx
import React from "react";
import { Box, Text } from "ink";

interface HeaderProps {
  url: string;
  participantCount: number;
}

export function Header({ url, participantCount }: HeaderProps) {
  return (
    <Box
      borderStyle="round"
      borderColor="cyan"
      paddingX={1}
      justifyContent="space-between"
    >
      <Text bold color="cyan">
        Real Steel
      </Text>
      <Text dimColor>{url}</Text>
      <Text color="green">{participantCount} online</Text>
    </Box>
  );
}
```

- [ ] **Step 2: Implement MessageBubble.tsx**

Write `src/client/MessageBubble.tsx`:

```tsx
import React from "react";
import { Box, Text } from "ink";
import { marked } from "marked";
import TerminalRenderer from "marked-terminal";
import type { RingMessage, ChatMessage } from "../shared/protocol.js";

// Configure marked to render markdown as ANSI terminal output
marked.setOptions({
  renderer: new TerminalRenderer(),
});

interface MessageBubbleProps {
  message: RingMessage;
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function renderContent(content: string, isAgent: boolean): string {
  if (isAgent) {
    // Render markdown for agent messages (bold, code blocks, etc.)
    return (marked(content) as string).trimEnd();
  }
  return content;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  if (message.type === "system") {
    return (
      <Box paddingX={1}>
        <Text dimColor italic>
          {formatTime(message.timestamp)} {message.content}
        </Text>
      </Box>
    );
  }

  const chatMsg = message as ChatMessage;
  const isAgent = chatMsg.role === "agent";
  const nameColor = isAgent ? "magenta" : "yellow";
  const prefix = isAgent ? "\u{1F916} " : "";

  return (
    <Box paddingX={1} flexDirection="row" gap={1}>
      <Text dimColor>{formatTime(chatMsg.timestamp)}</Text>
      <Text color={nameColor} bold>
        {prefix}{chatMsg.from}
      </Text>
      <Text>{renderContent(chatMsg.content, isAgent)}</Text>
    </Box>
  );
}
```

- [ ] **Step 3: Implement InputBar.tsx**

Write `src/client/InputBar.tsx`:

```tsx
import React, { useState } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";

interface InputBarProps {
  onSubmit: (text: string) => void;
}

export function InputBar({ onSubmit }: InputBarProps) {
  const [value, setValue] = useState("");

  const handleSubmit = (text: string) => {
    if (text.trim()) {
      onSubmit(text.trim());
      setValue("");
    }
  };

  return (
    <Box borderStyle="round" borderColor="gray" paddingX={1}>
      <Text color="green">&gt; </Text>
      <TextInput value={value} onChange={setValue} onSubmit={handleSubmit} />
    </Box>
  );
}
```

- [ ] **Step 4: Verify compilation**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/client/Header.tsx src/client/MessageBubble.tsx src/client/InputBar.tsx
git commit -m "feat: add chat TUI core components (Header, MessageBubble, InputBar)"
```

---

## Task 11: Chat TUI - useRing Hook and ChatView

**Files:**
- Create: `src/client/hooks/useRing.ts`
- Create: `src/client/ChatView.tsx`

- [ ] **Step 1: Implement useRing.ts**

Write `src/client/hooks/useRing.ts`:

```typescript
import { useState, useEffect, useCallback, useRef } from "react";
import WebSocket from "ws";
import {
  parseMessage,
  createChatMessage,
  type RingMessage,
} from "../../shared/protocol.js";

interface UseRingOptions {
  url: string;
  name: string;
}

interface UseRingResult {
  messages: RingMessage[];
  participants: number;
  connected: boolean;
  sendMessage: (content: string) => void;
}

export function useRing({ url, name }: UseRingOptions): UseRingResult {
  const [messages, setMessages] = useState<RingMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const [participantNames, setParticipantNames] = useState<Set<string>>(new Set());
  const wsRef = useRef<WebSocket | null>(null);
  const seqRef = useRef(0);
  const destroyedRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);

  useEffect(() => {
    destroyedRef.current = false;

    function connect() {
      const ws = new WebSocket(url, {
        headers: { "x-participant-name": name },
      });
      wsRef.current = ws;

      ws.on("open", () => {
        setConnected(true);
        reconnectAttemptsRef.current = 0;
      });

      ws.on("message", (data: Buffer) => {
        const msg = parseMessage(data.toString());
        if (msg) {
          setMessages((prev) => [...prev, msg]);
          // Track participants by name from system events
          if (msg.type === "system") {
            const joinMatch = msg.content.match(/^(.+) has joined the ring$/);
            const leaveMatch = msg.content.match(/^(.+) has left the ring$/);
            if (joinMatch) {
              setParticipantNames((prev) => new Set([...prev, joinMatch[1]]));
            } else if (leaveMatch) {
              setParticipantNames((prev) => {
                const next = new Set(prev);
                next.delete(leaveMatch[1]);
                return next;
              });
            }
          }
        }
      });

      ws.on("close", () => {
        setConnected(false);
        if (!destroyedRef.current) {
          // Reconnect with exponential backoff
          const delay = Math.min(1000 * 2 ** reconnectAttemptsRef.current, 30000);
          reconnectAttemptsRef.current++;
          setTimeout(() => {
            if (!destroyedRef.current) connect();
          }, delay);
        }
      });

      ws.on("error", () => {
        // Errors trigger close event, which handles reconnection
      });
    }

    connect();
    setParticipantNames(new Set([name]));

    return () => {
      destroyedRef.current = true;
      wsRef.current?.close();
    };
  }, [url, name]);

  const sendMessage = useCallback(
    (content: string) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        seqRef.current++;
        const msg = createChatMessage(name, "human", content, seqRef.current);
        wsRef.current.send(JSON.stringify(msg));
        setMessages((prev) => [...prev, msg]);
      }
    },
    [name]
  );

  return { messages, participants: participantNames.size, connected, sendMessage };
}
```

- [ ] **Step 2: Implement ChatView.tsx**

Write `src/client/ChatView.tsx`:

```tsx
import React, { useMemo } from "react";
import { Box, Text, useStdout } from "ink";
import { MessageBubble } from "./MessageBubble.js";
import type { RingMessage } from "../shared/protocol.js";

interface ChatViewProps {
  messages: RingMessage[];
}

function formatDate(timestamp: string): string {
  return new Date(timestamp).toLocaleDateString("es-CL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function ChatView({ messages }: ChatViewProps) {
  const { stdout } = useStdout();
  // Reserve 4 lines for header and input bar, show as many messages as fit
  const maxVisible = (stdout?.rows || 24) - 4;

  // Always show the most recent messages (auto-scroll to bottom)
  const visibleMessages = useMemo(
    () => messages.slice(-Math.max(maxVisible, 10)),
    [messages, maxVisible]
  );

  let lastDate = "";

  return (
    <Box flexDirection="column" flexGrow={1}>
      {visibleMessages.map((msg) => {
        const msgDate = formatDate(msg.timestamp);
        const showDateSeparator = msgDate !== lastDate;
        lastDate = msgDate;

        return (
          <Box key={msg.id} flexDirection="column">
            {showDateSeparator && (
              <Box justifyContent="center" paddingY={1}>
                <Text dimColor>{"── "}{msgDate}{" ──"}</Text>
              </Box>
            )}
            <MessageBubble message={msg} />
          </Box>
        );
      })}
    </Box>
  );
}
```

- [ ] **Step 3: Verify compilation**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/client/hooks/useRing.ts src/client/ChatView.tsx
git commit -m "feat: add useRing WebSocket hook and ChatView with date separators"
```

---

## Task 12: Chat TUI - App Component

**Files:**
- Create: `src/client/App.tsx`

- [ ] **Step 1: Implement App.tsx**

Write `src/client/App.tsx`:

```tsx
import React from "react";
import { Box, Text } from "ink";
import { Header } from "./Header.js";
import { ChatView } from "./ChatView.js";
import { InputBar } from "./InputBar.js";
import { useRing } from "./hooks/useRing.js";

interface AppProps {
  url: string;
  name: string;
}

export function App({ url, name }: AppProps) {
  const { messages, participants, connected, sendMessage } = useRing({
    url,
    name,
  });

  return (
    <Box flexDirection="column" height={process.stdout.rows || 24}>
      <Header url={url} participantCount={participants} />
      {!connected && (
        <Box justifyContent="center" paddingY={1}>
          <Text color="red">Disconnected. Reconnecting...</Text>
        </Box>
      )}
      <ChatView messages={messages} />
      <InputBar onSubmit={sendMessage} />
    </Box>
  );
}
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/client/App.tsx
git commit -m "feat: add App root component wiring Header, ChatView, and InputBar"
```

---

## Task 13: CLI Entry Point

**Files:**
- Create: `src/cli.ts`

- [ ] **Step 1: Implement cli.ts**

Write `src/cli.ts`:

```typescript
#!/usr/bin/env node

import { Command } from "commander";
import { render } from "ink";
import React from "react";
import { RingServer } from "./server/ring.js";
import { openTunnel } from "./server/tunnel.js";
import { Daemon } from "./daemon/daemon.js";
import { App } from "./client/App.js";
import { DEFAULT_PORT, DEFAULT_DAEMON_CONFIG } from "./shared/config.js";
import type { PrivacyMode } from "./shared/config.js";

const program = new Command();

program
  .name("real-steel")
  .description("Collaborative chat where humans work alongside their Claude Code AI agents")
  .version("0.1.0");

program
  .command("serve")
  .description("Start a ring server")
  .option("-p, --port <port>", "Port to listen on", String(DEFAULT_PORT))
  .option("--url <url>", "Custom public URL (skip tunnel)")
  .action(async (opts) => {
    const port = parseInt(opts.port, 10);
    const server = new RingServer(port);
    await server.start();

    console.log(`Ring server running locally on ws://localhost:${port}`);

    let publicUrl: string;

    if (opts.url) {
      publicUrl = opts.url;
      console.log(`Public URL: ${publicUrl}`);
    } else {
      console.log("Exposing to internet...");
      const tunnel = await openTunnel(port);
      publicUrl = tunnel.url;
      console.log(`Public URL: ${publicUrl}`);

      process.on("SIGINT", () => {
        tunnel.close();
        server.stop().then(() => process.exit(0));
      });
    }

    console.log("Share this URL with other participants.");
  });

program
  .command("join")
  .description("Join a ring")
  .argument("<url>", "Ring server URL")
  .requiredOption("-n, --name <name>", "Your display name")
  .option("--no-claude", "Join without Claude agent (spectator mode)")
  .option(
    "--privacy <mode>",
    "Privacy mode: whitelist, blacklist, claude-decides",
    "whitelist"
  )
  .option(
    "--privacy-paths <paths...>",
    "Paths for privacy whitelist/blacklist"
  )
  .option(
    "--debounce <ms>",
    "Debounce time in milliseconds",
    String(DEFAULT_DAEMON_CONFIG.debounceMs)
  )
  .action(async (url, opts) => {
    let daemon: Daemon | null = null;

    if (opts.claude !== false) {
      const daemonConfig = {
        ...DEFAULT_DAEMON_CONFIG,
        debounceMs: parseInt(opts.debounce, 10),
        privacy: {
          mode: opts.privacy as PrivacyMode,
          paths: opts.privacyPaths || [],
        },
      };

      daemon = new Daemon(url, opts.name, daemonConfig);
      await daemon.start();
    }

    const { waitUntilExit } = render(
      React.createElement(App, { url, name: opts.name })
    );

    process.on("SIGINT", async () => {
      if (daemon) await daemon.stop();
      process.exit(0);
    });

    await waitUntilExit();
    if (daemon) await daemon.stop();
  });

program.parse();
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Build the project**

```bash
npm run build
```

Expected: compiles to `dist/` without errors.

- [ ] **Step 4: Commit**

```bash
git add src/cli.ts
git commit -m "feat: add CLI with serve and join commands"
```

---

## Task 14: Build and Smoke Test

**Files:**
- Modify: `package.json` (if needed for bin path)

- [ ] **Step 1: Build the project**

```bash
npm run build
```

Expected: clean compilation.

- [ ] **Step 2: Smoke test the serve command**

```bash
# In one terminal:
node dist/cli.js serve --port 9999
# Expected output:
# Ring server running locally on ws://localhost:9999
# Exposing to internet...
# Public URL: wss://...
# Share this URL with other participants.
```

Kill with Ctrl+C after verifying output.

- [ ] **Step 3: Smoke test the join command (local)**

Start a server in background, then join:

```bash
# Terminal 1:
node dist/cli.js serve --port 9999 --url ws://localhost:9999

# Terminal 2:
node dist/cli.js join ws://localhost:9999 --name Pedro --no-claude
```

Expected: Chat TUI appears with header showing the URL. You can type and see your own messages.

- [ ] **Step 4: Run full test suite**

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: verify build and smoke test pass"
```

---

## Task 15: Two-User Integration Test

This is the final validation that the MVP works end-to-end.

- [ ] **Step 1: Manual integration test**

Open 3 terminals:

```bash
# Terminal 1 - Server:
node dist/cli.js serve --port 3000 --url ws://localhost:3000

# Terminal 2 - User Pedro (no Claude for manual test):
node dist/cli.js join ws://localhost:3000 --name Pedro --no-claude

# Terminal 3 - User Samuel (no Claude for manual test):
node dist/cli.js join ws://localhost:3000 --name Samuel --no-claude
```

Verify:
1. Both users see connection system events
2. Pedro types a message → Samuel sees it with timestamp
3. Samuel types a message → Pedro sees it with timestamp
4. Date separators appear correctly
5. Participant count updates in header

- [ ] **Step 2: Integration test with Claude daemon**

```bash
# Terminal 1 - Server:
node dist/cli.js serve --port 3000 --url ws://localhost:3000

# Terminal 2 - Chat TUI:
node dist/cli.js join ws://localhost:3000 --name Pedro --no-claude

# Terminal 3 - Daemon only (join with Claude, separate from TUI for debugging):
node dist/cli.js join ws://localhost:3000 --name Pedro --privacy claude-decides
```

Verify:
1. Claude-Pedro appears as connected
2. Type a technical question in the chat TUI
3. After debounce period (~5s), Claude-Pedro responds in the chat
4. Claude's response appears with the agent styling

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "chore: complete MVP integration testing"
```
