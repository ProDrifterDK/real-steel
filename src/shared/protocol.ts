import { v4 as uuidv4 } from "uuid";

export type Role = "human" | "agent";

export interface ChatMessage {
  id: string;
  seq: number;
  type: "message";
  from: string;
  role: Role;
  content: string;
  timestamp: string;
}

export interface SystemEvent {
  id: string;
  seq: number;
  type: "system";
  content: string;
  timestamp: string;
}

export type RingMessage = ChatMessage | SystemEvent;

export function createChatMessage(
  from: string,
  role: Role,
  content: string,
  seq: number
): ChatMessage {
  return {
    id: uuidv4(),
    seq,
    type: "message",
    from,
    role,
    content,
    timestamp: new Date().toISOString(),
  };
}

export function createSystemEvent(content: string): SystemEvent {
  return {
    id: uuidv4(),
    seq: 0,
    type: "system",
    content,
    timestamp: new Date().toISOString(),
  };
}

export function parseMessage(raw: string): RingMessage | null {
  try {
    const data = JSON.parse(raw);
    if (data.type === "message") {
      if (
        !data.id || !data.from || !data.role ||
        data.content === undefined || data.seq === undefined ||
        !data.timestamp
      ) {
        return null;
      }
      return data as ChatMessage;
    }
    if (data.type === "system") {
      if (!data.id || data.content === undefined || !data.timestamp) {
        return null;
      }
      return data as SystemEvent;
    }
    return null;
  } catch {
    return null;
  }
}
