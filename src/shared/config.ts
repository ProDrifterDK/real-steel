export type PrivacyMode = "whitelist" | "blacklist" | "claude-decides";

export interface PrivacyConfig {
  mode: PrivacyMode;
  paths: string[];
}

export interface DaemonConfig {
  debounceMs: number;
  maxInvocationsPerMinute: number;
  privacy: PrivacyConfig;
}

export interface JoinConfig {
  ringUrl: string;
  name: string;
  noClaude: boolean;
  daemon: DaemonConfig;
}

export interface ServeConfig {
  port: number;
  customUrl?: string;
}

export const DEFAULT_DAEMON_CONFIG: DaemonConfig = {
  debounceMs: 5000,
  maxInvocationsPerMinute: 2,
  privacy: {
    mode: "whitelist",
    paths: [],
  },
};

export const DEFAULT_PORT = 3000;
export const MESSAGE_BUFFER_SIZE = 200;
