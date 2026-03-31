#!/usr/bin/env node

import "./shared/colors.js"; // Must be first: enables chalk colors before marked-terminal loads
import { Command } from "commander";
import { render } from "ink";
import React from "react";
import { spawn as nodeSpawn, execSync } from "child_process";
import { RingServer } from "./server/ring.js";
import { openTunnel, type TunnelInfo } from "./server/tunnel.js";
import {
  isCloudflaredInstalled,
  installCloudflared,
} from "./server/cloudflared.js";
import { Daemon } from "./daemon/daemon.js";
import { App } from "./client/App.js";
import { DEFAULT_PORT, DEFAULT_DAEMON_CONFIG } from "./shared/config.js";
import type { PrivacyMode } from "./shared/config.js";

function findTerminalEmulator(): string | null {
  const candidates = [
    process.env.TERMINAL,
    "x-terminal-emulator",
    "gnome-terminal",
    "konsole",
    "xfce4-terminal",
    "cosmic-term",
    "xterm",
  ].filter(Boolean) as string[];

  for (const term of candidates) {
    try {
      execSync(`which ${term}`, { stdio: "ignore" });
      return term;
    } catch {
      // not found, try next
    }
  }
  return null;
}

function openInNewTerminal(args: string[]): boolean {
  const term = findTerminalEmulator();
  if (!term) return false;

  const cmd = ["real-steel", ...args];

  // Different terminals use different flags for running a command
  let spawnArgs: string[];
  if (term.includes("gnome-terminal") || term.includes("cosmic-term")) {
    spawnArgs = [term, "--", ...cmd];
  } else if (term.includes("konsole")) {
    spawnArgs = [term, "-e", ...cmd];
  } else if (term.includes("xfce4-terminal")) {
    spawnArgs = [term, "-e", cmd.join(" ")];
  } else {
    // x-terminal-emulator, xterm, and most others use -e
    spawnArgs = [term, "-e", ...cmd];
  }

  const proc = nodeSpawn(spawnArgs[0], spawnArgs.slice(1), {
    detached: true,
    stdio: "ignore",
  });
  proc.unref();
  return true;
}

const program = new Command();

program
  .name("real-steel")
  .description(
    "Collaborative chat where humans work alongside their Claude Code AI agents"
  )
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

    // Ignore SIGHUP so serve survives when the parent shell exits
    // (e.g., when launched via Claude Code's Bash tool with & disown)
    process.on("SIGHUP", () => {});

    process.on("SIGINT", () => {
      if (tunnelInstance) tunnelInstance.close();
      server.stop().then(() => process.exit(0));
    });
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
  .option("--privacy-paths <paths...>", "Paths for privacy whitelist/blacklist")
  .option(
    "--debounce <ms>",
    "Debounce time in milliseconds",
    String(DEFAULT_DAEMON_CONFIG.debounceMs)
  )
  .action(async (url, opts) => {
    // If not in a TTY (e.g., called from Claude Code's Bash tool),
    // open a new terminal window with the same command
    if (!process.stdin.isTTY) {
      const args = ["join", url, "--name", opts.name];
      if (opts.claude === false) args.push("--no-claude");
      if (opts.privacy) args.push("--privacy", opts.privacy);
      if (opts.privacyPaths) args.push("--privacy-paths", ...opts.privacyPaths);
      if (opts.debounce) args.push("--debounce", opts.debounce);

      const opened = openInNewTerminal(args);
      if (opened) {
        console.log("Opening Real Steel in a new terminal window...");
        process.exit(0);
      } else {
        console.error("No terminal emulator found. Run this command in your terminal:");
        console.error(`  real-steel ${args.join(" ")}`);
        process.exit(1);
      }
    }

    const validModes = ["whitelist", "blacklist", "claude-decides"];
    if (!validModes.includes(opts.privacy)) {
      console.error(
        `Invalid privacy mode: "${opts.privacy}". Must be one of: ${validModes.join(", ")}`
      );
      process.exit(1);
    }

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

    // Suppress console output so daemon logs don't corrupt Ink's rendering
    console.log = () => {};
    console.error = () => {};

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
