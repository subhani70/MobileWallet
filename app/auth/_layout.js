// app/auth/_layout.js - Auth Stack Navigator
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen 
        name="sign-in" 
        options={{ 
          headerShown: false 
        }} 
      />
      <Stack.Screen 
        name="onboarding" 
        options={{ 
          headerShown: false,
          animation: 'slide_from_right'
        }} 
      />
      <Stack.Screen 
        name="pin-entry" 
        options={{ 
          headerShown: false,
          presentation: 'modal'
        }} 
      />
      <Stack.Screen 
        name="recovery-phrase" 
        options={{ 
          headerShown: false,
          presentation: 'modal'
        }} 
      />
      <Stack.Screen 
        name="biometric" 
        options={{ 
          headerShown: false,
          presentation: 'modal'
        }} 
      />
    </Stack>
  );
}