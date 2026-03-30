# Remote Connectivity & Distribution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace localtunnel with cloudflared for reliable internet tunneling, and create a Claude Code plugin so users can type `/real-steel` to host or join a collaborative ring.

**Architecture:** Two independent deliverables. (1) Rewrite `src/server/tunnel.ts` to spawn cloudflared as a child process, with auto-detection and auto-install. (2) Create a `plugin/` directory with a Claude Code plugin manifest and SKILL.md that drives an interactive wizard via the existing CLI.

**Tech Stack:** TypeScript, Node.js child_process (for cloudflared), Claude Code plugin system (plugin.json + SKILL.md)

**Spec:** `docs/superpowers/specs/2026-03-30-remote-and-distribution-design.md`

---

## File Structure

```
real-steel/
├── src/server/
│   ├── cloudflared.ts          → NEW: detect, install, spawn cloudflared
│   ├── tunnel.ts               → REWRITE: use cloudflared instead of localtunnel
│   └── localtunnel.d.ts        → DELETE
├── tests/server/
│   └── cloudflared.test.ts     → NEW: tests for detection and URL parsing
├── plugin/
│   ├── .claude-plugin/
│   │   └── plugin.json         → NEW: plugin manifest
│   └── skills/
│       └── real-steel/
│           └── SKILL.md        → NEW: wizard slash command
├── package.json                → MODIFY: remove localtunnel dep
```

---

## Task 1: Cloudflared Detection and Installation Module

**Files:**
- Create: `src/server/cloudflared.ts`
- Test: `tests/server/cloudflared.test.ts`

- [ ] **Step 1: Write failing tests for cloudflared detection and URL parsing**

Create `tests/server/cloudflared.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  parseCloudflaredUrl,
  getInstallCommand,
} from "../src/server/cloudflared.js";

describe("parseCloudflaredUrl", () => {
  it("extracts URL from cloudflared stderr output line", () => {
    const line =
      "2024-01-15T20:11:30Z INF |  https://corporate-mention-tiles-coordinates.trycloudflare.com                              |";
    const url = parseCloudflaredUrl(line);
    expect(url).toBe("https://corporate-mention-tiles-coordinates.trycloudflare.com");
  });

  it("returns null for lines without a tunnel URL", () => {
    const line =
      "2024-01-15T20:11:29Z INF Settings: map[url:http://localhost:3000]";
    expect(parseCloudflaredUrl(line)).toBeNull();
  });

  it("extracts URL from minimal line", () => {
    const line = "https://abc-def.trycloudflare.com";
    expect(parseCloudflaredUrl(line)).toBe(
      "https://abc-def.trycloudflare.com"
    );
  });
});

describe("getInstallCommand", () => {
  it("returns brew command for darwin", () => {
    const cmd = getInstallCommand("darwin", "arm64");
    expect(cmd.description).toContain("brew");
  });

  it("returns download command for linux x64", () => {
    const cmd = getInstallCommand("linux", "x64");
    expect(cmd.url).toContain("cloudflared-linux-amd64");
  });

  it("returns download command for linux arm64", () => {
    const cmd = getInstallCommand("linux", "arm64");
    expect(cmd.url).toContain("cloudflared-linux-arm64");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/server/cloudflared.test.ts
```

Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement cloudflared.ts**

Create `src/server/cloudflared.ts`:

