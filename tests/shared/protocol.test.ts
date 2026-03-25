import { describe, it, expect } from "vitest";
import {
  createChatMessage,
  createSystemEvent,
  parseMessage,
  type ChatMessage,
  type SystemEvent,
  type RingMessage,
} from "../../src/shared/protocol.js";

describe("protocol", () => {
  describe("createChatMessage", () => {
    it("creates a human chat message with id, seq, and timestamp", () => {
      const msg = createChatMessage("Pedro", "human", "hello", 1);
      expect(msg.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
      expect(msg.seq).toBe(1);
      expect(msg.type).toBe("message");
      expect(msg.from).toBe("Pedro");
      expect(msg.role).toBe("human");
      expect(msg.content).toBe("hello");
      expect(msg.timestamp).toBeDefined();
    });

    it("creates an agent chat message", () => {
      const msg = createChatMessage("Claude-Pedro", "agent", "I see the issue", 5);
      expect(msg.role).toBe("agent");
      expect(msg.from).toBe("Claude-Pedro");
    });
  });

  describe("createSystemEvent", () => {
    it("creates a system event with type system", () => {
      const evt = createSystemEvent("Pedro has joined the ring");
      expect(evt.type).toBe("system");
      expect(evt.content).toBe("Pedro has joined the ring");
      expect(evt.id).toBeDefined();
    });
  });

  describe("parseMessage", () => {
    it("parses a valid chat message JSON string", () => {
      const msg = createChatMessage("Pedro", "human", "test", 1);
      const json = JSON.stringify(msg);
      const parsed = parseMessage(json);
      expect(parsed).toEqual(msg);
    });

    it("returns null for invalid JSON", () => {
      expect(parseMessage("not json")).toBeNull();
    });

    it("returns null for JSON missing required fields", () => {
      expect(parseMessage('{"type": "message"}')).toBeNull();
    });

    it("returns null for message missing seq or timestamp", () => {
      expect(
        parseMessage('{"type": "message", "id": "x", "from": "A", "role": "human", "content": "hi"}')
      ).toBeNull();
    });
  });
});
