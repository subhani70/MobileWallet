import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../contexts/ThemeContext';
import { getSelectedNetwork } from '../services/networkService';
import { addCustomToken } from '../services/tokenService';
import { getTokenMetadata } from '../services/blockchainService';

export default function AddCustomTokenScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [form, setForm] = useState({
    name: '',
    symbol: '',
    contractAddress: '',
    decimals: '',
  });
  const [network, setNetwork] = useState(null);
  const [isLoadingNetwork, setIsLoadingNetwork] = useState(true);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    getSelectedNetwork()
      .then((selected) => setNetwork(selected))
      .catch((error) => {
        console.warn('Failed to load selected network', error);
        Alert.alert('Network error', 'Unable to load the active network. Please try again.');
        router.back();
      })
      .finally(() => setIsLoadingNetwork(false));
  }, [router]);

  const cleanAddress = (value) => value.trim().toLowerCase();

  const handleDetect = async () => {
    const address = cleanAddress(form.contractAddress);
    if (!address) {
      Alert.alert('Missing address', 'Enter a token contract address first.');
      return;
    }
    setIsDetecting(true);
    try {
      const metadata = await getTokenMetadata(address);
      setForm((prev) => ({
        ...prev,
        contractAddress: address,
        name: metadata.name,
        symbol: metadata.symbol,
        decimals: String(metadata.decimals),
      }));
    } catch (error) {
      Alert.alert('Lookup failed', error.message || 'Unable to fetch token details. Double-check the contract address.');
    } finally {
      setIsDetecting(false);
    }
  };

  const handleSubmit = async () => {
    if (!network?.id) {
      Alert.alert('Network missing', 'Select a network before importing tokens.');
      return;
    }
    const trimmed = {
      name: form.name.trim(),
      symbol: form.symbol.trim(),
      contractAddress: cleanAddress(form.contractAddress),
      decimals: form.decimals ? Number(form.decimals) : 18,
    };

    if (!trimmed.contractAddress || !trimmed.symbol || !trimmed.name) {
      Alert.alert('Incomplete token', 'Please detect token details or fill them in manually.');
      return;
    }

    setIsSaving(true);
    try {
      await addCustomToken(network.id, {
        address: trimmed.contractAddress,
        name: trimmed.name,
        symbol: trimmed.symbol,
        decimals: trimmed.decimals,
        chainId: network.chainId,
      });
      Alert.alert('Token added', `${trimmed.symbol} is now available in your wallet.`, [
        { text: 'Done', onPress: () => router.back() },
      ]);
    } catch (error) {
      Alert.alert('Unable to add token', error.message || 'Please check the details and try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <TouchableOpacity style={[styles.backButton, { borderColor: theme.border }]} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Add Custom Token</Text>
          <View style={{ width: 44 }} />
        </View>

        {isLoadingNetwork ? (
          <View style={styles.loader}>
            <ActivityIndicator color={theme.primary} />
            <Text style={{ color: theme.textSecondary, marginTop: 12 }}>Loading active network…</Text>
          </View>
        ) : (
          <Text style={[styles.helper, { color: theme.textSecondary }]}>
            Connected to {network?.name || 'Unknown network'} ({network?.chainId || 'N/A'}). Import ERC-20 tokens by
            entering their contract address.
          </Text>
        )}

        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Token Name</Text>
          <TextInput
            style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.surface }]}
            placeholder="Volt Governance Token"
            placeholderTextColor={theme.textTertiary}
            value={form.name}
            onChangeText={(value) => handleChange('name', value)}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Symbol</Text>
          <TextInput
            style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.surface }]}
            placeholder="VGT"
            placeholderTextColor={theme.textTertiary}
            autoCapitalize="characters"
            value={form.symbol}
            onChangeText={(value) => handleChange('symbol', value)}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Contract Address</Text>
          <TextInput
            style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.surface }]}
            placeholder="0x0000..."
            placeholderTextColor={theme.textTertiary}
            autoCapitalize="none"
            value={form.contractAddress}
            onChangeText={(value) => handleChange('contractAddress', value)}
          />
          <TouchableOpacity style={[styles.detectButton, { borderColor: theme.border }]} onPress={handleDetect} disabled={isDetecting || isLoadingNetwork}>
            {isDetecting ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <>
                <Ionicons name="search" size={16} color={theme.primary} />
                <Text style={[styles.detectButtonText, { color: theme.primary }]}>Detect Token</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Decimals</Text>
          <TextInput
            style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.surface }]}
            placeholder="18"
            placeholderTextColor={theme.textTertiary}
            keyboardType="numeric"
            value={form.decimals}
            onChangeText={(value) => handleChange('decimals', value)}
          />
        </View>

        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: theme.primary }]}
          onPress={handleSubmit}
          disabled={isSaving || isLoadingNetwork}
        >
          {isSaving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>Add Token</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
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
  loader: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 12,
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
  helper: {
    fontSize: 14,
    marginBottom: 24,
  },
  fieldGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  detectButton: {
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  detectButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  submitButton: {
    marginTop: 16,
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: 'center',
  },
  submitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

