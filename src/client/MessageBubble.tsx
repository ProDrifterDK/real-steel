import React from 'react';
import { Box, Text } from 'ink';
import { marked } from 'marked';

// Import types for namespace functions (marked-terminal uses namespace pattern)
interface HeadingStyle {
  level?: number[];
  style?: string;
}

interface HighlightOptions {
  theme?: string;
}

interface TerminalRendererOptions extends Partial<{
  heading: HeadingStyle;
}> {}

interface MarkedExtension {
  renderer: Record<string, any>;
  useNewRenderer: true;
}

// Type assertion for namespace functions (marked-terminal uses namespace pattern)
declare function markedTerminal(options: Partial<TerminalRendererOptions>): MarkedExtension;
declare function highlighted(highlightOptions?: HighlightOptions): MarkedExtension;

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

// Configure marked with terminal renderer (only once)
(marked as any).use(
  ((options: any[]) => ({ useNewRenderer: true }))([
    {
      heading: {
        level: [1, 2],
        style: 'cyan.bold',
        prefix: ['# ', '# ', '# '] as string[]
      }
    }
  ])
);

function renderContent(content: string, isAgent: boolean): string {
  if (isAgent) {
    // Use parseSync for synchronous rendering (required by Ink)
    const result = marked.parse(content);
    return (result as any).toString?.() || result;
  }
  return content;
}

export function MessageBubble({ message }: { message: any }) {
  if (message.type === 'system') {
    return (
      <Box paddingX={1}>
        <Text dimColor italic>
          {formatTime(message.timestamp)} {message.content}
        </Text>
      </Box>
    );
  }

  const chatMsg = message as any;
  const isAgent = (chatMsg as any).role === 'agent';
  
  // Add emoji prefix based on role
  let nameColor: string;
  let prefix: string;
  
  if (isAgent) {
    nameColor = 'magenta';
    // Use AI-related emojis for agent messages
    const aiEmojis = ['🤖', '🧠', '✨', '💡', '🎯'];
    prefix = aiEmojis[Math.floor(Math.random() * aiEmojis.length)];
  } else {
    nameColor = 'yellow';
    // Use human-related emojis for user messages (or just space)
    const humanEmojis = ['👤', '💬', '💭'];
    prefix = humanEmojis[Math.floor(Math.random() * humanEmojis.length)];
  }

  return (
    <Box paddingX={1} flexDirection='row' gap={1}>
      <Text dimColor>{formatTime((chatMsg as any).timestamp)}</Text>
      <Text color={nameColor} bold>
        {prefix}{(chatMsg as any).from}
      </Text>
      <Text>{renderContent((chatMsg as any).content, isAgent)}</Text>
    </Box>
  );
}
