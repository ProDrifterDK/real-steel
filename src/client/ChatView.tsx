import React, { useMemo } from "react";
import { Box, Text, useStdout } from "ink";
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
  const { stdout } = useStdout();
  const maxVisible = (stdout?.rows || 24) - 4;

  const visibleMessages = useMemo(
    () => messages.slice(-Math.max(maxVisible, 10)),
    [messages, maxVisible]
  );

  let lastDate = "";

  return (
    <Box flexDirection="column" flexGrow={1}>
      {visibleMessages.map((msg) => {
        const msgDate = formatDate(msg.timestamp);
        const showDateSeparator = msgDate !== lastDate;
        lastDate = msgDate;

        return (
          <Box key={msg.id} flexDirection="column">
            {showDateSeparator && (
              <Box justifyContent="center" paddingY={1}>
                <Text dimColor>{"── "}{msgDate}{" ──"}</Text>
              </Box>
            )}
            <MessageBubble message={msg} />
          </Box>
        );
      })}
    </Box>
  );
}
