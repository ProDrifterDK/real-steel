import type { PrivacyConfig } from "../shared/config.js";

export interface ToolRestrictions {
  type: "allowed" | "disallowed" | "none";
  tools: string[];
}

export function generatePrivacyPrompt(config: PrivacyConfig): string {
  switch (config.mode) {
    case "whitelist": {
      const pathList = config.paths.join(", ");
      return (
        `Privacy mode: whitelist. You may only share information from these allowed paths: ${pathList}. ` +
        `Do not reference, quote, or describe the contents of any file outside these paths.`
      );
    }
    case "blacklist": {
      const pathList = config.paths.join(", ");
      return (
        `Privacy mode: blacklist. Do not share anything related to: ${pathList}. ` +
        `Do not reference, quote, or describe the contents of files matching those patterns.`
      );
    }
    case "claude-decides":
      return (
        `Privacy mode: use your judgment. You have full access to the local file system. ` +
        `Decide what is appropriate to share based on context. Avoid sharing secrets, credentials, or personal data.`
      );
  }
}

export function generateToolRestrictions(config: PrivacyConfig): ToolRestrictions {
  switch (config.mode) {
    case "whitelist":
      return {
        type: "allowed",
        tools: config.paths.map((p) => `Read(${p}/*)`),
      };
    case "blacklist":
      return {
        type: "disallowed",
        tools: config.paths.map((p) => `Read(*${p}*)`),
      };
    case "claude-decides":
      return { type: "none", tools: [] };
  }
}
