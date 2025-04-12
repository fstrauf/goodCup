import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

export default function App() {

  // --- Network Test ---
  useEffect(() => {
    const testNetwork = async () => {
      try {
        console.log('[Minimal Test - Network] Attempting to fetch google.com...');
        const response = await fetch('https://google.com');
        console.log('[Minimal Test - Network] Google fetch status:', response.status);
      } catch (error) {
        console.error('[Minimal Test - Network] Error fetching google.com:', error);
      }
    };
    testNetwork();
  }, []);
  // --- End Network Test ---

  return (
    <View style={styles.container}>
      <Text>Minimal Test App</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
