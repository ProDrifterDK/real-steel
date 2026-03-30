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

If not found, install from the local project:

```bash
cd "/home/prodrifterdk/Documentos/projects/Real Steel" && npm link
```

If that fails, try:

```bash
npm install -g real-steel
```

## IMPORTANT: TUI Limitation

The `real-steel join` command launches an interactive TUI (Ink/React terminal UI) that **requires a real terminal with raw mode support**. It CANNOT run through Claude Code's Bash tool.

You MUST instruct the user to run the `join` command themselves in their terminal, either:
- By typing `! real-steel join ...` at the Claude Code prompt (which runs it in their shell)
- By copying the command and running it in a separate terminal

The `real-steel serve` command CAN run in the background via Bash (it has no TUI).

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

**Privacy mode CLI values (MUST use these exact strings):**
- "Claude decides" → `claude-decides`
- "Whitelist" → `whitelist`
- "Blacklist" → `blacklist`

**3. Check cloudflared**

Run:
```bash
which cloudflared
```

If not found, ask: "cloudflared is needed for internet tunneling. Install it now?"

If yes, run the appropriate install command:
- macOS: `brew install cloudflared`
- Linux: `curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o ~/.local/bin/cloudflared && chmod +x ~/.local/bin/cloudflared`

**4. Start the ring server**

Run in background (this is fine via Bash — no TUI):
```bash
real-steel serve 2>&1 &
```

Wait a few seconds, then check the output for the "Public URL:" line. Extract the `wss://` URL.

**5. Give the user the join command**

Tell the user:
> Your ring is live! To join, run this command in your terminal (type `!` before it to run from here):
>
> `! real-steel join wss://THE-URL-HERE --name NAME --privacy claude-decides`
>
> Share this with your team so they can join:
>
> `real-steel join wss://THE-URL-HERE --name THEIR-NAME --privacy claude-decides`

**DO NOT run the join command via Bash yourself.** The user must run it.

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

Same as Host flow step 2 (use the exact CLI value mapping).

**5. Give the user the join command**

Build the command:
```
real-steel join <url> --name <name> [--no-claude] [--privacy <mode>] [--privacy-paths <paths...>]
```

Tell the user:
> Run this in your terminal (type `!` before it to run from here):
>
> `! real-steel join wss://THE-URL --name NAME --privacy claude-decides`

**DO NOT run the join command via Bash yourself.** The user must run it.
