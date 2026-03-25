# Real Steel - Design Spec

**Date:** 2026-03-24
**Status:** Approved

## Vision

Inspired by the movie Real Steel, where humans enter the ring with their robots, Real Steel is a collaborative chat platform where 2 or more humans can work together alongside their respective Claude Code AI agents. Each human brings their own Claude Code instance (running on their machine with their subscription), preserving all local context: memories, project files, and tools. The "ring" is a group chat where all participants - humans and AI agents - communicate as equals.

## Problem

When collaborating on technical problems, developers currently copy-paste Claude Code outputs into messaging apps to share with colleagues. This loses context, breaks the flow, and forces Claude to work without its full toolset. Real Steel eliminates this by creating a shared communication space where each Claude Code retains its full local context while participating in group conversation.

## Key Design Decisions

| Decision | Choice |
|----------|--------|
| Authority model | Flat - all participants (humans and agents) are peers |
| Execution | Local on each machine. Git for sharing code |
| Architecture | Two-terminal: Chat TUI + Claude Code |
| Real-time | Daemon with debounce that invokes `claude --resume --print` |
| Claude participation | Autonomous - Claude decides when to speak |
| Privacy | Configurable: whitelist / blacklist / claude decides |
| Networking | Local server + automatic tunnel for internet access |
| Ring connection | Ad-hoc: connect to a URL, no accounts or invitations |
| Tech stack | TypeScript, Node.js, Ink, ws |
| Markdown | Rendered in TUI via marked-terminal |

## Architecture

### System Overview

```
┌─────────────────────┐         ┌─────────────────────┐
│   PC User A          │         │   PC User B          │
│                      │         │                      │
│  ┌───────────────┐   │         │  ┌───────────────┐   │
│  │ Claude Code   │   │         │  │ Claude Code   │   │
│  │ (terminal 2)  │   │         │  │ (terminal 2)  │   │
│  │ + memories    │   │         │  │ + memories    │   │
│  │ + local files │   │         │  │ + local files │   │
│  └──────┬────────┘   │         │  └──────┬────────┘   │
│         │ claude     │         │         │ claude     │
│         │ --resume   │         │         │ --resume   │
│  ┌──────┴────────┐   │         │  ┌──────┴────────┐   │
│  │ Daemon        │◄──┼────┐    │  │ Daemon        │◄──┼────┐
│  └───────────────┘   │    │    │  └───────────────┘   │    │
│                      │    │    │                      │    │
│  ┌───────────────┐   │    │    │  ┌───────────────┐   │    │
│  │ Chat TUI      │◄──┼────┤    │  │ Chat TUI      │◄──┼────┤
│  │ (terminal 1)  │   │    │    │  │ (terminal 1)  │   │    │
│  └───────────────┘   │    │    │  └───────────────┘   │    │
└─────────────────────┘    │    └─────────────────────┘    │
                            │                               │
                       ┌────┴───────────────────────────────┴────┐
                       │           RING SERVER                    │
                       │        WebSocket relay                   │
                       │   (runs on one participant's machine)    │
                       │   (exposed via automatic tunnel)         │
                       └─────────────────────────────────────────┘
```

### Components

The system has 4 components, all packaged in a single CLI tool:

```
real-steel
├── ring-server    → WebSocket relay (the "ring")
├── chat-client    → TUI for humans (terminal 1)
├── daemon         → Bridge between ring and Claude Code
└── claude-bridge  → Claude Code invocation logic (--resume, --print)
```

## Component Details

### 1. Ring Server

A deliberately simple WebSocket broadcast relay with no business logic.

**Responsibilities:**
- Accept WebSocket connections
- Receive a message from any participant
- Broadcast it to ALL other connected participants
- Maintain list of connected participants
- Notify on connect/disconnect events

**Does NOT do:**
- Authentication (MVP)
- Rooms/channels (one server = one ring)

**Reconnection resilience:**
The server maintains a bounded message buffer (last 200 messages). When a participant reconnects, they receive missed messages as a catch-up batch. Both the TUI and daemon handle reconnection automatically with exponential backoff.

**Networking:**
The server runs locally on the host's machine and is automatically exposed to the internet via a tunnel (localtunnel or bore). This allows remote participants to connect without any infrastructure setup.

```
$ real-steel serve
Ring server running locally on ws://localhost:3000
Exposing to internet...
Public URL: wss://abc123.bore.pub
Share this URL with other participants.
```

**Note:** Tunnel services (especially localtunnel) can be unreliable. URLs may change on reconnection. For users who want stable connectivity, a `--url` flag allows providing a custom public endpoint (e.g., via ngrok, Cloudflare Tunnel, or a direct IP with port forwarding).

### 2. Chat TUI (Ink)

The terminal interface each participant sees. Built with Ink (React for terminal).

