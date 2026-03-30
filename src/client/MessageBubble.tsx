import React from "react";
import { Box, Text } from "ink";
import { marked } from "marked";
import { markedTerminal } from "marked-terminal";
import type { RingMessage, ChatMessage } from "../shared/protocol.js";

// Configure marked to render markdown as ANSI terminal output (runs once)
// Type cast needed: @types/marked-terminal is outdated for v7.3.0
marked.use(markedTerminal() as any);

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function renderContent(content: string, isAgent: boolean): string {
  if (isAgent) {
    return (marked.parse(content) as string).trimEnd();
  }
  return content;
}

interface MessageBubbleProps {
  message: RingMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  if (message.type === "system") {
    return (
      <Box paddingX={1}>
        <Text dimColor italic>
          {formatTime(message.timestamp)} {message.content}
        </Text>
      </Box>
    );
  }

  const chatMsg = message as ChatMessage;
  const isAgent = chatMsg.role === "agent";
  const nameColor = isAgent ? "magenta" : "yellow";
  const prefix = isAgent ? "\u{1F916} " : "";

  if (isAgent) {
    // Agent messages: name on first line, content below (avoids wrapping issues)
    return (
      <Box paddingX={1} flexDirection="column">
        <Text>
          <Text dimColor>{formatTime(chatMsg.timestamp)}</Text>
          {" "}
          <Text color={nameColor} bold>
            {prefix}{chatMsg.from}
          </Text>
        </Text>
        <Text>{renderContent(chatMsg.content, true)}</Text>
      </Box>
    );
  }

  // Human messages: inline (they're typically short)
  return (
    <Box paddingX={1}>
      <Text>
        <Text dimColor>{formatTime(chatMsg.timestamp)}</Text>
        {" "}
        <Text color={nameColor} bold>{chatMsg.from}</Text>
        {" "}
        {chatMsg.content}
      </Text>
    </Box>
  );
}
