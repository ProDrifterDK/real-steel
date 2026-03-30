import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ClaudeBridge,
  formatMessagesForClaude,
} from "../../src/daemon/bridge.ts";
import { createChatMessage } from "../../src/shared/protocol.ts";

describe("formatMessagesForClaude", () => {
  it("formats messages as timestamped lines", () => {
    const msgs = [
      createChatMessage("Pedro", "human", "hello", 1),
      createChatMessage("Samuel", "human", "hi there", 1),
    ];
    const formatted = formatMessagesForClaude(msgs);
    expect(formatted).toContain("Pedro");
    expect(formatted).toContain("hello");
    expect(formatted).toContain("Samuel");
    expect(formatted).toContain("hi there");
  });

  it("includes role prefix for agent messages", () => {
    const msgs = [
      createChatMessage("Claude-Pedro", "agent", "I see the issue", 1),
    ];
    const formatted = formatMessagesForClaude(msgs);
    expect(formatted).toContain("Claude-Pedro");
    expect(formatted).toContain("I see the issue");
  });
});

describe("ClaudeBridge", () => {
  describe("rate limiting", () => {
    it("respects max invocations per minute", () => {
      const bridge = new ClaudeBridge({
        userName: "Pedro",
        maxInvocationsPerMinute: 2,
        systemPrompt: "test",
        permissionMode: "auto",
      });

      expect(bridge.canInvoke()).toBe(true);
      bridge.recordInvocation();
      expect(bridge.canInvoke()).toBe(true);
      bridge.recordInvocation();
      expect(bridge.canInvoke()).toBe(false);
    });
  });

  describe("busy lock", () => {
    it("tracks busy state", () => {
      const bridge = new ClaudeBridge({
        userName: "Pedro",
        maxInvocationsPerMinute: 10,
        systemPrompt: "test",
        permissionMode: "auto",
      });

      expect(bridge.isBusy()).toBe(false);
      bridge.setBusy(true);
      expect(bridge.isBusy()).toBe(true);
      bridge.setBusy(false);
      expect(bridge.isBusy()).toBe(false);
    });
  });
});
