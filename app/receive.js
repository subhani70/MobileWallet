import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../contexts/ThemeContext';
import * as accountManager from '../services/accountManager';

export default function ReceiveScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [address, setAddress] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const account = await accountManager.getActiveAccount();
        setAddress(account?.address || '');
      } catch (error) {
        console.warn('Failed to load address', error);
      }
    };
    load();
  }, []);

  const handleCopy = async () => {
    if (!address) return;
    await Clipboard.setStringAsync(address);
    Alert.alert('Copied', 'Wallet address copied to clipboard.');
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity style={[styles.backButton, { borderColor: theme.border }]} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Receive</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={[styles.card, { borderColor: theme.border, backgroundColor: theme.surface }]}>
          <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>Wallet Address</Text>
          <Text style={[styles.address, { color: theme.text }]} selectable>
            {address || 'Loading...'}
          </Text>
          <TouchableOpacity style={[styles.copyButton, { backgroundColor: theme.primary }]} onPress={handleCopy} disabled={!address}>
            <Ionicons name="copy" size={18} color="#fff" />
            <Text style={styles.copyText}>Copy address</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.instructions, { backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}>
          <Ionicons name="information-circle-outline" size={20} color={theme.primary} />
          <Text style={[styles.instructionsText, { color: theme.textSecondary }]}>
            Share this address to receive VW or VOLT tokens. Only send assets on supported networks to avoid loss of funds.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  header: {
    paddingTop: 56,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  card: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 20,
    marginTop: 12,
  },
  cardLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  address: {
    fontFamily: 'monospace',
    fontSize: 16,
    marginBottom: 16,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    paddingVertical: 12,
  },
  copyText: {
    color: '#fff',
    fontWeight: '700',
  },
  instructions: {
    marginTop: 24,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  instructionsText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});

