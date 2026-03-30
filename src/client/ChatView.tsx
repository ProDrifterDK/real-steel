import React from 'react';
import { Box, Text, useStdout } from 'ink';

interface MessageWithDate {
  timestamp: string;
}

function formatDate(timestamp: string): string {
  return new Date(timestamp).toLocaleDateString('es-CL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function ChatView({ messages }: any) {
  const { stdout } = useStdout();
  
  // Reserve 4 lines for header and input bar, show as many messages as fit
  const maxVisible = (stdout?.rows || 24) - 4;

  // Always show the most recent messages (auto-scroll to bottom)
  const visibleMessages = React.useMemo(
    () => [...messages].reverse().slice(-Math.max(maxVisible, 10)),
    [messages, maxVisible]
  );

  let lastDate = '';

  return (
    <Box flexDirection="column" flexGrow={1}>
      {visibleMessages.map((msg: any) => {
        const msgDate = formatDate(msg.timestamp);
        const showDateSeparator = msgDate !== lastDate;
        lastDate = msgDate;

        return (
          <Box key={msg.id || Date.now()} flexDirection="column">
            {showDateSeparator && (
              <Box justifyContent="center" paddingY={1}>
                <Text dimColor>{'── '}{msgDate}{' ──'}</Text>
              </Box>
            )}
            
            {/* Import MessageBubble here for tree-shaking */}
            {/** Render the message with basic formatting if MessageBubble is not available yet */}
            <Box paddingX={1}>
              <Text dimColor>{msg.timestamp}</Text>
              
              {/* Simple text rendering fallback */}
              {msg.from && (
                <>
                  {'  '}
                  <Text color="yellow" bold>
                    {msg.from}:{' '}
                  </Text>
                  <Text wrap="middle">
                    {typeof msg.content === 'object' 
                      ? JSON.stringify(msg.content) 
                      : msg.content}
                  </Text>
                </>
              )}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
