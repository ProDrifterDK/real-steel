import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import WebSocket from "ws";
import { RingServer } from "../../src/server/ring.ts";
import { Daemon } from "../../src/daemon/daemon.ts";
import { createChatMessage } from "../../src/shared/protocol.ts";
import type { DaemonConfig } from "../../src/shared/config.ts";

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
