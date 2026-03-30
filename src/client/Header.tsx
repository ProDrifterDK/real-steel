import React from "react";
import { Box, Text } from "ink";

interface HeaderProps {
  url: string;
  participantCount: number;
}

/**
 * Cabecera de la interfaz mostrando información del ring.
 */
export function Header({ url, participantCount }: HeaderProps) {
  return (
    <Box
      borderStyle="round"
      borderColor="cyan"
      paddingX={1}
      justifyContent="space-between"
    >
      <Text bold color="cyan">
        Real Steel
      </Text>
      <Text dimColor>{url}</Text>
      <Text color="green">{participantCount} online</Text>
    </Box>
  );
}
