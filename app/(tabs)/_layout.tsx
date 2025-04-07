import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import { HapticTab } from '../../components/HapticTab';
import { IconSymbol } from '../../components/ui/IconSymbol';
import TabBarBackground from '../../components/ui/TabBarBackground';
import { useColorScheme } from '../../hooks/useColorScheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#A8B9AE',
        tabBarInactiveTintColor: '#DADADA',
        headerShown: true,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: Platform.select({
          ios: {
            position: 'absolute',
            backgroundColor: 'transparent',
            borderTopWidth: 0,
            elevation: 0,
          },
          default: {
            backgroundColor: '#FAFAF9',
            borderTopColor: '#E7E7E7',
          },
        }),
        headerStyle: {
          backgroundColor: '#FAFAF9',
        },
        headerTitleStyle: {
          color: '#4A4A4A',
        }
      }}>
      <Tabs.Screen
        name="beans"
        options={{
          title: 'Beans',
          tabBarIcon: ({ color }: { color: string }) => <IconSymbol size={28} name="leaf.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: 'Add Brew',
          tabBarIcon: ({ color }: { color: string }) => <IconSymbol size={28} name="plus.circle.fill" color={color} />,
        }}
      />

      <Tabs.Screen
        name="brews"
        options={{
          title: 'Brews',
          tabBarIcon: ({ color }: { color: string }) => <IconSymbol size={28} name="list.bullet" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }: { color: string }) => <IconSymbol size={28} name="gearshape.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