```typescript
import { execSync, spawn, type ChildProcess } from "child_process";
import { createWriteStream, chmodSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { homedir, platform, arch } from "os";
import https from "https";

export interface InstallInfo {
  description: string;
  url?: string;
  installDir?: string;
}

const CLOUDFLARED_URL_REGEX = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/;

export function parseCloudflaredUrl(line: string): string | null {
  const match = line.match(CLOUDFLARED_URL_REGEX);
  return match ? match[0] : null;
}

export function isCloudflaredInstalled(): boolean {
  try {
    execSync("cloudflared --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export function getInstallCommand(
  os: string = platform(),
  cpuArch: string = arch()
): InstallInfo {
  if (os === "darwin") {
    return {
      description: "brew install cloudflared",
    };
  }

  const archMap: Record<string, string> = {
    x64: "amd64",
    arm64: "arm64",
  };
  const cfArch = archMap[cpuArch] || "amd64";

  if (os === "win32") {
    return {
      description: `Download cloudflared-windows-${cfArch}.exe`,
      url: `https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-${cfArch}.exe`,
    };
  }

  // Linux
  const installDir = join(homedir(), ".local", "bin");
  return {
    description: `Download cloudflared-linux-${cfArch} to ${installDir}`,
    url: `https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${cfArch}`,
    installDir,
  };
}

export async function installCloudflared(): Promise<boolean> {
  const os = platform();
  const info = getInstallCommand();

  if (os === "darwin") {
    try {
      execSync("brew install cloudflared", { stdio: "inherit" });
      return isCloudflaredInstalled();
    } catch {
      return false;
    }
  }

  if (!info.url || !info.installDir) return false;

  // Linux: download binary
  const dir = info.installDir;
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const dest = join(dir, "cloudflared");

  return new Promise((resolve) => {
    const download = (url: string) => {
      https.get(url, (res) => {
        // Follow redirects (GitHub releases use 302)
        if (res.statusCode === 301 || res.statusCode === 302) {
          if (res.headers.location) {
            download(res.headers.location);
            return;
          }
        }
        if (res.statusCode !== 200) {
          resolve(false);
          return;
        }
        const file = createWriteStream(dest);
        res.pipe(file);
        file.on("finish", () => {
          file.close();
          chmodSync(dest, 0o755);
          resolve(isCloudflaredInstalled());
        });
        file.on("error", () => resolve(false));
      }).on("error", () => resolve(false));
    };
    download(info.url!);
  });
}

export interface CloudflaredProcess {
  url: string;
  process: ChildProcess;
  kill: () => void;
}

export function spawnCloudflared(port: number): Promise<CloudflaredProcess> {
  return new Promise((resolve, reject) => {
    const proc = spawn("cloudflared", ["tunnel", "--url", `http://localhost:${port}`], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        proc.kill("SIGINT");
        reject(new Error("Timed out waiting for cloudflared tunnel URL (30s)"));
      }
    }, 30000);

    proc.stderr?.on("data", (data: Buffer) => {
      if (resolved) return;
      const line = data.toString();
      const url = parseCloudflaredUrl(line);
      if (url) {
        resolved = true;
        clearTimeout(timeout);
        resolve({
          url,
          process: proc,
          kill: () => proc.kill("SIGINT"),
        });
      }
    });

    proc.on("error", (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        reject(new Error(`Failed to start cloudflared: ${err.message}`));
      }
    });

    proc.on("close", (code) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        reject(new Error(`cloudflared exited with code ${code} before providing a URL`));
      }
    });
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/server/cloudflared.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Verify compilation**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/server/cloudflared.ts tests/server/cloudflared.test.ts
git commit -m "feat: add cloudflared detection, auto-install, and process spawning"
```

---

## Task 2: Rewrite Tunnel Module

**Files:**
- Rewrite: `src/server/tunnel.ts`
- Delete: `src/server/localtunnel.d.ts`

- [ ] **Step 1: Rewrite tunnel.ts to use cloudflared**

Replace the contents of `src/server/tunnel.ts`:

```typescript
import { spawnCloudflared, type CloudflaredProcess } from "./cloudflared.js";

export interface TunnelInfo {
  url: string;
  close: () => void;
}

export async function openTunnel(port: number): Promise<TunnelInfo> {
  const cf = await spawnCloudflared(port);

  // Convert https:// to wss:// for WebSocket
  const wsUrl = cf.url
    .replace("https://", "wss://")
    .replace("http://", "ws://");

  return {
    url: wsUrl,
    close: () => cf.kill(),
  };
}
```

- [ ] **Step 2: Delete localtunnel.d.ts**

```bash
rm src/server/localtunnel.d.ts
```

- [ ] **Step 3: Remove localtunnel from dependencies**

```bash
npm uninstall localtunnel
```

- [ ] **Step 4: Verify compilation and tests**

```bash
npx tsc --noEmit
npx vitest run
```

Expected: compiles clean, all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/server/tunnel.ts package.json package-lock.json
git rm src/server/localtunnel.d.ts
git commit -m "feat: replace localtunnel with cloudflared for tunnel support"
```

---

## Task 3: Update CLI Serve Command with Auto-Install Flow

**Files:**
- Modify: `src/cli.ts`

- [ ] **Step 1: Update the serve command to check for cloudflared and offer auto-install**

In `src/cli.ts`, update the `serve` action. Replace the existing serve action (lines ~28-54) with:

```typescript
import {
  isCloudflaredInstalled,
  installCloudflared,
} from "./server/cloudflared.js";
```

Add this import at the top alongside existing imports. Then replace the serve action:

