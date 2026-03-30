import React from "react";
import { Box, Text } from "ink";
import { Header } from "./Header.js";
import { ChatView } from "./ChatView.js";
import { InputBar } from "./InputBar.js";
import { useRing } from "./hooks/useRing.js";

interface AppProps {
  url: string;
  name: string;
}

export function App({ url, name }: AppProps) {
  const { messages, participants, connected, sendMessage } = useRing({
    url,
    name,
  });

  return (
    <>
      <ChatView messages={messages} url={url} />
      <Box flexDirection="column">
        {!connected && (
          <Box justifyContent="center">
            <Text color="red">Disconnected. Reconnecting...</Text>
          </Box>
        )}
        <Box borderStyle="round" borderColor="gray" paddingX={1} gap={1} width="100%">
          <Text color="green" bold>
            {participants > 0 ? `[${participants} online]` : ""}
          </Text>
          <InputBar onSubmit={sendMessage} />
        </Box>
      </Box>
    </>
  );
}
