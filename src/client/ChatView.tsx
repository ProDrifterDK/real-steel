import React from "react";
import { Static, Box, Text } from "ink";
import { MessageBubble } from "./MessageBubble.js";
import type { RingMessage } from "../shared/protocol.js";

interface ChatViewProps {
  messages: RingMessage[];
}

function formatDate(timestamp: string): string {
  return new Date(timestamp).toLocaleDateString("es-CL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function ChatView({ messages }: ChatViewProps) {
  return (
    <Static items={messages}>
      {(msg, index) => {
        const prevMsg = index > 0 ? messages[index - 1] : null;
        const showDateSeparator =
          !prevMsg ||
          formatDate(msg.timestamp) !== formatDate(prevMsg.timestamp);

        return (
          <Box key={msg.id} flexDirection="column">
            {showDateSeparator && (
              <Box justifyContent="center" paddingY={0}>
                <Text dimColor>
                  {"── "}
                  {formatDate(msg.timestamp)}
                  {" ──"}
                </Text>
              </Box>
            )}
            <MessageBubble message={msg} />
          </Box>
        );
      }}
    </Static>
  );
}
