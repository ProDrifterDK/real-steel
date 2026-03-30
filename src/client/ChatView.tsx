import React, { useMemo } from "react";
import { Static, Box, Text } from "ink";
import { MessageBubble } from "./MessageBubble.js";
import type { RingMessage } from "../shared/protocol.js";

interface ChatViewProps {
  messages: RingMessage[];
  url: string;
}

function formatDate(timestamp: string): string {
  return new Date(timestamp).toLocaleDateString("es-CL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// A stable header item prepended to the Static items list so it renders
// once at the very top of the terminal output.
interface StaticItem {
  id: string;
  kind: "header" | "message";
  url?: string;
  msg?: RingMessage;
  prevTimestamp?: string;
}

export function ChatView({ messages, url }: ChatViewProps) {
  const items: StaticItem[] = useMemo(() => {
    const header: StaticItem = { id: "__header__", kind: "header", url };
    const msgItems: StaticItem[] = messages.map((msg, i) => ({
      id: msg.id,
      kind: "message" as const,
      msg,
      prevTimestamp: i > 0 ? messages[i - 1].timestamp : undefined,
    }));
    return [header, ...msgItems];
  }, [messages, url]);

  return (
    <Static items={items}>
      {(item) => {
        if (item.kind === "header") {
          return (
            <Box
              key={item.id}
              borderStyle="round"
              borderColor="cyan"
              paddingX={1}
              justifyContent="space-between"
              width="100%"
            >
              <Text bold color="cyan">
                Real Steel
              </Text>
              <Text dimColor>{item.url}</Text>
            </Box>
          );
        }

        const msg = item.msg!;
        const showDateSeparator =
          !item.prevTimestamp ||
          formatDate(msg.timestamp) !== formatDate(item.prevTimestamp);

        return (
          <Box key={item.id} flexDirection="column">
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
