import { describe, it, expect } from "vitest";
import { generatePrivacyPrompt, generateToolRestrictions } from "../../src/privacy/filter.js";
import type { PrivacyConfig } from "../../src/shared/config.js";

describe("privacy filter", () => {
  describe("generatePrivacyPrompt", () => {
    it("generates whitelist prompt with paths", () => {
      const config: PrivacyConfig = { mode: "whitelist", paths: ["/repo-x", "/project-y"] };
      const prompt = generatePrivacyPrompt(config);
      expect(prompt).toContain("whitelist");
      expect(prompt).toContain("/repo-x");
      expect(prompt).toContain("/project-y");
    });

    it("generates blacklist prompt with paths", () => {
      const config: PrivacyConfig = { mode: "blacklist", paths: [".env", "credentials"] };
      const prompt = generatePrivacyPrompt(config);
      expect(prompt).toContain("Do not share");
      expect(prompt).toContain(".env");
    });

    it("generates claude-decides prompt", () => {
      const config: PrivacyConfig = { mode: "claude-decides", paths: [] };
      const prompt = generatePrivacyPrompt(config);
      expect(prompt).toContain("judgment");
    });
  });

  describe("generateToolRestrictions", () => {
    it("returns allowedTools for whitelist mode", () => {
      const config: PrivacyConfig = { mode: "whitelist", paths: ["/repo-x"] };
      const restrictions = generateToolRestrictions(config);
      expect(restrictions.type).toBe("allowed");
      expect(restrictions.tools).toContain("Read(/repo-x/*)");
    });

    it("returns disallowedTools for blacklist mode", () => {
      const config: PrivacyConfig = { mode: "blacklist", paths: [".env"] };
      const restrictions = generateToolRestrictions(config);
      expect(restrictions.type).toBe("disallowed");
      expect(restrictions.tools).toContain("Read(*.env*)");
    });

    it("returns no restrictions for claude-decides mode", () => {
      const config: PrivacyConfig = { mode: "claude-decides", paths: [] };
      const restrictions = generateToolRestrictions(config);
      expect(restrictions.type).toBe("none");
    });
  });
});
