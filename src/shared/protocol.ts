import { v4 as uuidv4 } from "uuid";
import { parse as markedParse, type MarkedOptions } from "marked";

// ============================================================================
// TYPES - Core Protocol Types (from plan)
// ============================================================================

export type Role = "human" | "agent";

/**
 * Join request sent by a participant to join the ring.
 * Used for tunnel-based and direct WebSocket connections.
 */
export interface RingJoinRequest {
  name: string;
  noClaude?: boolean;
  daemonUrl?: string;
}

/**
 * Configuration for tunnel connection mode.
 */
export interface TunnelConfig {
  port: number;
  ringUrl: string;
  name: string;
}

/**
 * Chat message sent between participants in the ring.
 */
export interface ChatMessage {
  id: string;
  seq: number;
  type: "message";
  from: string;
  role: Role;
  content: string;
  timestamp: string;
}

/**
 * System event broadcast to all participants.
 */
export interface SystemEvent {
  id: string;
  seq: number;
  type: "system";
  content: string;
  timestamp: string;
}

export type RingMessage = ChatMessage | SystemEvent;

// ============================================================================
// HELPER FUNCTIONS - From plan (with improvements)
// ============================================================================

/**
 * Create a chat message with the given parameters.
 * seq defaults to auto-increment if not provided.
 */
export function createChatMessage(
  from: string,
  role: Role,
  content: string,
  seq?: number
): ChatMessage {
  const sequence = seq ?? Date.now();
  return {
    id: uuidv4(),
    seq: sequence,
    type: "message",
    from,
    role,
    content,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create a system event message.
 */
export function createSystemEvent(content: string): SystemEvent {
  return {
    id: uuidv4(),
    seq: 0,
    type: "system",
    content,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Parse a JSON message from raw data.
 * Returns null if the message is invalid or malformed.
 */
export function parseMessage(raw: string): RingMessage | null {
  try {
    const data = typeof raw === "object" ? (raw as unknown as Record<string, unknown>) : JSON.parse(raw);

    if (!data || !("type" in data)) {
      return null;
    }

    if (data.type === "message") {
      // Validate message structure
      const msg = data as ChatMessage;
      if (
        !msg.id ||
        !msg.from ||
        !msg.role ||
        msg.content === undefined ||
        msg.seq === undefined ||
        !msg.timestamp
      ) {
        return null;
      }
      return msg;
    }

    if (data.type === "system") {
      // Validate system event structure
      const msg = data as SystemEvent;
      if (!msg.id || !msg.content || !msg.timestamp) {
        return null;
      }
      return msg;
    }

    // Unknown type
    return null;
  } catch (e: unknown) {
    console.error("[protocol] Failed to parse message:", e);
    return null;
  }
}

/**
 * Deserialize markdown content into a plain text string.
 * Uses marked library for parsing markdown syntax.
 *
 * @param content - Markdown formatted text
 * @returns Plain text version of the markdown
 */
export function deserializeMarkdown(content: string, options?: MarkedOptions): string {
  try {
    // marked.parse() returns HTML as string (synchronous)
    return (markedParse(content, options) as unknown as { toString?(): string }).toString?.() || content;
  } catch (e: unknown) {
    console.error("[protocol] Failed to deserialize markdown:", e);
    return content;
  }
}

/**
 * Format a message for display in the chat.
 * Converts timestamp to readable format and renders markdown if enabled.
 */
export function formatMessageForDisplay(
  msg: RingMessage,
  options?: { showTimestamp?: boolean; renderMarkdown?: boolean; markedOptions?: MarkedOptions }
): string {
  const opts = { showTimestamp: true, renderMarkdown: true, markedOptions: {}, ...options };

  let result = "";

  // Add timestamp prefix if requested
  if (opts.showTimestamp) {
    try {
      result += `[${new Date(msg.timestamp).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })}] `;
    } catch {}
  }

  if (msg.type === "system") {
    result += `[System]: ${msg.content}`;
  } else {
    const chatMsg = msg as ChatMessage;

    // Add emoji prefix based on role
    let nameColor: string;
    let prefix: string;

    if (chatMsg.role === "agent") {
      nameColor = "magenta";
      const aiEmojis = ["🤖", "🧠", "✨", "💡", "🎯"];
      prefix = aiEmojis[Math.floor(Math.random() * aiEmojis.length)];
    } else {
      nameColor = "yellow";
      const humanEmojis = ["👤", "💬", "💭"];
      prefix = humanEmojis[Math.floor(Math.random() * humanEmojis.length)];
    }

    result += `${prefix}${chatMsg.from}: `;

    // Render markdown content if requested and role is agent
    if (opts.renderMarkdown && chatMsg.role === "agent") {
      try {
        result += markedParse(chatMsg.content, opts.markedOptions) || chatMsg.content;
      } catch {}
    } else {
      result += chatMsg.content;
    }
  }

  return result;
}
