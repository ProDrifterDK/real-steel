---
description: Start or join a Real Steel collaborative ring for multi-human + AI agent chat
---

# Real Steel — Collaborative Ring

You are helping the user start or join a Real Steel ring — a group chat where multiple humans collaborate alongside their own Claude Code AI agents in real time.

## Prerequisites

Before running any commands, check if `real-steel` is installed:

```bash
which real-steel
```

If not found, install it:

```bash
npm install -g real-steel
```

## Wizard Flow

### Step 1: Ask the user what they want to do

Ask with AskUserQuestion:
- **Host a new ring** — start a ring server and open a tunnel so others can connect
- **Join an existing ring** — connect to someone else's ring URL

If the user provided arguments:
- `/real-steel serve` → skip to Host flow
- `/real-steel join <url>` → skip to Join flow, ask only for name

---

### Host Flow

**1. Ask for display name**

Ask: "What name should you appear as in the ring?"

**2. Ask for privacy mode**

Ask with AskUserQuestion (3 options):
- **Claude decides** (recommended) — Claude uses judgment about what to share
- **Whitelist** — only share files from specified paths
- **Blacklist** — share everything except specified paths

If whitelist or blacklist: ask for the paths.

**3. Check cloudflared**

Run:
```bash
which cloudflared
```

If not found, ask: "cloudflared is needed for internet tunneling. Install it now?"

If yes, run the appropriate install command:
- macOS: `brew install cloudflared`
- Linux: `curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o ~/.local/bin/cloudflared && chmod +x ~/.local/bin/cloudflared`

**4. Start the ring**

Run in background:
```bash
real-steel serve &
```

Wait for the "Public URL:" line in the output. Extract the `wss://` URL.

**5. Print the shareable URL**

Tell the user:
> Your ring is live! Share this with your team:
> ```
> /real-steel join wss://abc-xyz.trycloudflare.com
> ```

**6. Join the ring**

Run:
```bash
real-steel join <url> --name <name> --privacy <mode> [--privacy-paths <paths...>]
```

This launches the chat TUI. The user is now in the ring.

---

### Join Flow

**1. Ask for the ring URL**

If not provided as argument, ask: "What's the ring URL? (wss://...)"

**2. Ask for display name**

Ask: "What name should you appear as in the ring?"

**3. Ask about Claude agent**

Ask with AskUserQuestion:
- **Yes, enable Claude** (recommended) — your Claude agent participates in the ring
- **No, spectator mode** — join without a Claude agent

**4. If Claude enabled, ask privacy mode**

Same as Host flow step 2.

**5. Join the ring**

Run:
```bash
real-steel join <url> --name <name> [--no-claude] [--privacy <mode>] [--privacy-paths <paths...>]
```

This launches the chat TUI. The user is now in the ring.
