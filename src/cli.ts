#!/usr/bin/env node

import { Command } from "commander";
import { render } from "ink";
import React from "react";
import { RingServer } from "./server/ring.js";
import { openTunnel, type TunnelInfo } from "./server/tunnel.js";
import { Daemon } from "./daemon/daemon.js";
import { App } from "./client/App.js";
import { DEFAULT_PORT, DEFAULT_DAEMON_CONFIG } from "./shared/config.js";
import type { PrivacyMode } from "./shared/config.js";

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
      console.log(`Public URL: ${publicUrl}`);
    } else {
      console.log("Exposing to internet...");
      tunnelInstance = await openTunnel(port);
      publicUrl = tunnelInstance.url;
      console.log(`Public URL: ${publicUrl}`);
    }

    process.on("SIGINT", () => {
      if (tunnelInstance) tunnelInstance.close();
      server.stop().then(() => process.exit(0));
    });

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
  .option("--privacy-paths <paths...>", "Paths for privacy whitelist/blacklist")
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
