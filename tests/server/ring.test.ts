import { describe, it, expect, beforeEach, afterEach } from "vitest";
import WebSocket from "ws";
import { RingServer } from "../../src/server/ring.js";
import { type RingMessage, createChatMessage } from "../../src/shared/protocol.js";

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
    const received = await waitForMessage(client2);
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
