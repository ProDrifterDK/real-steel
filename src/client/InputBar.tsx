import React, { useState } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';

interface InputBarProps {
  onSubmit: (text: string) => void;
}

export function InputBar({ onSubmit }: InputBarProps) {
  const [value, setValue] = useState('');

  const handleSubmit = (text: string) => {
    if (text.trim()) {
      onSubmit(text.trim());
      setValue('');
    }
  };

  return (
    <Box borderStyle='round' borderColor='gray' paddingX={1}>
      <Text color='green'>➜ </Text>
      <TextInput 
        value={value} 
        onChange={setValue} 
        onSubmit={handleSubmit} 
        placeholder="Type a message..."
      />
    </Box>
  );
}
