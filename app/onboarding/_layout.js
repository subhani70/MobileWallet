// app/onboarding/_layout.js
import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="did-creation" />
      <Stack.Screen name="did-success" />
      <Stack.Screen name="biometric-setup" />
      <Stack.Screen name="pin-setup" />
      <Stack.Screen name="recovery-phrase-backup" />
    </Stack>
  );
}