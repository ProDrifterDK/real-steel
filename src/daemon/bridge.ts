import { spawn } from "child_process";
import { v4 as uuidv4 } from "uuid";
import type { RingMessage, ChatMessage } from "../shared/protocol.js";

export interface BridgeConfig {
  userName: string;
  maxInvocationsPerMinute: number;
  systemPrompt: string;
  permissionMode: string;
  toolRestrictions?: { type: string; tools: string[] };
}

/**
 * Formatea mensajes del ring en un formato legible para Claude.
 * Ejemplo:
 *   [14:30 Pedro]: hello
 *   [14:31 Samuel]: hi there
 */
export function formatMessagesForClaude(messages: RingMessage[]): string {
  return messages
    .map((msg) => {
      if (msg.type === "system") {
        return `[system]: ${msg.content}`;
      }
      const time = new Date(msg.timestamp).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      return `[${time} ${msg.from}]: ${msg.content}`;
    })
    .join("\n");
}

export class ClaudeBridge {
  private sessionId: string | null = null;
  private busy = false;
  private invocationTimestamps: number[] = [];
  private config: BridgeConfig;

  constructor(config: BridgeConfig) {
    this.config = config;
  }

  /** Returns true if bridge is currently invoking Claude */
  isBusy(): boolean {
    return this.busy;
  }

  setBusy(busy: boolean): void {
    this.busy = busy;
  }

  /** Checks rate limit: returns true if we can invoke Claude */
  canInvoke(): boolean {
    const now = Date.now();
    const oneMinuteAgo = now - 60_000;
    // Clean old timestamps
    this.invocationTimestamps = this.invocationTimestamps.filter(
      (t) => t > oneMinuteAgo
    );
    return this.invocationTimestamps.length < this.config.maxInvocationsPerMinute;
  }

  /** Records an invocation timestamp for rate limiting */
  recordInvocation(): void {
    this.invocationTimestamps.push(Date.now());
  }

  /**
   * Invoca Claude con los mensajes acumulados.
   * Returns response text or null if silent/rate-limited/error.
   */
  async invoke(messages: RingMessage[]): Promise<string | null> {
    // Check rate limit
    if (!this.canInvoke()) {
      console.log("[bridge] Rate limited, skipping invocation");
      return null;
    }

    this.setBusy(true);
    this.recordInvocation();

    try {
      const formatted = formatMessagesForClaude(messages);
      const prompt =
        `New messages in the ring:\n${formatted}\n\n` +
        `You are a participant in a collaborative chat ring. Answer questions, share knowledge, and engage in the conversation. ` +
        `Only respond with exactly [SILENT] if the messages are purely social chatter between humans that doesn't need your input (e.g., "brb", "lol", greetings between people). ` +
        `For any question, technical discussion, or request for help — always respond.`;

      const args = this.buildArgs(prompt);
      const response = await this.execClaude(args);

      return this.parseResponse(response);
    } finally {
      this.setBusy(false);
    }
  }

  /**
   * Parsea la respuesta de Claude.
   * --output-format json devuelve un array de eventos:
   * [{ type: "system", ... }, { type: "assistant", ... }, { type: "result", result: "..." }]
   */
  private parseResponse(raw: string): string | null {
    if (!raw) return null;

    try {
      const data = JSON.parse(raw);
      const items = Array.isArray(data) ? data : [data];
      const resultItem = items.find((item: any) => item.type === "result");
      if (!resultItem) return null;

      const text = resultItem.result || "";
      // Detect [SILENT] response
      if (!text || text.trim().toUpperCase() === "[SILENT]") {
        console.log("[bridge] Claude responded with [SILENT]");
        return null;
      }
      return text.trim();
    } catch {
      // Fallback: treat as plain text
      if (!raw.trim() || raw.trim().toUpperCase() === "[SILENT]") {
        return null;
      }
      return raw.trim();
    }
  }

  /**
   * Construye argumentos CLI para invocar Claude.
   * Usa --session-id en primera invocación, luego --resume.
   */
  private buildArgs(prompt: string): string[] {
    const args = [
      "--print",
      "--output-format",
      "json",
      "--permission-mode",
      this.config.permissionMode,
    ];

    if (this.sessionId) {
      // Reanudar sesión existente
      args.push("--resume", this.sessionId);
    } else {
      // Nueva sesión
      this.sessionId = uuidv4();
      args.push("--session-id", this.sessionId);
      args.push("--append-system-prompt", this.config.systemPrompt);
    }

    // Privacy tool restrictions
    if (this.config.toolRestrictions) {
      if (this.config.toolRestrictions.type === "allowed") {
        args.push("--allowedTools", ...this.config.toolRestrictions.tools);
      } else if (this.config.toolRestrictions.type === "disallowed") {
        args.push("--disallowedTools", ...this.config.toolRestrictions.tools);
      }
    }

    args.push(prompt);
    return args;
  }

  /**
   * Ejecuta el CLI de Claude y captura stdout.
   */
  private execClaude(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn("claude", args, {
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      proc.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on("close", (code) => {
        if (code !== 0) {
          console.error(`[bridge] Claude exited with code ${code}: ${stderr}`);
          resolve(""); // Return empty on error, don't reject
        } else {
          resolve(stdout);
        }
      });

      proc.on("error", (err) => {
        console.error(`[bridge] Failed to spawn claude: ${err.message}`);
        resolve(""); // Return empty on error
      });
    });
  }
}
