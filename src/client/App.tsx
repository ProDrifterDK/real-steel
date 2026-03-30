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
      <ChatView messages={messages} />
      <Box flexDirection="column">
        <Header url={url} participantCount={participants} />
        {!connected && (
          <Box justifyContent="center">
            <Text color="red">Disconnected. Reconnecting...</Text>
          </Box>
        )}
        <InputBar onSubmit={sendMessage} />
      </Box>
    </>
  );
}
