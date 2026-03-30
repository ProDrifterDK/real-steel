import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Debouncer } from "../../src/daemon/debouncer.ts";
import { createChatMessage } from "../../src/shared/protocol.ts";

describe("Debouncer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires callback after debounce period with accumulated messages", async () => {
    const callback = vi.fn();
    const debouncer = new Debouncer(1000, callback);

    const msg1 = createChatMessage("Pedro", "human", "hello", 1);
    const msg2 = createChatMessage("Samuel", "human", "hi", 1);

    debouncer.push(msg1);
    debouncer.push(msg2);

    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith([msg1, msg2]);
  });

  it("resets timer when new message arrives within debounce period", () => {
    const callback = vi.fn();
    const debouncer = new Debouncer(1000, callback);

    debouncer.push(createChatMessage("Pedro", "human", "msg1", 1));
    vi.advanceTimersByTime(800);
    debouncer.push(createChatMessage("Pedro", "human", "msg2", 2));
    vi.advanceTimersByTime(800);

    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(200);

    expect(callback).toHaveBeenCalledTimes(1);
    const msgs = callback.mock.calls[0][0];
    expect(msgs).toHaveLength(2);
  });

  it("does not fire if batch contains only agent messages (circuit breaker)", () => {
    const callback = vi.fn();
    const debouncer = new Debouncer(1000, callback);

    debouncer.push(createChatMessage("Claude-Pedro", "agent", "I think...", 1));
    debouncer.push(createChatMessage("Claude-Samuel", "agent", "I agree...", 1));

    vi.advanceTimersByTime(1000);

    expect(callback).not.toHaveBeenCalled();
  });

  it("fires if batch contains at least one human message mixed with agent messages", () => {
    const callback = vi.fn();
    const debouncer = new Debouncer(1000, callback);

    debouncer.push(createChatMessage("Claude-Pedro", "agent", "I think...", 1));
    debouncer.push(createChatMessage("Samuel", "human", "interesting", 1));

    vi.advanceTimersByTime(1000);

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("clears accumulated messages after firing", () => {
    const callback = vi.fn();
    const debouncer = new Debouncer(1000, callback);

    debouncer.push(createChatMessage("Pedro", "human", "first batch", 1));
    vi.advanceTimersByTime(1000);

    debouncer.push(createChatMessage("Samuel", "human", "second batch", 1));
    vi.advanceTimersByTime(1000);

    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback.mock.calls[0][0]).toHaveLength(1);
    expect(callback.mock.calls[1][0]).toHaveLength(1);
  });
});
