import { describe, it, expect } from "vitest";
import {
  parseCloudflaredUrl,
  getInstallCommand,
} from "../../src/server/cloudflared.js";

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
