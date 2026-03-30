import React from 'react';
import { Box, Text, useStdout } from 'ink';
import { Header } from './Header.js';
import { ChatView } from './ChatView.js';
import { InputBar } from './InputBar.js';
import { useRing } from './hooks/useRing.js';

interface AppProps {
  url: string;
  name: string;
}

function formatDate(timestamp: string): string {
  return new Date(timestamp).toLocaleDateString('es-CL', {
    day: 'numeric',
    month: 'long', 
    year: 'numeric',
  });
}

export function App({ url, name }: AppProps) {
  const { stdout } = useStdout();
  
  // Use the hook for connection management and state
  // Explicitly type to help TypeScript understand destructuring
  const result: ReturnType<typeof useRing> = useRing({ url, name });
  const { messages, participants, connected, sendMessage } = result;
  
  // Create messages with date tracking for ChatView (deprecated - kept for compatibility)
  const messagesWithDates = React.useMemo(() => {
    return [...(messages || [])].reverse().slice(-Math.max(stdout?.rows || 20, 10));
  }, [messages, stdout]);

  // Use real participant count from hook instead of hardcoded value
  const displayParticipants = participants;

  return (
    <Box flexDirection="column" height={stdout?.rows || 24}>
      {/* Header component - now shows real participant count */}
      <Header 
        url={url} 
        participantCount={displayParticipants}
      />
      
      {/* Connection status indicator */}
      <Box paddingX={1}>
        <Text dimColor>
          {connected ? '● Connected' : '○ Connecting...'}
        </Text>
      </Box>

      {/* Chat view - now uses the ChatView component! */}
      <ChatView messages={messages || []} />

      {/* Input bar - now uses the InputBar component with proper hook integration! */}
      <InputBar onSubmit={sendMessage} />
    </Box>
  );
}
