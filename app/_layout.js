// app/_layout.js - Root Layout with Status Bar Fix
import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { View, Text, ActivityIndicator, StyleSheet, StatusBar } from 'react-native';
import * as secureStorage from '../services/secureStorage';
import 'react-native-get-random-values';

export default function RootLayout() {
  const [isLoading, setIsLoading] = useState(true);
  const [hasWallet, setHasWallet] = useState(false);

  useEffect(() => {
    checkWalletStatus();
  }, []);

  const checkWalletStatus = async () => {
    try {
      const walletExists = await secureStorage.isWalletInitialized();
      setHasWallet(walletExists);
    } catch (error) {
      console.error('Error checking wallet:', error);
      setHasWallet(false);
    } finally {
      setIsLoading(false);
    }
  };

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
    <>
      <StatusBar 
        barStyle="light-content" 
        backgroundColor="#0a0a0f"
        translucent={false}
      />
      <Stack 
        screenOptions={{ 
          headerShown: false,
          animation: 'fade',
          statusBarStyle: 'light',
          statusBarColor: '#0a0a0f',
        }}
      >
        <Stack.Screen 
          name="index" 
          options={{ 
            headerShown: false,
            statusBarStyle: 'light',
          }} 
        />
        <Stack.Screen 
          name="auth" 
          options={{ 
            headerShown: false,
            animation: 'fade',
            statusBarStyle: 'light',
          }} 
        />
        <Stack.Screen 
          name="onboarding" 
          options={{ 
            headerShown: false,
            animation: 'slide_from_right',
            statusBarStyle: 'light',
          }} 
        />
        <Stack.Screen 
          name="tabs" 
          options={{ 
            headerShown: false,
            animation: 'fade',
            statusBarStyle: 'light',
          }} 
        />
        <Stack.Screen 
          name="issue" 
          options={{ 
            presentation: 'modal',
            animation: 'slide_from_bottom',
            headerShown: false,
            statusBarStyle: 'light',
          }} 
        />
        <Stack.Screen 
          name="verify" 
          options={{ 
            presentation: 'modal',
            animation: 'slide_from_bottom',
            headerShown: false,
            statusBarStyle: 'light',
          }} 
        />
        <Stack.Screen 
          name="test" 
          options={{ 
            presentation: 'modal',
            animation: 'slide_from_bottom',
            headerShown: false,
            statusBarStyle: 'light',
          }} 
        />
      </Stack>
    </>
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