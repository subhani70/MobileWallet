import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Animated,
  StatusBar,
  Modal,
  TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getVwBalance, getTokenBalanceByAddress } from '../../services/blockchainService';
import { getWalletInfo } from '../../services/didManager';
import * as accountManager from '../../services/accountManager';
import { Copy, Check, ChevronDown, ChevronUp } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { DEFAULT_NETWORK, NETWORK_STORAGE_KEY } from '../../constants/networks';
import { getTokensForNetwork } from '../../services/tokenService';
import { getActivityForAccount } from '../../services/activityService';

export default function TransactionsTab() {
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [vwBalance, setVwBalance] = useState('0');
  const [address, setAddress] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountIndex, setAccountIndex] = useState(0);
  const [accounts, setAccounts] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState(DEFAULT_NETWORK);
  const [customTokens, setCustomTokens] = useState([]);
  const customTokensRef = useRef([]);
  const [tokenBalances, setTokenBalances] = useState({});
  const [activityEntries, setActivityEntries] = useState([]);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);
  const [isFetchingBalance, setIsFetchingBalance] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importPrivateKey, setImportPrivateKey] = useState('');
  const [importAccountLabel, setImportAccountLabel] = useState('');
  const [isImportingAccount, setIsImportingAccount] = useState(false);
  const [importError, setImportError] = useState('');
  const previousVwBalanceRef = useRef('0');
  const isInitialLoadRef = useRef(true);
  const suppressNotificationsRef = useRef(false);
  const highlightAnimation = useRef(new Animated.Value(0)).current;
  const [toastConfig, setToastConfig] = useState(null);
  const toastAnimation = useRef(new Animated.Value(0)).current;
  const toastTimeoutRef = useRef(null);
  const toastTranslateY = useMemo(
    () =>
      toastAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: [-80, 0],
      }),
    [toastAnimation]
  );

  const hideToast = useCallback(() => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = null;
    }
    Animated.timing(toastAnimation, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setToastConfig(null);
      }
    });
  }, [toastAnimation]);

  const presentAlert = useCallback(
    ({ title, message, icon = null, type = 'info', duration = 3600 } = {}) => {
      if (!title && !message) return;
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
        toastTimeoutRef.current = null;
      }
      setToastConfig({ title, message, icon, type });
      Animated.timing(toastAnimation, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }).start();
      toastTimeoutRef.current = setTimeout(() => {
        hideToast();
      }, duration);
    },
    [hideToast, toastAnimation]
  );

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const loadSelectedNetwork = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(NETWORK_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.id) {
          setSelectedNetwork(parsed);
          return;
        }
      }
      setSelectedNetwork(DEFAULT_NETWORK);
    } catch (error) {
      console.warn('Failed to load network selection', error);
      setSelectedNetwork(DEFAULT_NETWORK);
    }
  }, []);

  useEffect(() => {
    customTokensRef.current = customTokens;
  }, [customTokens]);

  const fetchTokenBalances = useCallback(
    async (tokensOverride) => {
      if (!selectedNetwork?.id) {
        setTokenBalances({});
        return;
      }
      const list = tokensOverride || customTokensRef.current;
      if (!list.length) {
        setTokenBalances({});
        return;
      }
      try {
        const entries = await Promise.all(
          list.map(async (token) => {
            const balance = await getTokenBalanceByAddress(token.address, token.decimals);
            return [token.address, balance];
          })
        );
        setTokenBalances(Object.fromEntries(entries));
      } catch (error) {
        console.warn('Failed to load token balances', error);
      }
    },
    [selectedNetwork?.id]
  );

  const loadCustomTokens = useCallback(async () => {
    if (!selectedNetwork?.id) {
      setCustomTokens([]);
      setTokenBalances({});
      return;
    }
    try {
      const stored = await getTokensForNetwork(selectedNetwork.id);
      const normalized = stored.map((token) => ({
        ...token,
        address: token.address?.toLowerCase() || token.address,
      }));
      const current = customTokensRef.current;
      const hasChange =
        normalized.length !== current.length ||
        normalized.some(
          (token, index) =>
            token.address !== current[index]?.address ||
            token.symbol !== current[index]?.symbol ||
            token.decimals !== current[index]?.decimals
        );
      if (hasChange) {
        setCustomTokens(normalized);
      }
      await fetchTokenBalances(normalized);
    } catch (error) {
      console.warn('Failed to load custom tokens', error);
      setCustomTokens([]);
      setTokenBalances({});
    }
  }, [selectedNetwork?.id, fetchTokenBalances]);

  useEffect(() => {
    loadCustomTokens();
  }, [loadCustomTokens]);

  const loadActivityLog = useCallback(async () => {
    if (!selectedNetwork?.id || !address) {
      setActivityEntries([]);
      return;
    }
    setIsLoadingActivity(true);
    try {
      const history = await getActivityForAccount({
        networkId: selectedNetwork.id,
        accountAddress: address,
        limit: 25,
      });
      setActivityEntries(history);
    } catch (error) {
      console.warn('Failed to load local activity log', error);
    } finally {
      setIsLoadingActivity(false);
    }
  }, [selectedNetwork?.id, address]);

  useEffect(() => {
    loadActivityLog();
  }, [loadActivityLog]);

  // Function to show received funds notification
  const showReceivedNotification = useCallback((amount, asset) => {
    // Haptic feedback
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    
    // Show in-app banner
    presentAlert({
      icon: '💰',
      title: 'Funds received',
      message: `You received ${parseFloat(amount).toFixed(asset === 'VW' ? 4 : 2)} ${asset}`,
      type: 'success',
    });

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
  }, [highlightAnimation, presentAlert]);

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
        const vwBal = await getVwBalance(); // Get native balance on selected network

        // Check for balance increases (only after initial load and not suppressed)
        if (!isInitialLoadRef.current && !suppressNotificationsRef.current) {
          const prevVw = parseFloat(previousVwBalanceRef.current) || 0;
          const newVw = parseFloat(vwBal) || 0;

          // Check if VW balance increased
          if (newVw > prevVw + 0.0001) { // Small threshold to avoid floating point issues
            const received = (newVw - prevVw).toFixed(4);
            showReceivedNotification(received, 'VW');
          }
        } else if (isInitialLoadRef.current) {
          // Mark initial load as complete
          isInitialLoadRef.current = false;
        }

        // Update balances and previous balances
        setVwBalance(vwBal);
        previousVwBalanceRef.current = vwBal;
        await fetchTokenBalances();
      }
    } catch (error) {
      console.error('Failed to load wallet data:', error);
    } finally {
      setIsFetchingBalance(false);
    }
  }, [showReceivedNotification, fetchTokenBalances]);

  // Refresh when tab is focused
  useFocusEffect(
    useCallback(() => {
      isInitialLoadRef.current = true;
      loadWalletData();
      loadSelectedNetwork();
      loadCustomTokens();
      loadActivityLog();
    }, [loadWalletData, loadSelectedNetwork, loadCustomTokens, loadActivityLog])
  );

  // Pull-to-refresh handler
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    (async () => {
      try {
        await loadWalletData();
        await loadSelectedNetwork();
        await loadCustomTokens();
        await loadActivityLog();
      } finally {
        setRefreshing(false);
      }
    })();
  }, [loadWalletData, loadSelectedNetwork, loadCustomTokens, loadActivityLog]);

  const handleCopyAddress = useCallback(
    async (value) => {
      if (!value) return;
      try {
        await Clipboard.setStringAsync(value);
        presentAlert({
          icon: '📋',
          title: 'Address copied',
          message: 'Wallet address copied to clipboard.',
          type: 'info',
        });
      } catch (error) {
        console.warn('Failed to copy address', error);
      }
    },
    [presentAlert]
  );

  const handleSwitchAccount = async (newAccountIndex) => {
    try {
      console.log('Switching to account:', newAccountIndex);
      
      // Suppress notifications during account switch
      suppressNotificationsRef.current = true;
      
      // Reset balance tracking for new account
      previousVwBalanceRef.current = '0';
      isInitialLoadRef.current = true;
      
      await accountManager.switchAccount(newAccountIndex);
      setDropdownOpen(false);
      
      // Force reload accounts and wallet data
      const allAccounts = await accountManager.getAllAccounts();
      setAccounts(allAccounts);
      await loadWalletData();
      await loadCustomTokens();
      await loadActivityLog();
      
      // Re-enable notifications after a short delay
      setTimeout(() => {
        suppressNotificationsRef.current = false;
      }, 2000);
      
      console.log('Account switched successfully');
    } catch (error) {
      console.error('Switch account error:', error);
      suppressNotificationsRef.current = false;
      presentAlert({
        icon: '⚠️',
        title: 'Unable to switch',
        message: error.message || 'Failed to switch account.',
        type: 'error',
      });
    }
  };

  const openImportModal = () => {
    setImportPrivateKey('');
    setImportAccountLabel('');
    setImportError('');
    setImportModalVisible(true);
  };

  const closeImportModal = () => {
    if (!isImportingAccount) {
      setImportModalVisible(false);
    }
  };

  const handleImportAccount = async () => {
    if (!importPrivateKey.trim()) {
      setImportError('Enter the private key to continue');
      return;
    }
    setImportError('');
    setIsImportingAccount(true);
    try {
      await accountManager.importAccountFromPrivateKey(importPrivateKey.trim(), importAccountLabel.trim() || null);
      const allAccounts = await accountManager.getAllAccounts();
      setAccounts(allAccounts);
      await loadWalletData(true);
      await loadCustomTokens();
      await loadActivityLog();
      setDropdownOpen(false);
      setImportModalVisible(false);
      presentAlert({
        icon: '✅',
        title: 'Account imported',
        message: 'The account has been added and set as active.',
        type: 'success',
      });
    } catch (error) {
      presentAlert({
        icon: '❌',
        title: 'Import failed',
        message: error.message || 'Unable to import account. Check the private key and try again.',
        type: 'error',
      });
    } finally {
      setIsImportingAccount(false);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    if (dropdownOpen) {
      const timeout = setTimeout(() => {
        // Auto-close after 30 seconds (safety)
      }, 30000);
      return () => clearTimeout(timeout);
    }
  }, [dropdownOpen]);

  const nativeSymbol = selectedNetwork?.symbol || 'VW';

  const totalBalanceDisplay = useMemo(() => {
    const native = parseFloat(vwBalance || '0') || 0;
    if (!Number.isFinite(native)) {
      return `0.00 ${nativeSymbol}`;
    }
    return `${native.toFixed(4)} ${nativeSymbol}`;
  }, [vwBalance, nativeSymbol]);

  const formattedVw = useMemo(() => {
    const value = parseFloat(vwBalance || '0') || 0;
    return value.toFixed(4);
  }, [vwBalance]);

  const assetRows = useMemo(() => {
    const rows = [
      {
        id: 'native',
        symbol: nativeSymbol,
        name: selectedNetwork?.name || 'Native Asset',
        value: `${formattedVw} ${nativeSymbol}`,
        logo: '⟠',
        isCustom: false,
      },
    ];
    customTokens.forEach((token) => {
      const balance = tokenBalances[token.address] ?? '0';
      rows.push({
        id: token.address,
        symbol: token.symbol,
        name: token.name,
        value: `${balance} ${token.symbol}`,
        logo: token.logo || '◎',
        isCustom: true,
      });
    });
    return rows;
  }, [customTokens, tokenBalances, nativeSymbol, selectedNetwork?.name, formattedVw]);

  const toastThemes = useMemo(
    () => ({
      success: {
        background: isDark ? 'rgba(16,185,129,0.18)' : '#ECFDF5',
        border: isDark ? 'rgba(16,185,129,0.5)' : '#A7F3D0',
        iconBg: isDark ? 'rgba(16,185,129,0.35)' : '#D1FAE5',
        accent: '#10B981',
        title: theme.text,
        message: theme.textSecondary,
      },
      error: {
        background: isDark ? 'rgba(239,68,68,0.18)' : '#FEE2E2',
        border: isDark ? 'rgba(239,68,68,0.5)' : '#FECACA',
        iconBg: isDark ? 'rgba(239,68,68,0.35)' : '#FECACA',
        accent: '#EF4444',
        title: theme.text,
        message: theme.textSecondary,
      },
      warning: {
        background: isDark ? 'rgba(245,158,11,0.2)' : '#FEF3C7',
        border: isDark ? 'rgba(245,158,11,0.45)' : '#FDE68A',
        iconBg: isDark ? 'rgba(245,158,11,0.3)' : '#FDE68A',
        accent: '#F59E0B',
        title: theme.text,
        message: theme.textSecondary,
      },
      info: {
        background: isDark ? 'rgba(59,130,246,0.2)' : '#DBEAFE',
        border: isDark ? 'rgba(59,130,246,0.45)' : '#BFDBFE',
        iconBg: isDark ? 'rgba(59,130,246,0.35)' : '#BFDBFE',
        accent: '#3B82F6',
        title: theme.text,
        message: theme.textSecondary,
      },
    }),
    [isDark, theme.text, theme.textSecondary]
  );

  const activeToastTone = (toastConfig && toastThemes[toastConfig.type]) || toastThemes.info;

  const handleActivityPress = useCallback(
    async (entry) => {
      if (!entry?.txHash) return;
      try {
        await Clipboard.setStringAsync(entry.txHash);
        presentAlert({
          icon: '📋',
          title: 'Hash copied',
          message: 'Transaction hash copied to clipboard.',
          type: 'info',
        });
      } catch (error) {
        console.warn('Failed to copy tx hash', error);
      }
    },
    [presentAlert]
  );

  const truncatedValue = useCallback((value = '', start = 6, end = 4) => {
    if (!value || typeof value !== 'string') return 'N/A';
    if (value.length <= start + end) return value;
    return `${value.substring(0, start)}...${value.substring(value.length - end)}`;
  }, []);

  const statusStyles = useCallback(
    (status = 'confirmed') => {
      switch (status) {
        case 'failed':
          return { backgroundColor: 'rgba(239,68,68,0.15)', color: '#EF4444' };
        case 'pending':
          return { backgroundColor: 'rgba(245,158,11,0.15)', color: '#F59E0B' };
        default:
          return { backgroundColor: 'rgba(16,185,129,0.15)', color: '#10B981' };
      }
    },
    []
  );

  const activityHeaderNote =
    'Only wallet-initiated actions appear here. Incoming or third-party transactions stay hidden for privacy.';

  const formatActivityAmount = useCallback((value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return value || '0';
    }
    if (Math.abs(numeric) >= 1) {
      return numeric.toFixed(4).replace(/\.?0+$/, '');
    }
    return numeric.toPrecision(4).replace(/\.?0+$/, '');
  }, []);

  const actionButtons = [
    {
      key: 'send',
      label: 'Send',
      icon: 'arrow-up',
      color: '#10B981',
      onPress: () => router.push('/send'),
    },
    {
      key: 'receive',
      label: 'Receive',
      icon: 'arrow-down',
      color: '#3B82F6',
      onPress: () => router.push('/receive'),
    },
    {
      key: 'swap',
      label: 'Swap',
      icon: 'swap-horizontal',
      color: '#8B5CF6',
      onPress: () =>
        presentAlert({
          icon: '🚧',
          title: 'Swap coming soon',
          message: 'Swap will be available soon.',
          type: 'warning',
        }),
    },
    {
      key: 'buy',
      label: 'Buy',
      icon: 'card',
      color: '#F59E0B',
      onPress: () =>
        presentAlert({
          icon: '💳',
          title: 'Fiat on-ramps soon',
          message: 'Fiat purchase options are on the way.',
          type: 'info',
        }),
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {toastConfig && (
        <View pointerEvents="box-none" style={[styles.toastWrapper, { paddingTop: insets.top + 12 }]}>
          <Animated.View
            style={[
              styles.toastContainer,
              {
                backgroundColor: activeToastTone.background,
                borderColor: activeToastTone.border,
                transform: [{ translateY: toastTranslateY }],
                opacity: toastAnimation,
              },
            ]}
            >
            <View style={styles.toastTextGroup}>
              {!!toastConfig.title && (
                <Text style={[styles.toastTitle, { color: activeToastTone.title }]} numberOfLines={1}>
                  {toastConfig.title}
                </Text>
              )}
              {!!toastConfig.message && (
                <Text style={[styles.toastMessage, { color: activeToastTone.message }]} numberOfLines={2}>
                  {toastConfig.message}
                </Text>
              )}
            </View>
            <TouchableOpacity style={styles.toastDismiss} onPress={hideToast} activeOpacity={0.7}>
              <Ionicons name="close" size={18} color={activeToastTone.accent} />
            </TouchableOpacity>
          </Animated.View>
        </View>
      )}
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <ScrollView
        style={styles.scrollView}
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
        <View style={styles.headerRegion}>
          <View style={[styles.header, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <TouchableOpacity
              style={[
                styles.accountSelector,
                { borderColor: theme.border, backgroundColor: theme.surfaceSecondary || theme.surface },
              ]}
              onPress={() => setDropdownOpen((prev) => !prev)}
              activeOpacity={0.85}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.accountName, { color: theme.text }]} numberOfLines={1}>
                  {accountName || 'Select account'}
                </Text>
                <Text style={[styles.accountAddress, { color: theme.textTertiary }]} numberOfLines={1}>
                  {address ? `${address.substring(0, 10)}...${address.substring(address.length - 6)}` : 'Tap to choose an account'}
                </Text>
                <Text style={[styles.accountMeta, { color: theme.textSecondary }]} numberOfLines={1}>
                  {selectedNetwork?.name ? `Network: ${selectedNetwork.name}` : 'No network selected'}
                </Text>
              </View>
              <Ionicons name={dropdownOpen ? 'chevron-up' : 'chevron-down'} size={18} color={theme.text} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.iconButton, { borderColor: theme.border }]}
              onPress={() => router.push('/tabs/scan')}
              activeOpacity={0.8}
            >
              <Ionicons name="scan-outline" size={22} color={theme.text} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconButton, { borderColor: theme.border }]}
              onPress={() => router.push('/manage-networks')}
              activeOpacity={0.8}
            >
              <Ionicons name="create-outline" size={22} color={theme.text} />
            </TouchableOpacity>
          </View>

          {dropdownOpen && accounts.length > 0 && (
            <View style={styles.dropdownWrapper}>
              <View style={[styles.dropdown, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <ScrollView style={styles.dropdownList} nestedScrollEnabled>
                  {accounts.map((account, idx) => (
                    <TouchableOpacity
                      key={account.index}
                      style={[
                        styles.dropdownItem,
                        {
                          backgroundColor:
                            account.index === accountIndex
                              ? isDark
                                ? 'rgba(16, 185, 129, 0.15)'
                                : 'rgba(16, 185, 129, 0.12)'
                              : 'transparent',
                          borderBottomWidth: idx < accounts.length - 1 ? 1 : 0,
                          borderBottomColor: theme.border,
                        },
                      ]}
                      onPress={async () => {
                        if (account.index !== accountIndex) {
                          await handleSwitchAccount(account.index);
                        } else {
                          setDropdownOpen(false);
                        }
                      }}
                      activeOpacity={0.8}
                    >
                      <View style={styles.dropdownItemLeft}>
                        {account.index === accountIndex && <Check size={14} color={theme.primary} />}
                        <View style={styles.dropdownItemInfo}>
                          <Text style={[styles.dropdownItemLabel, { color: theme.text }]}>{account.label}</Text>
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
                <TouchableOpacity
                  style={[styles.importButton, { borderTopColor: theme.border }]}
                  onPress={openImportModal}
                  activeOpacity={0.85}
                >
                  <Ionicons name="download-outline" size={18} color={theme.primary} />
                  <Text style={[styles.importButtonText, { color: theme.primary }]}>Import account with private key</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        <View style={[styles.balanceCard, { backgroundColor: theme.primary }]}>
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: '#FFFFFF20',
                opacity: highlightAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 1],
                }),
                borderRadius: 24,
              },
            ]}
          />
          <Text style={styles.balanceLabel}>Total Balance</Text>
          {isFetchingBalance ? (
            <ActivityIndicator color="#FFFFFF" style={{ marginVertical: 20 }} />
          ) : (
            <>
              <Text style={styles.balanceAmount}>{totalBalanceDisplay}</Text>
              <Text style={styles.balanceSubtext}>
                {assetRows.length} asset{assetRows.length === 1 ? '' : 's'} tracked
              </Text>
            </>
          )}
          <View style={styles.actionButtons}>
            {actionButtons.map((action) => (
              <TouchableOpacity key={action.key} style={styles.actionButton} onPress={action.onPress} activeOpacity={0.85}>
                <View style={[styles.actionIcon, { backgroundColor: action.color }]}>
                  <Ionicons name={action.icon} size={20} color="#fff" />
                </View>
                <Text style={styles.actionText}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.addressCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={() => handleCopyAddress(address)}
          disabled={!address}
        >
          <View>
            <Text style={[styles.addressLabel, { color: theme.textSecondary }]}>Wallet Address</Text>
            <Text style={[styles.addressValue, { color: theme.text }]} numberOfLines={1}>
              {address ? `${address.substring(0, 10)}...${address.substring(address.length - 8)}` : 'Loading...'}
            </Text>
          </View>
          <Copy size={18} color={theme.text} />
        </TouchableOpacity>

        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Your Assets</Text>
            <TouchableOpacity onPress={() => router.push('/add-custom-token')} hitSlop={10}>
              <Ionicons name="add-circle" size={26} color={theme.primary} />
            </TouchableOpacity>
          </View>

          <View style={[styles.tokenList, { borderColor: theme.border, backgroundColor: theme.surfaceSecondary || theme.surface }]}>
            {assetRows.map((token, index) => (
              <TouchableOpacity
                key={token.id}
                style={[
                  styles.tokenItem,
                  {
                    borderBottomWidth: index < assetRows.length - 1 ? 1 : 0,
                    borderBottomColor: theme.border,
                  },
                ]}
                activeOpacity={0.85}
              >
                <View style={styles.tokenLeft}>
                  <View style={styles.tokenLogo}>
                    <Text style={styles.tokenLogoText}>{token.logo}</Text>
                  </View>
                  <View>
                    <Text style={[styles.tokenSymbol, { color: theme.text }]}>{token.symbol}</Text>
                    <Text style={[styles.tokenName, { color: theme.textTertiary }]}>{token.name}</Text>
                  </View>
                </View>
                <View style={styles.tokenRight}>
                  <Text style={[styles.tokenValue, { color: theme.text }]}>{token.value}</Text>
                  <View
                    style={[
                      styles.tokenTag,
                      token.isCustom ? styles.tokenTagCustom : styles.tokenTagNative,
                    ]}
                  >
                    <Text style={styles.tokenTagText}>{token.isCustom ? 'Custom' : 'Native'}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Activity</Text>
          </View>
          <Text style={[styles.activityNote, { color: theme.textTertiary }]}>{activityHeaderNote}</Text>
          <View style={[styles.activityList, { borderColor: theme.border, backgroundColor: theme.surfaceSecondary || theme.surface }]}>
            {isLoadingActivity ? (
              <View style={styles.activityEmpty}>
                <ActivityIndicator color={theme.primary} />
                <Text style={[styles.activityEmptyText, { color: theme.textSecondary }]}>Loading your outgoing actions…</Text>
              </View>
            ) : activityEntries.length === 0 ? (
              <View style={styles.activityEmpty}>
                <Ionicons name="arrow-up-circle-outline" size={28} color={theme.textTertiary} />
                <Text style={[styles.activityEmptyText, { color: theme.textSecondary }]}>No wallet-initiated transactions yet.</Text>
                <Text style={[styles.activityHint, { color: theme.textTertiary }]}>Send something from this wallet to see it here.</Text>
              </View>
            ) : (
              activityEntries.map((entry, index) => {
                const statusTheme = statusStyles(entry.status);
                const timestampLabel = entry.timestamp ? new Date(entry.timestamp).toLocaleString() : 'Unknown time';
                return (
                  <TouchableOpacity
                    key={entry.id}
                    style={[
                      styles.activityItem,
                      {
                        borderBottomWidth: index < activityEntries.length - 1 ? 1 : 0,
                        borderBottomColor: theme.border,
                      },
                    ]}
                    onPress={() => handleActivityPress(entry)}
                    activeOpacity={entry.txHash ? 0.8 : 1}
                  >
                    <View style={[styles.activityIconCircle, { backgroundColor: 'rgba(16,185,129,0.12)' }]}>
                      <Ionicons name="arrow-up" size={18} color="#10B981" />
                    </View>
                    <View style={styles.activityTextGroup}>
                      <Text style={[styles.activityTitle, { color: theme.text }]}>
                        Sent {formatActivityAmount(entry.amount)} {entry.assetSymbol || selectedNetwork?.symbol || 'VW'}
                      </Text>
                      <Text style={[styles.activitySubtitle, { color: theme.textSecondary }]} numberOfLines={1}>
                        To {truncatedValue(entry.recipient || entry.metadata?.to)} · {timestampLabel}
                      </Text>
                      {entry.txHash && (
                        <Text style={[styles.activityHash, { color: theme.textTertiary }]} numberOfLines={1}>
                          {truncatedValue(entry.txHash, 10, 6)}
                        </Text>
                      )}
                    </View>
                    <View style={styles.activityMeta}>
                      <View style={[styles.activityStatus, { backgroundColor: statusTheme.backgroundColor }]}>
                        <Text style={[styles.activityStatusText, { color: statusTheme.color }]}>{entry.status || 'confirmed'}</Text>
                      </View>
                      {entry.txHash && <Ionicons name="copy-outline" size={18} color={theme.textTertiary} />}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </View>
      </ScrollView>
      <Modal visible={importModalVisible} transparent animationType="fade" onRequestClose={closeImportModal}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Import Account</Text>
            <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
              Paste the private key for the account you want to import. The key stays on this device.
            </Text>
            <TextInput
              style={[styles.modalInput, { borderColor: theme.border, color: theme.text, backgroundColor: theme.surfaceSecondary || theme.surface }]}
              placeholder="0xABC123..."
              placeholderTextColor={theme.textTertiary}
              value={importPrivateKey}
              onChangeText={setImportPrivateKey}
              autoCapitalize="none"
              autoCorrect={false}
              multiline
            />
            <TextInput
              style={[styles.modalInput, { borderColor: theme.border, color: theme.text, backgroundColor: theme.surfaceSecondary || theme.surface }]}
              placeholder="Optional label"
              placeholderTextColor={theme.textTertiary}
              value={importAccountLabel}
              onChangeText={setImportAccountLabel}
            />
            {!!importError && <Text style={styles.modalError}>{importError}</Text>}
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalButton, styles.modalCancelButton]} onPress={closeImportModal} disabled={isImportingAccount}>
                <Text style={[styles.modalButtonText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalPrimaryButton, { backgroundColor: theme.primary }]}
                onPress={handleImportAccount}
                disabled={isImportingAccount}
              >
                {isImportingAccount ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalPrimaryText}>Import</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 56,
  },
  headerRegion: {
    paddingTop: 52,
    marginBottom: 16,
  },
  toastWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 40,
    paddingHorizontal: 20,
  },
  toastContainer: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
  },
  toastTextGroup: {
    flex: 1,
  },
  toastTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  toastMessage: {
    fontSize: 13,
    opacity: 0.9,
  },
  toastDismiss: {
    padding: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 24,
    borderWidth: 1,
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  accountSelector: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
  },
  accountName: {
    fontSize: 15,
    fontWeight: '600',
  },
  accountAddress: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'monospace',
    marginTop: 2,
  },
  accountMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  dropdownWrapper: {
    position: 'absolute',
    top: 94,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    zIndex: 20,
  },
  dropdown: {
    borderRadius: 18,
    borderWidth: 1,
    maxHeight: 280,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  dropdownList: {
    maxHeight: 280,
  },
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
  },
  importButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
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
    borderRadius: 999,
  },
  activeBadgeSmallText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  balanceCard: {
    borderRadius: 24,
    padding: 24,
    gap: 8,
    marginTop: 40,
    overflow: 'hidden',
  },
  balanceLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    opacity: 0.9,
  },
  balanceAmount: {
    color: '#FFFFFF',
    fontSize: 38,
    fontWeight: 'bold',
    marginTop: 4,
  },
  balanceSubtext: {
    color: '#FFFFFF',
    opacity: 0.85,
    fontSize: 14,
    marginBottom: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  actionButton: {
    alignItems: 'center',
    width: 64,
  },
  actionIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  addressCard: {
    marginTop: 24,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addressLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  addressValue: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
  },
  section: {
    marginTop: 28,
    borderRadius: 24,
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  tokenList: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tokenItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  tokenLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tokenLogo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tokenLogoText: {
    fontSize: 22,
  },
  tokenSymbol: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  tokenName: {
    fontSize: 12,
  },
  tokenRight: {
    alignItems: 'flex-end',
  },
  tokenValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  tokenTag: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  tokenTagText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  tokenTagNative: {
    backgroundColor: '#475569',
  },
  tokenTagCustom: {
    backgroundColor: '#10B981',
  },
  activityNote: {
    fontSize: 12,
    marginBottom: 12,
    lineHeight: 16,
  },
  activityList: {
    marginTop: 8,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  activityEmpty: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 28,
    paddingHorizontal: 16,
  },
  activityEmptyText: {
    fontSize: 14,
    fontWeight: '600',
  },
  activityHint: {
    fontSize: 12,
    textAlign: 'center',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  activityIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityTextGroup: {
    flex: 1,
    gap: 4,
  },
  activityTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  activitySubtitle: {
    fontSize: 13,
  },
  activityHash: {
    fontSize: 12,
    fontFamily: 'monospace',
  },
  activityMeta: {
    alignItems: 'flex-end',
    gap: 8,
    marginLeft: 12,
  },
  activityStatus: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  activityStatusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 13,
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 12,
  },
  modalError: {
    color: '#EF4444',
    fontSize: 13,
    marginBottom: 8,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 4,
  },
  modalButton: {
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  modalCancelButton: {
    backgroundColor: 'transparent',
  },
  modalPrimaryButton: {
    minWidth: 110,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  modalPrimaryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});