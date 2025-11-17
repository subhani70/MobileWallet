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
import * as accountManager from '../../services/accountManager';
import { Send as SendIcon, User, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';

export default function TransactionsTab() {
  const { theme, isDark } = useTheme();
  
  const [vwBalance, setVwBalance] = useState('0');
  const [voltBalance, setVoltBalance] = useState('0');
  const [address, setAddress] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountIndex, setAccountIndex] = useState(0);
  const [accounts, setAccounts] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  
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
      // Use active account from multi-account system
      const activeAccount = await accountManager.getActiveAccount();
      let currentAddress = null;
      let currentAccountName = '';
      
      if (activeAccount) {
        currentAddress = activeAccount.address;
        currentAccountName = activeAccount.label || `Account ${activeAccount.index + 1}`;
        const newIndex = activeAccount.index;
        setAccountIndex(newIndex);
        console.log('Active account index set to:', newIndex);
      } else {
        // Fallback to legacy method
        const info = await getWalletInfo();
        if (info && info.address) {
          currentAddress = info.address;
          currentAccountName = info.label || 'Main Account';
        }
      }
      
      // Load all accounts for switcher
      const allAccounts = await accountManager.getAllAccounts();
      setAccounts(allAccounts);
      
      if (currentAddress) {
        setAddress(currentAddress);
        setAccountName(currentAccountName);
        const [vwBal, voltBal] = await Promise.all([
          getVwBalance(), // Get native VW balance from Geth network (uses active account)
          getTokenBalance('VOLT') // Get token balance (uses active account)
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

  const handleSwitchAccount = async (newAccountIndex) => {
    try {
      console.log('Switching to account:', newAccountIndex);
      
      // Suppress notifications during account switch
      suppressNotificationsRef.current = true;
      
      // Reset balance tracking for new account
      previousVwBalanceRef.current = '0';
      previousVoltBalanceRef.current = '0';
      isInitialLoadRef.current = true;
      
      await accountManager.switchAccount(newAccountIndex);
      setDropdownOpen(false);
      
      // Force reload accounts and wallet data
      const allAccounts = await accountManager.getAllAccounts();
      setAccounts(allAccounts);
      await loadWalletData();
      
      // Re-enable notifications after a short delay
      setTimeout(() => {
        suppressNotificationsRef.current = false;
      }, 2000);
      
      console.log('Account switched successfully');
    } catch (error) {
      console.error('Switch account error:', error);
      suppressNotificationsRef.current = false;
      Alert.alert('Error', error.message || 'Failed to switch account');
    }
  };

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

  // Close dropdown when clicking outside
  useEffect(() => {
    if (dropdownOpen) {
      const timeout = setTimeout(() => {
        // Auto-close after 30 seconds (safety)
      }, 30000);
      return () => clearTimeout(timeout);
    }
  }, [dropdownOpen]);

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
        <View style={styles.headerSection}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Transactions</Text>
          {accountName && (
            <View style={styles.dropdownContainer}>
              <TouchableOpacity
                style={[styles.accountBadge, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={() => setDropdownOpen(!dropdownOpen)}
                onLongPress={async () => {
                  await Clipboard.setStringAsync(address);
                  Alert.alert('Copied!', 'Address copied to clipboard');
                }}
              >
                <User size={14} color={theme.primary} />
                <Text style={[styles.accountBadgeText, { color: theme.text }]} numberOfLines={1}>
                  {accountName}
                </Text>
                {dropdownOpen ? (
                  <ChevronUp size={12} color={theme.textTertiary} />
                ) : (
                  <ChevronDown size={12} color={theme.textTertiary} />
                )}
              </TouchableOpacity>
              
              {dropdownOpen && accounts.length > 0 && (
                <View 
                  style={[styles.dropdown, { backgroundColor: theme.surface, borderColor: theme.border }]}
                >
                  <ScrollView style={styles.dropdownList} nestedScrollEnabled>
                    {accounts.map((account, idx) => (
                      <TouchableOpacity
                        key={account.index}
                        style={[
                          styles.dropdownItem,
                          {
                            backgroundColor: account.index === accountIndex 
                              ? (isDark ? 'rgba(6, 182, 212, 0.15)' : 'rgba(6, 182, 212, 0.08)')
                              : 'transparent',
                            borderBottomWidth: idx < accounts.length - 1 ? 1 : 0,
                            borderBottomColor: theme.border,
                          },
                        ]}
                        onPress={async () => {
                          console.log('Account item pressed:', account.index);
                          if (account.index !== accountIndex) {
                            await handleSwitchAccount(account.index);
                          } else {
                            setDropdownOpen(false);
                          }
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={styles.dropdownItemLeft}>
                          {account.index === accountIndex && (
                            <Check size={14} color={theme.primary} />
                          )}
                          <View style={styles.dropdownItemInfo}>
                            <Text style={[styles.dropdownItemLabel, { color: theme.text }]}>
                              {account.label}
                            </Text>
                            <Text style={[styles.dropdownItemAddress, { color: theme.textTertiary }]} numberOfLines={1}>
                              {`${account.address.substring(0, 6)}...${account.address.substring(38)}`}
                            </Text>
                          </View>
                        </View>
                        {account.index === accountIndex && (
                          <View style={[styles.activeBadgeSmall, { backgroundColor: theme.primary }]}>
                            <Text style={styles.activeBadgeSmallText}>Active</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          )}
        </View>
        
        <View style={[styles.balanceCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: theme.primary,
                opacity: highlightAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0.15],
                }),
                borderRadius: 18,
              }
            ]}
          />
          <View style={styles.balanceHeader}>
            <Text style={[styles.balanceLabel, { color: theme.textSecondary }]}>Your Balances</Text>
            {accountName && (
              <View style={[styles.accountIndicator, { backgroundColor: theme.primary + '15' }]}>
                <Check size={12} color={theme.primary} />
                <Text style={[styles.accountIndicatorText, { color: theme.primary }]} numberOfLines={1}>
                  {accountName}
                </Text>
              </View>
            )}
          </View>
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
          <TouchableOpacity
            onPress={async () => {
              await Clipboard.setStringAsync(address);
              Alert.alert('Copied!', 'Address copied to clipboard');
            }}
            style={[styles.addressContainer, { borderTopColor: theme.border }]}
          >
            <Text style={[styles.address, { color: theme.textTertiary }]} numberOfLines={1}>
              {address ? `${address.substring(0, 6)}...${address.substring(38)}` : 'Loading...'}
            </Text>
            <Copy size={14} color={theme.textTertiary} />
          </TouchableOpacity>
        </View>

        <View style={[styles.sendCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
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
  scrollContent: { padding: 20, paddingBottom: 40 },
  headerSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingTop: 40,
    gap: 12,
  },
  headerTitle: { 
    fontSize: 28, 
    fontWeight: 'bold', 
    flex: 1,
  },
  dropdownContainer: {
    position: 'relative',
    maxWidth: '45%',
    zIndex: 1000,
    elevation: 1000,
  },
  accountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    width: '100%',
  },
  accountBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    maxHeight: 300,
    minWidth: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 1001,
    zIndex: 1001,
  },
  dropdownList: {
    maxHeight: 300,
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    paddingHorizontal: 16,
  },
  dropdownItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  dropdownItemInfo: {
    flex: 1,
  },
  dropdownItemLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  dropdownItemAddress: {
    fontSize: 11,
    fontFamily: 'monospace',
  },
  activeBadgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  activeBadgeSmallText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  balanceCard: { 
    padding: 20, 
    borderRadius: 18, 
    marginBottom: 24, 
    gap: 16, 
    overflow: 'hidden', 
    position: 'relative',
    borderWidth: 1,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 1,
  },
  balanceRow: { 
    flexDirection: 'row', 
    alignItems: 'flex-end', 
    gap: 8, 
    zIndex: 1 
  },
  balanceAmount: { 
    fontSize: 32, 
    fontWeight: 'bold', 
    lineHeight: 36, 
    zIndex: 1 
  },
  balanceSymbol: { 
    fontSize: 16, 
    paddingBottom: 4, 
    fontWeight: '600', 
    zIndex: 1 
  },
  balanceLabel: { 
    fontSize: 16, 
    fontWeight: '600', 
    zIndex: 1 
  },
  accountIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  accountIndicatorText: {
    fontSize: 11,
    fontWeight: '600',
    maxWidth: 100,
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    zIndex: 1,
  },
  address: { 
    fontSize: 12, 
    fontFamily: 'monospace', 
    flex: 1,
  },
  sendCard: { 
    padding: 20, 
    borderRadius: 18,
    borderWidth: 1,
  },
  sendHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 16 
  },
  sendTitle: { 
    fontSize: 20, 
    fontWeight: 'bold' 
  },
  toggleContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8 
  },
  toggleLabel: { 
    fontSize: 14, 
    fontWeight: '600' 
  },
  input: { 
    height: 50, 
    borderWidth: 1, 
    borderRadius: 12, 
    paddingHorizontal: 15, 
    fontSize: 16, 
    marginBottom: 12 
  },
  sendButton: { 
    height: 50, 
    borderRadius: 12, 
    justifyContent: 'center', 
    alignItems: 'center', 
    flexDirection: 'row', 
    gap: 8 
  },
  sendButtonText: { 
    color: '#FFFFFF', 
    fontSize: 18, 
    fontWeight: 'bold' 
  },
});