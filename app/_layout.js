// app/_layout.js - Root Layout with Sign-In on reload
import { useEffect, useRef, useState } from 'react';
import { Stack, usePathname, useRouter } from 'expo-router';
import { View, Text, ActivityIndicator, StyleSheet, StatusBar } from 'react-native';
import * as secureStorage from '../services/secureStorage';
import { ThemeProvider } from '../contexts/ThemeContext';

export default function RootLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const prevPathRef = useRef(null);

  const [isLoading, setIsLoading] = useState(true);
  // sessionUnlocked resets on reload (in-memory)
  const [sessionUnlocked, setSessionUnlocked] = useState(false);

  useEffect(() => {
    checkWalletStatus();
  }, []);

  const checkWalletStatus = async () => {
    try {
      await secureStorage.isWalletInitialized();
    } catch (error) {
      console.error('Error checking wallet:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Guard: if a dev reload opens /tabs directly, force Sign-In.
  useEffect(() => {
    if (isLoading) return;

    // If we landed on tabs and this session is not unlocked,
    // and we did NOT come from auth or onboarding, force sign-in.
    if (pathname?.startsWith('/tabs') && !sessionUnlocked) {
      const cameFromAuthOrOnboarding =
        prevPathRef.current?.startsWith?.('/auth') ||
        prevPathRef.current?.startsWith?.('/onboarding');

      if (!cameFromAuthOrOnboarding) {
        router.replace('/auth/sign-in');
      } else {
        // We just navigated from auth/onboarding → allow tabs and mark session unlocked
        setSessionUnlocked(true);
      }
    }

    // If we just navigated away from auth to tabs, mark session unlocked
    if (prevPathRef.current?.startsWith?.('/auth') && pathname?.startsWith?.('/tabs')) {
      setSessionUnlocked(true);
    }

    prevPathRef.current = pathname;
  }, [pathname, isLoading]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#0a0a0f" />
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loadingText}>Loading Wallet...</Text>
      </View>
    );
  }

  return (
    <ThemeProvider>
      <>
        <StatusBar barStyle="light-content" backgroundColor="#0a0a0f" translucent={false} />
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'fade',
            statusBarStyle: 'light',
            statusBarColor: '#0a0a0f',
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false, statusBarStyle: 'light' }} />
          <Stack.Screen name="auth" options={{ headerShown: false, animation: 'fade', statusBarStyle: 'light' }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false, animation: 'slide_from_right', statusBarStyle: 'light' }} />
          <Stack.Screen name="tabs" options={{ headerShown: false, animation: 'fade', statusBarStyle: 'light' }} />
          <Stack.Screen name="issue" options={{ presentation: 'modal', animation: 'slide_from_bottom', headerShown: false, statusBarStyle: 'light' }} />
          <Stack.Screen name="verify" options={{ presentation: 'modal', animation: 'slide_from_bottom', headerShown: false, statusBarStyle: 'light' }} />
          <Stack.Screen name="test" options={{ presentation: 'modal', animation: 'slide_from_bottom', headerShown: false, statusBarStyle: 'light' }} />
        </Stack>
      </>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0a0a0f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    marginTop: 12,
    fontSize: 16,
  },
});