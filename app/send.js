import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { sendVw, sendTokenByAddress } from '../services/blockchainService';
import * as accountManager from '../services/accountManager';
import { getSelectedNetwork } from '../services/networkService';
import { getTokensForNetwork } from '../services/tokenService';

export default function SendScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [account, setAccount] = useState(null);
  const [network, setNetwork] = useState(null);
  const [assets, setAssets] = useState([]);
  const [selectedAsset, setSelectedAsset] = useState(null);

  const loadAccount = useCallback(async () => {
    try {
      const active = await accountManager.getActiveAccount();
      setAccount(active);
    } catch (error) {
      console.warn('Failed to load account', error);
    }
  }, []);

  const loadNetwork = useCallback(async () => {
    try {
      const selected = await getSelectedNetwork();
      setNetwork(selected);
    } catch (error) {
      console.warn('Failed to load network', error);
    }
  }, []);

  const syncAssets = useCallback((networkData, tokens = []) => {
    const nativeAsset = {
      id: 'native',
      type: 'native',
      symbol: networkData?.symbol || 'VW',
      name: networkData?.name || 'Native Asset',
      decimals: 18,
    };
    const list = [
      nativeAsset,
      ...tokens.map((token) => ({
        ...token,
        id: token.address,
        type: 'erc20',
      })),
    ];
    setAssets(list);
    setSelectedAsset((prev) => list.find((asset) => asset.id === prev?.id) || nativeAsset);
  }, []);

  const refreshTokens = useCallback(async () => {
    if (!network?.id) {
      syncAssets(network, []);
      return;
    }
    try {
      const stored = await getTokensForNetwork(network.id);
      syncAssets(network, stored);
    } catch (error) {
      console.warn('Failed to load custom tokens', error);
      syncAssets(network, []);
    }
  }, [network, syncAssets]);

  useEffect(() => {
    loadAccount();
    loadNetwork();
  }, [loadAccount, loadNetwork]);

  useEffect(() => {
    refreshTokens();
  }, [refreshTokens]);

  useFocusEffect(
    useCallback(() => {
      loadAccount();
      loadNetwork();
      refreshTokens();
    }, [loadAccount, loadNetwork, refreshTokens])
  );

  const executeSend = useCallback(async () => {
    if (!selectedAsset) return;
    setIsSubmitting(true);
    try {
      const result =
        selectedAsset.type === 'erc20'
          ? await sendTokenByAddress(selectedAsset.address, selectedAsset.decimals || 18, recipient, amount)
          : await sendVw(recipient, amount);
      if (result.success) {
        Alert.alert('Success', `Transaction confirmed in block ${result.receipt.blockNumber}`, [
          {
            text: 'Done',
            onPress: () => router.back(),
          },
        ]);
        setRecipient('');
        setAmount('');
      } else {
        Alert.alert('Transaction Failed', result.error || 'Unable to send funds.');
      }
    } catch (error) {
      Alert.alert('Error', error.message || 'Unable to send transaction.');
    } finally {
      setIsSubmitting(false);
    }
  }, [amount, recipient, router, selectedAsset]);

  const nativeSymbol = network?.symbol || 'VW';
  const assetSymbol = selectedAsset?.symbol || nativeSymbol;

  const handleSubmit = () => {
    if (!recipient || !amount) {
      Alert.alert('Missing info', 'Enter a recipient address and an amount.');
      return;
    }
    Alert.alert('Confirm transaction', `Send ${amount} ${assetSymbol} to ${recipient}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Send',
        onPress: () => executeSend(),
      },
    ]);
  };

  const chainIdLabel = network?.chainId ? `Chain ID ${network.chainId}` : 'Custom network';

  const shortAddress =
    account?.address && account.address.length > 10
      ? `${account.address.substring(0, 10)}...${account.address.substring(account.address.length - 8)}`
      : account?.address;

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
          <Text style={[styles.headerTitle, { color: theme.text }]}>Send Assets</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={[styles.accountCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.accountLabel, { color: theme.textSecondary }]}>From</Text>
          <Text style={[styles.accountName, { color: theme.text }]} numberOfLines={1}>
            {account?.label || 'Active Account'}
          </Text>
          <Text style={[styles.accountAddress, { color: theme.textTertiary }]} numberOfLines={1}>
            {shortAddress || 'Loading address...'}
          </Text>
          <View style={[styles.networkChip, { backgroundColor: theme.surfaceSecondary || theme.surface }]}>
            <Ionicons name="globe-outline" size={14} color={theme.primary} />
            <Text style={[styles.networkChipText, { color: theme.text }]}>
              {network?.name || 'Voltus Mainnet'} · {chainIdLabel}
            </Text>
          </View>
        </View>

        <View style={[styles.assetSelector, { borderColor: theme.border, backgroundColor: theme.surface }]}>
          <Text style={[styles.label, { color: theme.textSecondary, marginBottom: 12 }]}>Asset</Text>
          <View style={styles.assetChipRow}>
            {assets.map((asset) => {
              const isActive = asset.id === selectedAsset?.id;
              return (
                <TouchableOpacity
                  key={asset.id}
                  style={[
                    styles.assetChip,
                    {
                      borderColor: isActive ? theme.primary : theme.border,
                      backgroundColor: isActive ? (theme.primary + '15') : (theme.surfaceSecondary || theme.surface),
                    },
                  ]}
                  onPress={() => setSelectedAsset(asset)}
                >
                  <Text style={[styles.assetChipSymbol, { color: theme.text }]}>{asset.symbol}</Text>
                  <Text style={[styles.assetChipLabel, { color: theme.textTertiary }]} numberOfLines={1}>
                    {asset.type === 'native' ? 'Native' : asset.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity
            style={[styles.addTokenButton, { borderColor: theme.border }]}
            onPress={() => router.push('/add-custom-token')}
          >
            <Ionicons name="add-circle-outline" size={18} color={theme.primary} />
            <Text style={[styles.addTokenText, { color: theme.primary }]}>Import Token</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Recipient Address</Text>
          <TextInput
            style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.surface }]}
            placeholder="0x1234..."
            placeholderTextColor={theme.textTertiary}
            autoCapitalize="none"
            value={recipient}
            onChangeText={setRecipient}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Amount ({assetSymbol})</Text>
          <TextInput
            style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.surface }]}
            placeholder="0.00"
            placeholderTextColor={theme.textTertiary}
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={setAmount}
          />
        </View>

        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: theme.primary }]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="arrow-up-circle" size={20} color="#fff" />
              <Text style={styles.submitText}>Send {assetSymbol}</Text>
            </>
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
  accountCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
  },
  accountLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  accountName: {
    fontSize: 18,
    fontWeight: '700',
  },
  accountAddress: {
    fontSize: 13,
    marginTop: 4,
  },
  networkChip: {
    marginTop: 12,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  networkChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  assetSelector: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
  },
  assetChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  assetChip: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 100,
  },
  assetChipSymbol: {
    fontSize: 14,
    fontWeight: '700',
  },
  assetChipLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  addTokenButton: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addTokenText: {
    fontSize: 14,
    fontWeight: '600',
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
  submitButton: {
    marginTop: 10,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

