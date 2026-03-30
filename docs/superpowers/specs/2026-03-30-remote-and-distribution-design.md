# Real Steel — Remote Connectivity & Distribution Design

**Date:** 2026-03-30
**Goal:** Enable real collaboration over the internet (not just localhost) and distribute Real Steel as a Claude Code plugin with a `/real-steel` slash command.

**Depends on:** The existing MVP (ring server, TUI, daemon, privacy filter) which is complete and integration-tested.

---

## 1. Tunneling: cloudflared

### What changes

Replace `localtunnel` with Cloudflare's free quick-tunnel feature (`cloudflared tunnel --url`).

### How it works

1. `real-steel serve` starts the ring server on a local port (default 3000)
2. Spawns `cloudflared tunnel --url http://localhost:{port}` as a child process
3. Parses the public URL from cloudflared's stderr output (it prints `https://xxx.trycloudflare.com`)
4. Converts `https://` to `wss://` for WebSocket connections
5. Prints the URL for sharing
6. On SIGINT: kills the cloudflared process, stops the ring server

### Dependency change

- **Remove:** `localtunnel` npm dependency
- **Add:** `cloudflared` system binary (not an npm dep)
- The `--url <url>` flag remains for users who bring their own tunnel or public server

### Auto-install of cloudflared

When `serve` detects `cloudflared` is not in PATH:

1. Prompt: "cloudflared not found. Install it now? (Y/n)"
2. If yes, platform-specific install:
   - **macOS:** `brew install cloudflared`
   - **Linux x86_64:** Download binary from `https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64` to `~/.local/bin/cloudflared`, chmod +x
   - **Linux arm64:** Same pattern, `cloudflared-linux-arm64`
   - **Windows:** Download `cloudflared-windows-amd64.exe` to `%LOCALAPPDATA%/real-steel/cloudflared.exe`
3. Verify with `cloudflared --version`
4. If auto-install fails: print manual install instructions with URLs and exit

In the Claude Code plugin context, the wizard handles this transparently — Claude asks and runs the appropriate command.

### Tunnel module API

```typescript
// src/server/tunnel.ts (rewritten)
export interface TunnelInfo {
  url: string;       // wss://xxx.trycloudflare.com
  close: () => void; // kills cloudflared process
}

export async function openTunnel(port: number): Promise<TunnelInfo>;
export async function isCloudflaredInstalled(): Promise<boolean>;
export async function installCloudflared(): Promise<boolean>;
```

---

## 2. Claude Code Plugin

### Plugin structure

```
real-steel/
├── package.json              → npm package (core library + standalone CLI)
├── src/                      → existing source code
├── plugin/
│   ├── .claude-plugin/
│   │   └── plugin.json       → plugin manifest
│   └── skills/
│       └── real-steel/
│           └── SKILL.md      → wizard prompt + slash command definition
```

### plugin.json

```json
{
  "name": "real-steel",
  "version": "0.2.0",
  "description": "Collaborative terminal chat where humans work alongside their Claude Code AI agents in a shared ring",
  "author": { "name": "ProDrifterDK" },
  "repository": "https://github.com/prodrifterdk/real-steel",
  "license": "MIT",
  "keywords": ["collaboration", "chat", "multi-agent", "ring"]
}
```

### SKILL.md — Interactive wizard

The skill definition instructs Claude to run an interactive wizard when the user types `/real-steel`:

```markdown
---
description: Start or join a Real Steel collaborative ring for multi-human + AI agent chat
---

## Real Steel — Collaborative Ring

Guide the user through starting or joining a Real Steel ring.

### Step 1: Host or Join?
Ask the user:
- **Host a new ring** — starts a ring server + tunnel
- **Join an existing ring** — connects to a URL

### Step 2 (Host): Setup
1. Ask for display name
2. Ask for privacy mode (claude-decides / whitelist / blacklist)
3. Check if cloudflared is installed. If not, offer to install it.
4. Run: `real-steel serve` (starts server + tunnel)
5. Print the shareable URL
6. Run: `real-steel join {url} --name {name} --privacy {mode}`

### Step 2 (Join): Connect
1. Ask for the ring URL (wss://...)
2. Ask for display name
3. Ask if Claude agent should be enabled (Y/n)
4. Ask for privacy mode if Claude enabled
5. Run: `real-steel join {url} --name {name} [--no-claude] [--privacy {mode}]`

### Shortcuts
- `/real-steel serve` — skip wizard, go straight to host setup
- `/real-steel join wss://...` — skip wizard, prompt only for name
```

### How it works at runtime

1. User types `/real-steel` in Claude Code
2. Claude Code loads the SKILL.md and follows the instructions
3. Claude asks the wizard questions via normal conversation
4. Claude runs the `real-steel` CLI commands via Bash tool
5. The TUI renders in Claude Code's terminal

**Prerequisite:** The `real-steel` npm package must be installed globally. The SKILL.md instructs Claude to check (`which real-steel`) and install (`npm install -g real-steel`) if not found, before running any commands.

---

## 3. Distribution

### Phase 1: GitHub marketplace (immediate)

Create a repository `prodrifterdk/claude-plugins` with a marketplace manifest:

**`marketplace.json`:**
```json
{
  "name": "prodrifterdk-plugins",
  "owner": {
    "name": "ProDrifterDK"
  },
  "plugins": [
    {
      "name": "real-steel",
      "source": {
        "source": "github",
        "repo": "prodrifterdk/real-steel",
        "ref": "main"
      },
      "description": "Collaborative terminal chat with humans + Claude Code AI agents",
      "version": "0.2.0"
    }
  ]
}
```

**User installation flow:**
```bash
# One-time: add the marketplace
/plugin marketplace add prodrifterdk/claude-plugins

# Install the plugin
/plugin install real-steel

# Use it
/real-steel
```

### Phase 2: Official Anthropic marketplace (later)

Once stable, submit to `claude.ai/settings/plugins/submit` for wider distribution. Users would then install with just `/plugin install real-steel` without adding a custom marketplace.

### Standalone CLI (secondary path)

Published to npm as `real-steel`:

```bash
npm install -g real-steel
real-steel serve
real-steel join wss://abc.trycloudflare.com --name Pedro
```

Same codebase — the plugin just wraps the CLI.

---

## 4. Files to Change/Create

| File | Action | Purpose |
|------|--------|---------|
| `src/server/tunnel.ts` | Rewrite | Replace localtunnel with cloudflared subprocess |
| `src/server/cloudflared.ts` | Create | Auto-detect, auto-install cloudflared |
| `package.json` | Modify | Remove localtunnel dep, add bin entry if missing |
| `plugin/.claude-plugin/plugin.json` | Create | Plugin manifest |
| `plugin/skills/real-steel/SKILL.md` | Create | Wizard prompt skill definition |
| `src/server/localtunnel.d.ts` | Delete | No longer needed |

---

## 5. Scope — What's NOT included

- No authentication or identity verification
- No custom tunnel domains (uses random trycloudflare.com URLs)
- No auto-update mechanism for the plugin
- No GUI or web interface
- No persistent message history across sessions
- No multiple simultaneous rings per server
