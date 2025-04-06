import React from 'react';
import { Text, TextProps } from 'react-native';
import { cn } from '~/lib/utils'; 

// Simple text-based icon placeholder
export const ChevronDown = ({ className, ...props }: TextProps & { size?: number }) => (
  <Text className={cn("text-foreground opacity-50", className)} {...props}>⌄</Text>
); 