```
╭─ Real Steel ─────── wss://abc123.bore.pub ─── 4 online ─╮
│                                                           │
│  ── 24 de marzo, 2026 ──                                 │
│                                                           │
│  22:41  Pedro              tenemos un problema de         │
│                            performance en /users          │
│                                                           │
│  22:42  Samuel             yo también noté que está       │
│                            lento desde el viernes         │
│                                                           │
│  22:43  🤖 Claude-Pedro   Revisé el código. El           │
│                            problema es una query N+1...   │
│                                                           │
│  ── 25 de marzo, 2026 ──                                 │
│                                                           │
│  09:15  Samuel             dale, retomemos                │
│                                                           │
╰───────────────────────────────────────────────────────────╯
  > _
```

**Features:**
- Header with ring URL and connected participant count
- System messages (connections/disconnections) visually differentiated
- Distinct colors for humans vs agents
- Timestamps on every message (HH:MM format)
- Date separators when the day changes
- Markdown rendering for agent messages (bold, italic, code blocks with syntax highlighting)
- Scroll for message history
- Text input at the bottom

**What it is NOT:**
- Not an editor. No panels, splits, or tabs.
- No slash commands. It is a pure chat.
- Interaction with your Claude happens in your other terminal (Claude Code).

### 3. Daemon

The core piece. Runs in background when the user does `real-steel join`. Bridges the ring and Claude Code.

```
                    Ring (WebSocket)
                         │
                    ┌────┴────┐
                    │  Daemon │
                    └────┬────┘
                         │
              ┌──────────┼──────────┐
              │          │          │
          Listener   Debouncer   Bridge
              │          │          │
         Receives    Accumulates  Invokes
         messages    messages &   claude --resume
         from ring   waits for    --print
                     pause
```

**Flow:**

1. **Listener** - Connected to the ring via WebSocket. Receives all messages.

2. **Debouncer** - Does not trigger Claude on every message. Accumulates messages and waits for a pause (configurable, default ~5 seconds of silence). When the pause is detected, passes the accumulated block to the bridge.

3. **Bridge** - Formats messages and executes:
   ```
   claude --resume <session-id> --print \
     --output-format json \
     --permission-mode auto \
     "New messages in the ring:
      [22:41 Pedro]: we have a bug in /users
      [22:42 Samuel]: I saw something similar yesterday"
   ```
   The bridge uses `--output-format json` for structured, reliable output parsing.
   The bridge uses `--permission-mode auto` so Claude can use its full toolset (read files, run commands) without interactive permission prompts.

4. **Response parsing** - The bridge parses Claude's JSON output. The system prompt instructs Claude to wrap its decision in a structured format. If Claude decides it has nothing to contribute, it signals this explicitly and the daemon posts nothing to the ring.

**Concurrency control:**
The daemon maintains a busy lock. While Claude is processing a batch, the debouncer continues accumulating new messages. When the current invocation finishes, if there are accumulated messages, the bridge is immediately invoked again with the new batch.

**Agent loop circuit breaker:**
To prevent infinite agent-to-agent loops (Claude-Pedro responds → triggers Claude-Samuel → responds → triggers Claude-Pedro...), the daemon applies a rule: if the accumulated batch contains ONLY agent messages (no human messages), the daemon does NOT invoke Claude. At least one human message must be present in the batch to trigger an invocation. This ensures humans remain in the loop.

**Rate limiting:**
Configurable max invocations per minute (default: 2/min). Prevents runaway costs in active conversations.

**Claude Code Session:**
- **Bootstrap:** The first invocation creates the session using `claude --print --output-format json --permission-mode auto --append-system-prompt "<ring context>"`. This returns a session ID that is stored for subsequent calls.
- **Subsequent calls:** Use `--resume <session-id>` to continue the same conversation.
- The `--append-system-prompt` flag (not `--system-prompt`) preserves Claude Code's default capabilities and safety guidelines while adding the ring context:
  > "You are in a Real Steel ring - a group chat with other humans and AI agents. You are the agent of [name]. You participate as an equal. Don't respond to every message - only when you have something genuinely useful to contribute. You have access to the local files and projects of [name]. When you have nothing to add, say so briefly instead of forcing a response."
- Claude Code's automatic context compression handles long conversations.

### 4. Privacy Filter

Configurable per user. Injected into Claude's system prompt by the daemon.

**Important:** Prompt-based privacy is best-effort, not guaranteed. Claude follows instructions but there is no hard technical enforcement preventing information leakage. For sensitive environments, whitelist mode is strongly recommended.

**Modes:**
- **Whitelist** (default): Claude can only share information from explicitly allowed sources. The daemon restricts Claude's tool access (via `--allowedTools`) to only whitelisted paths.
  > "You may only share information from: [repo-x, project-y]"
