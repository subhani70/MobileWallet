import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  Switch,
  RefreshControl,
  Animated,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../contexts/ThemeContext';
import { getVwBalance, sendVw, getTokenBalance, sendToken } from '../../services/blockchainService';
import { getWalletInfo } from '../../services/didManager';
import { Send as SendIcon } from 'lucide-react-native';

export default function TransactionsTab() {
  const { theme } = useTheme();
  
  const [vwBalance, setVwBalance] = useState('0');
  const [voltBalance, setVoltBalance] = useState('0');
  const [address, setAddress] = useState('');
  
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [isSendingToken, setIsSendingToken] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingBalance, setIsFetchingBalance] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isFocused, setIsFocused] = useState(true);
  const pollIntervalRef = useRef(null);
  const previousVwBalanceRef = useRef('0');
  const previousVoltBalanceRef = useRef('0');
  const isInitialLoadRef = useRef(true);
  const suppressNotificationsRef = useRef(false);
  const highlightAnimation = useRef(new Animated.Value(0)).current;

  // Function to show received funds notification
  const showReceivedNotification = useCallback((amount, asset) => {
    // Haptic feedback
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    
    // Show alert
    Alert.alert(
      '💰 Funds Received!',
      `You received ${parseFloat(amount).toFixed(asset === 'VW' ? 4 : 2)} ${asset}`,
      [{ text: 'OK' }]
    );

    // Highlight animation
    Animated.sequence([
      Animated.timing(highlightAnimation, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(highlightAnimation, {
        toValue: 0,
        duration: 700,
        useNativeDriver: false,
      }),
    ]).start();
  }, [highlightAnimation]);

  const loadWalletData = useCallback(async (silent = false) => {
    if (!silent) {
      setIsFetchingBalance(true);
    }
    try {
      const info = await getWalletInfo();
      if (info && info.address) {
        setAddress(info.address);
        const [vwBal, voltBal] = await Promise.all([
          getVwBalance(), // Get native VW balance from Geth network
          getTokenBalance('VOLT')
        ]);

        // Check for balance increases (only after initial load and not suppressed)
        if (!isInitialLoadRef.current && !suppressNotificationsRef.current) {
          const prevVw = parseFloat(previousVwBalanceRef.current) || 0;
          const prevVolt = parseFloat(previousVoltBalanceRef.current) || 0;
          const newVw = parseFloat(vwBal) || 0;
          const newVolt = parseFloat(voltBal) || 0;

          // Check if VW balance increased
          if (newVw > prevVw + 0.0001) { // Small threshold to avoid floating point issues
            const received = (newVw - prevVw).toFixed(4);
            showReceivedNotification(received, 'VW');
          }

          // Check if VOLT balance increased
          if (newVolt > prevVolt + 0.01) { // Small threshold for tokens
            const received = (newVolt - prevVolt).toFixed(2);
            showReceivedNotification(received, 'VOLT');
          }
        } else if (isInitialLoadRef.current) {
          // Mark initial load as complete
          isInitialLoadRef.current = false;
        }

        // Update balances and previous balances
        setVwBalance(vwBal);
        setVoltBalance(voltBal);
        previousVwBalanceRef.current = vwBal;
        previousVoltBalanceRef.current = voltBal;
      }
    } catch (error) {
      console.error('Failed to load wallet data:', error);
    } finally {
      setIsFetchingBalance(false);
      setRefreshing(false);
    }
  }, [showReceivedNotification]);

  // Auto-refresh when tab is focused
  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      // Reset initial load flag when tab gains focus
      isInitialLoadRef.current = true;
      loadWalletData();
      return () => {
        setIsFocused(false);
      };
    }, [loadWalletData])
  );

  // Polling mechanism - check balances every 10 seconds when tab is focused
  useEffect(() => {
    if (isFocused) {
      // Clear any existing interval
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      
      // Set up polling every 10 seconds
      pollIntervalRef.current = setInterval(() => {
        loadWalletData(true); // Silent refresh (no loading indicator)
      }, 10000); // 10 seconds
    } else {
      // Clear interval when tab loses focus
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }

    // Cleanup on unmount
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [isFocused, loadWalletData]);

  // Pull-to-refresh handler
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadWalletData();
  }, [loadWalletData]);

  const handleSend = async () => {
    if (!recipient || !amount) {
      Alert.alert('Missing Info', 'Please enter a recipient address and an amount.');
      return;
    }

    setIsLoading(true);
    const asset = isSendingToken ? 'VOLT' : 'VW';
    Alert.alert(
      'Confirm Transaction',
      `Are you sure you want to send ${amount} ${asset} to ${recipient}?`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => setIsLoading(false) },
        {
          text: 'Send',
          onPress: async () => {
            let result;
            if (isSendingToken) {
              result = await sendToken('VOLT', recipient, amount);
            } else {
              result = await sendVw(recipient, amount); // Send native VW currency
            }
            setIsLoading(false);

            if (result.success) {
              Alert.alert('Success!', `Transaction confirmed in block ${result.receipt.blockNumber}`);
              setRecipient('');
              setAmount('');
              // Suppress notifications temporarily after sending to prevent false "received" alerts
              suppressNotificationsRef.current = true;
              // Refresh balances after a short delay
              setTimeout(() => {
                loadWalletData().then(() => {
                  // Re-enable notifications after balance update
                  setTimeout(() => {
                    suppressNotificationsRef.current = false;
                  }, 1000);
                });
              }, 2000); // Wait 2 seconds for transaction to be reflected
            } else {
              Alert.alert('Transaction Failed', result.error);
            }
          },
        },
      ]
    );
  };

  const assetToSend = isSendingToken ? 'VOLT' : 'VW';

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
      >
        <Text style={[styles.headerTitle, { color: theme.text }]}>Transactions</Text>
        
        <View style={[styles.balanceCard, { backgroundColor: theme.surface }]}>
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: theme.primary,
                opacity: highlightAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0.2],
                }),
                borderRadius: 16,
              }
            ]}
          />
          <Text style={[styles.balanceLabel, { color: theme.textSecondary }]}>Your Balances</Text>
          {isFetchingBalance ? (
            <ActivityIndicator color={theme.primary} style={{ marginVertical: 20 }} />
          ) : (
            <>
              <View style={styles.balanceRow}>
                <Text style={[styles.balanceAmount, { color: theme.text }]}>{parseFloat(vwBalance).toFixed(4)}</Text>
                <Text style={[styles.balanceSymbol, { color: theme.textSecondary }]}>VW</Text>
              </View>
              <View style={styles.balanceRow}>
                <Text style={[styles.balanceAmount, { color: theme.text }]}>{parseFloat(voltBalance).toFixed(2)}</Text>
                <Text style={[styles.balanceSymbol, { color: theme.textSecondary }]}>VOLT</Text>
              </View>
            </>
          )}
          <Text style={[styles.address, { color: theme.textTertiary }]} numberOfLines={1}>{address}</Text>
        </View>

        <View style={[styles.sendCard, { backgroundColor: theme.surface }]}>
          <View style={styles.sendHeader}>
            <Text style={[styles.sendTitle, { color: theme.text }]}>Send</Text>
            <View style={styles.toggleContainer}>
              <Text style={[styles.toggleLabel, { color: !isSendingToken ? theme.primary : theme.textTertiary }]}>VW</Text>
              <Switch
                trackColor={{ false: theme.primaryLight, true: theme.accent }}
                thumbColor={"#FFFFFF"}
                onValueChange={() => setIsSendingToken(prev => !prev)}
                value={isSendingToken}
              />
              <Text style={[styles.toggleLabel, { color: isSendingToken ? theme.accent : theme.textTertiary }]}>VOLT</Text>
            </View>
          </View>
          
          <TextInput
            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
            placeholder="Recipient Address (0x...)"
            placeholderTextColor={theme.textTertiary}
            value={recipient}
            onChangeText={setRecipient}
            autoCapitalize="none"
          />
          <TextInput
            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
            placeholder={`Amount in ${assetToSend}`}
            placeholderTextColor={theme.textTertiary}
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
          />
          <TouchableOpacity
            style={[styles.sendButton, { backgroundColor: isSendingToken ? theme.accent : theme.primary }]}
            onPress={handleSend}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <SendIcon color="#FFFFFF" size={18} />
                <Text style={styles.sendButtonText}>Send {assetToSend}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', marginBottom: 20, paddingTop: 40 },
  balanceCard: { padding: 20, borderRadius: 16, marginBottom: 24, gap: 16, overflow: 'hidden', position: 'relative' },
  balanceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, zIndex: 1 },
  balanceAmount: { fontSize: 32, fontWeight: 'bold', lineHeight: 36, zIndex: 1 },
  balanceSymbol: { fontSize: 16, paddingBottom: 4, fontWeight: '600', zIndex: 1 },
  balanceLabel: { fontSize: 16, fontWeight: '600', zIndex: 1 },
  address: { fontSize: 12, marginTop: 8, fontFamily: 'monospace', zIndex: 1 },
  sendCard: { padding: 20, borderRadius: 16 },
  sendHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sendTitle: { fontSize: 20, fontWeight: 'bold' },
  toggleContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggleLabel: { fontSize: 14, fontWeight: '600' },
  input: { height: 50, borderWidth: 1, borderRadius: 10, paddingHorizontal: 15, fontSize: 16, marginBottom: 12 },
  sendButton: { height: 50, borderRadius: 10, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 8 },
  sendButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
});