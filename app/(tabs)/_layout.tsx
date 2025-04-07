import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, Image } from 'react-native';

import { HapticTab } from '../../components/HapticTab';
import { IconSymbol } from '../../components/ui/IconSymbol';
import TabBarBackground from '../../components/ui/TabBarBackground';

export default function TabLayout() {
  return (
    <Tabs
      initialRouteName="index" // Start on the Beans tab
      screenOptions={{
        tabBarActiveTintColor: '#A8B9AE',
        tabBarInactiveTintColor: '#DADADA',
        headerShown: false, // We'll use the Stack header from the root layout
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
      }}>
      <Tabs.Screen
        name="index" // Corresponds to app/(tabs)/index.tsx
        options={{
          title: 'Beans',
          tabBarIcon: ({ color }: { color: string }) => (
            <Image
              source={require('../../assets/images/beans.png')}
              style={{ width: 52, height: 52, tintColor: color }}
            />
          ),
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