```typescript
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
    let tunnelInstance: TunnelInfo | null = null;

    if (opts.url) {
      publicUrl = opts.url;
    } else {
      // Check for cloudflared
      if (!isCloudflaredInstalled()) {
        console.log("cloudflared is not installed (needed for internet tunneling).");
        console.log("Installing cloudflared...");
        const ok = await installCloudflared();
        if (!ok) {
          console.error("Auto-install failed. Please install manually:");
          console.error("  macOS:  brew install cloudflared");
          console.error(
            "  Linux:  https://github.com/cloudflare/cloudflared/releases/latest"
          );
          await server.stop();
          process.exit(1);
        }
        console.log("cloudflared installed successfully.");
      }

      console.log("Opening tunnel...");
      tunnelInstance = await openTunnel(port);
      publicUrl = tunnelInstance.url;
    }

    console.log(`\nPublic URL: ${publicUrl}`);
    console.log("Share this with other participants to join.\n");

    process.on("SIGINT", () => {
      if (tunnelInstance) tunnelInstance.close();
      server.stop().then(() => process.exit(0));
    });
  });
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Build and smoke test serve --url (no tunnel)**

```bash
npm run build
timeout 3 node dist/cli.js serve --port 9999 --url ws://localhost:9999 2>&1 || true
```

Expected output:
```
Ring server running locally on ws://localhost:9999

Public URL: ws://localhost:9999
Share this with other participants to join.
```

- [ ] **Step 4: Commit**

```bash
git add src/cli.ts
git commit -m "feat: add cloudflared auto-install flow to serve command"
```

---

## Task 4: Claude Code Plugin Manifest

**Files:**
- Create: `plugin/.claude-plugin/plugin.json`

- [ ] **Step 1: Create plugin directory structure**

```bash
mkdir -p plugin/.claude-plugin
mkdir -p plugin/skills/real-steel
```

- [ ] **Step 2: Create plugin.json**

Create `plugin/.claude-plugin/plugin.json`:

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

- [ ] **Step 3: Commit**

```bash
git add plugin/.claude-plugin/plugin.json
git commit -m "feat: add Claude Code plugin manifest"
```

---

## Task 5: Claude Code Slash Command Skill

**Files:**
- Create: `plugin/skills/real-steel/SKILL.md`

- [ ] **Step 1: Create SKILL.md**

Create `plugin/skills/real-steel/SKILL.md`:

````markdown
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
````

- [ ] **Step 2: Commit**

```bash
git add plugin/skills/real-steel/SKILL.md
git commit -m "feat: add /real-steel slash command skill with interactive wizard"
```

---

## Task 6: GitHub Plugin Marketplace

**Files:**
- Create: `plugin/marketplace.json` (for reference/testing)

- [ ] **Step 1: Create marketplace.json in the plugin directory**

This file is a reference for how the marketplace repo should look. The actual marketplace lives in a separate GitHub repo (`prodrifterdk/claude-plugins`), but we include it here for documentation.

Create `plugin/marketplace.json`:

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
        "source": "git-subdir",
        "url": "https://github.com/prodrifterdk/real-steel.git",
        "path": "plugin"
      },
      "description": "Collaborative terminal chat with humans + Claude Code AI agents",
      "version": "0.2.0"
    }
  ]
}
```

- [ ] **Step 2: Commit**

```bash
git add plugin/marketplace.json
git commit -m "feat: add marketplace manifest for Claude Code plugin distribution"
```

---

## Task 7: Build, Test, and Verify

**Files:**
- Modify: none (verification only)

- [ ] **Step 1: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass (existing 55 + new cloudflared tests).

- [ ] **Step 2: Build the project**

```bash
npm run build
```

Expected: clean compilation.

- [ ] **Step 3: Smoke test serve with --url (no cloudflared needed)**

```bash
timeout 3 node dist/cli.js serve --port 9999 --url ws://localhost:9999 2>&1 || true
```

Expected: server starts and prints the URL.

- [ ] **Step 4: Smoke test cloudflared detection**

```bash
node -e "import('./dist/server/cloudflared.js').then(m => console.log('installed:', m.isCloudflaredInstalled()))"
```

Expected: prints `installed: true` or `installed: false` depending on system.

- [ ] **Step 5: Verify plugin structure**

```bash
ls -la plugin/.claude-plugin/plugin.json
ls -la plugin/skills/real-steel/SKILL.md
cat plugin/.claude-plugin/plugin.json | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const p=JSON.parse(d);console.log('Plugin:', p.name, p.version)})"
```

Expected:
```
Plugin: real-steel 0.2.0
```

- [ ] **Step 6: Test plugin locally with Claude Code (manual)**

```bash
claude --plugin-dir ./plugin
```

Then type `/real-steel` and verify the wizard activates.

- [ ] **Step 7: Commit any fixes**

```bash
git add -A
git commit -m "chore: verify build, tests, and plugin structure"
```
