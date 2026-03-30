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
    <Box flexDirection="column" height={process.stdout.rows || 24}>
      <Header url={url} participantCount={participants} />
      {!connected && (
        <Box justifyContent="center" paddingY={1}>
          <Text color="red">Disconnected. Reconnecting...</Text>
        </Box>
      )}
      <ChatView messages={messages} />
      <InputBar onSubmit={sendMessage} />
    </Box>
  );
}
