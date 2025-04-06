import React from 'react';
import { Text, TextProps } from 'react-native';
import { cn } from '~/lib/utils'; // Assuming utils is setup

// Simple text-based icon placeholder
export const Check = ({ className, ...props }: TextProps & { size?: number }) => (
  <Text className={cn("text-foreground", className)} {...props}>✓</Text>
); 