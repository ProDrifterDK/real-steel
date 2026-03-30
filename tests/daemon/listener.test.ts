import { describe, it, expect, vi, beforeEach } from "vitest";
import { Listener } from "../../src/daemon/listener.ts";

describe("Listener", () => {
  let listener: Listener;

  const mockEvents = {
    onMessage: vi.fn(),
    onConnect: vi.fn(),
    onDisconnect: vi.fn(),
    onError: vi.fn(),
  };

  beforeEach(() => {
    listener = new Listener(
      "ws://localhost:3000",
      "TestUser",
      mockEvents
    );
  });

  it("is constructed with url, name and events", () => {
    expect(listener).toBeDefined();
  });

  it("has connect method", () => {
    expect(typeof listener.connect).toBe("function");
  });

  it("has send method", () => {
    expect(typeof listener.send).toBe("function");
  });

  it("has destroy method", () => {
    expect(typeof listener.destroy).toBe("function");
  });
});
