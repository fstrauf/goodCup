import '../global.css'; // Import global CSS for NativeWind
import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { ThemeProvider as RNEThemeProvider } from '@rneui/themed';
import { LogBox, View } from 'react-native'; // Import LogBox and View

import { useColorScheme } from '../hooks/useColorScheme';

// Ignore the specific defaul tProps warning from Slider
LogBox.ignoreLogs([
  'Slider: Support for defaultProps will be removed',
]);

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    // Wrap with RNE ThemeProvider (can be inside or outside NavThemeProvider)
    <RNEThemeProvider /* theme={rneTheme} */>
      <NavThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <View className="flex-1 bg-soft-off-white"> 
          <Stack>
            {/* Define the tabs group. headerShown: false hides the Stack header FOR the tabs screen itself */}
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            {/* Dynamic routes are now handled within (tabs) */}
            <Stack.Screen name="+not-found" />
          </Stack>
          <StatusBar style="auto" />
        </View>
      </NavThemeProvider>
    </RNEThemeProvider>
  );
}