- **Blacklist**: Claude can share everything except explicitly blocked sources. The daemon uses `--disallowedTools` to prevent access to blacklisted paths.
  > "Do not share anything related to: [.env, credentials, private-repo]"
- **Claude decides**: Full trust in Claude's judgment about what is appropriate to share. No tool restrictions applied.

## Message Protocol

JSON over WebSocket. Every message has a unique `id` (UUID) and a per-participant `seq` number for ordering and deduplication.

**Chat message (human or agent):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "seq": 12,
  "type": "message",
  "from": "Pedro",
  "role": "human",
  "content": "we have a bug in /users",
  "timestamp": "2026-03-24T22:41:00Z"
}
```

**Agent message:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "seq": 3,
  "type": "message",
  "from": "Claude-Pedro",
  "role": "agent",
  "content": "I reviewed the code and the problem is...",
  "timestamp": "2026-03-24T22:43:00Z"
}
```

**System event:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440002",
  "seq": 0,
  "type": "system",
  "content": "Samuel has joined the ring",
  "timestamp": "2026-03-24T22:51:00Z"
}
```

The server tracks the last `seq` per participant to detect duplicates and ensure ordering.

## CLI Interface

| Command | What it does |
|---------|-------------|
| `real-steel serve` | Starts a ring server with automatic tunnel |
| `real-steel join <url> --name Pedro` | Opens chat TUI + starts daemon with Claude |
| `real-steel join <url> --name Pedro --no-claude` | Chat only, no Claude agent (spectator mode) |

## Tech Stack

| Component | Library |
|-----------|---------|
| Ring server | `ws` |
| Tunnel | `localtunnel` or `bore` (child process) |
| Chat TUI | `ink` + `ink-text-input` |
| Markdown rendering | `marked` + `marked-terminal` |
| Daemon WebSocket | `ws` |
| Claude bridge | `child_process.spawn` → `claude --resume --print` |
| CLI | `commander` or `yargs` |

No database, no HTTP framework, no bundler. The server is a raw WebSocket relay, the client is a TUI, the daemon is a process with a timer. Everything lightweight.

## Project Structure

```
real-steel/
├── package.json
├── tsconfig.json
├── src/
│   ├── cli.ts                  → Entry point, parses commands
│   ├── server/
│   │   ├── ring.ts             → WebSocket server (broadcast relay)
│   │   └── tunnel.ts           → Exposes server via public tunnel
│   ├── client/
│   │   ├── App.tsx             → Ink root component
│   │   ├── ChatView.tsx        → Message view with scroll
│   │   ├── MessageBubble.tsx   → Renders a message (markdown, timestamps, colors)
│   │   ├── InputBar.tsx        → Text input at the bottom
│   │   ├── Header.tsx          → Ring URL, online participants
│   │   └── hooks/
│   │       └── useRing.ts      → Hook managing WebSocket connection to ring
│   ├── daemon/
│   │   ├── daemon.ts           → Main orchestrator (listener + debouncer + bridge)
│   │   ├── listener.ts         → Listens to ring messages
│   │   ├── debouncer.ts        → Accumulates messages, waits for pause
│   │   └── bridge.ts           → Invokes claude --resume --print
│   ├── shared/
│   │   ├── protocol.ts         → Message protocol types (Message, SystemEvent, etc.)
│   │   └── config.ts           → Configuration (privacy, debounce time, etc.)
│   └── privacy/
│       └── filter.ts           → Whitelist/blacklist logic for system prompt
└── tests/
    ├── server/
    ├── daemon/
    └── client/
```

## MVP Scope

The MVP delivers the full basic experience: two humans + two Claudes in a terminal chat, communicating in real-time with each Claude having access to its user's local files and memories.

**In scope:**
- Ring server with automatic tunnel
- Chat TUI with timestamps, markdown rendering, colors
- Daemon with debounce and autonomous Claude participation
- Privacy configuration (whitelist/blacklist/claude decides)
- `real-steel serve` and `real-steel join` commands

**Out of scope (future):**
- Authentication / invitations
- Message persistence / history beyond the 200-message buffer
- Multiple rooms per server
- File sharing in chat
- Central hosted server option
- Mobile/web client

## Known Limitations

- **Privacy is best-effort:** Prompt-based privacy controls rely on Claude following instructions. No hard technical sandboxing of information.
- **Tunnel reliability:** Free tunnel services may drop connections or change URLs. Users with stable needs should use their own public endpoints.
- **Participant identity is not validated:** The `--name` flag is the only identity mechanism. Nothing prevents duplicate names or impersonation. Acceptable for MVP among trusted collaborators.
- **Graceful shutdown:** On Ctrl+C, the daemon sends a disconnect event to the ring and waits for any in-progress Claude invocation to finish before exiting.
