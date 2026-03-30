---
name: real-steel
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

## Terminal Behavior

- `real-steel serve` runs headless — safe to run via Bash in the background.
- `real-steel join` auto-detects when it's not in a TTY (e.g., called from Claude Code's Bash tool) and **automatically opens a new terminal window** with the TUI. So you CAN run it via Bash — a new terminal will pop up for the user.

## Wizard Flow

### Step 1: Ask the user what they want to do

You MUST use the AskUserQuestion tool for this (do NOT ask as plain text):

Question: "What would you like to do?"
Options:
- label: "Host a new ring", description: "Start a ring server and open a tunnel so others can connect"
- label: "Join an existing ring", description: "Connect to someone else's ring URL"

If the user provided arguments:
- `/real-steel serve` → skip to Host flow
- `/real-steel join <url>` → skip to Join flow, ask only for name

---

### Host Flow

**1. Ask for display name**

Ask: "What name should you appear as in the ring?"

**2. Ask for privacy mode**

You MUST use the AskUserQuestion tool for this (do NOT ask as plain text):

Question: "What privacy mode should your Claude agent use?"
Options:
- label: "Claude decides (Recommended)", description: "Claude uses judgment about what to share"
- label: "Whitelist", description: "Only share files from specified paths"
- label: "Blacklist", description: "Share everything except specified paths"

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

**5. Join the ring**

Run (a new terminal window will open automatically):
```bash
real-steel join <url> --name <name> --privacy <mode> [--privacy-paths <paths...>]
```

Tell the user:
> A new terminal window is opening with the ring. Share this URL with your team so they can join with `/real-steel` on their Claude Code:
>
> `wss://THE-URL-HERE`
>
> They will be prompted for their name and settings when they run `/real-steel` and choose "Join".

---

### Join Flow

**1. Ask for the ring URL**

If not provided as argument, ask: "What's the ring URL? (wss://...)"

**2. Ask for display name**

Ask: "What name should you appear as in the ring?"

**3. Ask about Claude agent**

You MUST use the AskUserQuestion tool for this (do NOT ask as plain text):

Question: "Should your Claude agent participate in the ring?"
Options:
- label: "Yes, enable Claude (Recommended)", description: "Your Claude agent participates in the ring"
- label: "No, spectator mode", description: "Join without a Claude agent"

**4. If Claude enabled, ask privacy mode**

Same as Host flow step 2 (use the exact CLI value mapping).

**5. Join the ring**

Run (a new terminal window will open automatically):
```bash
real-steel join <url> --name <name> [--no-claude] [--privacy <mode>] [--privacy-paths <paths...>]
```

Tell the user a new terminal window is opening with the ring.
