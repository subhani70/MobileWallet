import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { Shield, Eye, EyeOff, KeyRound, Fingerprint, RefreshCcw, Users, Plus, Check, Edit2, Trash2, Copy } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { ethers } from 'ethers';
import { useTheme } from '../../contexts/ThemeContext';
import * as secureStorage from '../../services/secureStorage';
import * as accountManager from '../../services/accountManager';
import { verifyPIN } from '../../utils/pinUtils';
import { authenticateWithBiometric, canUseBiometric } from '../../services/biometric';

const secretFields = [
  { key: 'address', label: 'Wallet Address' },
  { key: 'publicAddress', label: 'Public Address' },
  { key: 'did', label: 'DID Address' },
  { key: 'publicKey', label: 'Public Key' },
  { key: 'privateKey', label: 'Private Key' },
];

const deriveAddressFromPrivateKey = (privateKey) => {
  if (!privateKey) return null;
  try {
    const wallet = new ethers.Wallet(privateKey);
    return wallet.address;
  } catch {
    return null;
  }
};

const normalizeAddress = (address, privateKey, warnings) => {
  if (address && ethers.isAddress(address)) {
    return ethers.getAddress(address);
  }
  const derived = deriveAddressFromPrivateKey(privateKey);
  if (derived) {
    warnings.push('Stored address was invalid. Derived address from private key.');
  }
  return derived;
};

const rebuildDid = (did, address, warnings) => {
  if (!address) return did || null;
  const canonical = `did:ethr:VoltusWave:${address.toLowerCase()}`;
  if (!did || !did.toLowerCase().includes(address.toLowerCase())) {
    warnings.push('DID was out of sync. Reconstructed from wallet address.');
    return canonical;
  }
  return did;
};

const sanitizeSecrets = ({ address, did, publicKey, privateKey }) => {
  const warnings = [];
  const cleanedAddress = address?.trim();
  const normalizedAddress = normalizeAddress(cleanedAddress, privateKey, warnings);

  if (!normalizedAddress && !cleanedAddress) {
    warnings.push('Wallet address missing. Reimport your wallet if this persists.');
  } else if (!normalizedAddress && cleanedAddress) {
    warnings.push('Stored address format invalid. Unable to recover from private key.');
  }

  const sanitizedDid = rebuildDid(did, normalizedAddress || cleanedAddress, warnings);

  const finalAddress = normalizedAddress || cleanedAddress || null;
  return {
    secrets: {
      address: finalAddress,
      publicAddress: finalAddress, // Public address is the same as wallet address
      did: sanitizedDid,
      publicKey: publicKey?.trim() || null,
      privateKey: privateKey || null,
    },
    warning: warnings.join(' '),
  };
};

export default function ProfileTab() {
  const router = useRouter();
  const { theme, themeMode, setThemeMode, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [authSheetVisible, setAuthSheetVisible] = useState(false);
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [recoveryModalVisible, setRecoveryModalVisible] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [secrets, setSecrets] = useState({});
  const [loadingSecrets, setLoadingSecrets] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [integrityWarning, setIntegrityWarning] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [activeAccountIndex, setActiveAccountIndex] = useState(0);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [accountModalVisible, setAccountModalVisible] = useState(false);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);

  useEffect(() => {
    const loadSettings = async () => {
      const enabled = await secureStorage.isBiometricEnabled();
      const available = await canUseBiometric();
      setBiometricEnabled(enabled && available);
    };
    loadSettings();
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      setLoadingAccounts(true);
      const allAccounts = await accountManager.getAllAccounts();
      const activeIndex = await accountManager.getActiveAccountIndex();
      setAccounts(allAccounts);
      setActiveAccountIndex(activeIndex);
    } catch (error) {
      console.error('Failed to load accounts:', error);
    } finally {
      setLoadingAccounts(false);
    }
  };

  const handleCreateAccount = async () => {
    try {
      setLoadingAccounts(true);
      const nextIndex = await accountManager.getAccountCount();
      const newAccount = await accountManager.createNewAccount(`Account ${nextIndex + 1}`);
      await loadAccounts();
      setFeedback(`Created ${newAccount.label}`);
      setTimeout(() => setFeedback(''), 3000);
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to create account');
    } finally {
      setLoadingAccounts(false);
      setAccountModalVisible(false);
    }
  };

  const handleSwitchAccount = async (accountIndex) => {
    try {
      await accountManager.switchAccount(accountIndex);
      await loadAccounts();
      setFeedback('Account switched');
      setTimeout(() => setFeedback(''), 3000);
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to switch account');
    }
  };

  const handleRenameAccount = async (accountIndex, newLabel) => {
    try {
      await accountManager.updateAccountLabel(accountIndex, newLabel);
      await loadAccounts();
      setFeedback('Account renamed');
      setTimeout(() => setFeedback(''), 3000);
      setRenameModalVisible(false);
      setSelectedAccount(null);
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to rename account');
    }
  };

  const handleDeleteAccount = async (accountIndex) => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete this account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await accountManager.deleteAccount(accountIndex);
              await loadAccounts();
              setFeedback('Account deleted');
              setTimeout(() => setFeedback(''), 3000);
            } catch (error) {
              Alert.alert('Error', error.message || 'Failed to delete account');
            }
          },
        },
      ]
    );
  };

  const handleCopyAddress = async (address) => {
    await Clipboard.setStringAsync(address);
    setFeedback('Address copied');
    setTimeout(() => setFeedback(''), 3000);
  };

  const loadSecrets = useCallback(async () => {
    try {
      setLoadingSecrets(true);
      const [address, did, publicKey, privateKey] = await Promise.all([
        secureStorage.getAddress(),
        secureStorage.getDID(),
        secureStorage.getPublicKey(),
        secureStorage.getPrivateKey(),
      ]);
      const { secrets: normalized, warning } = sanitizeSecrets({ address, did, publicKey, privateKey });
      setSecrets(normalized);
      setIntegrityWarning(warning);
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to load wallet details.');
    } finally {
      setLoadingSecrets(false);
    }
  }, []);

  const completeUnlock = useCallback(async (methodLabel) => {
    setUnlocking(false);
    setAuthSheetVisible(false);
    setPinModalVisible(false);
    setRecoveryModalVisible(false);
    setIsUnlocked(true);
    await loadSecrets();
    setFeedback(`${methodLabel} verified. Wallet secrets unlocked.`);
    setTimeout(() => setFeedback(''), 3500);
  }, [loadSecrets]);

  const handleCopy = useCallback(async (label, value) => {
    if (!value) return;
    await Clipboard.setStringAsync(value);
    setFeedback(`${label} copied to clipboard`);
    setTimeout(() => setFeedback(''), 3000);
  }, []);

  const handlePinSubmit = async (pin) => {
    try {
      setUnlocking(true);
      const storedHash = await secureStorage.getPINHash();
      if (!storedHash) {
        Alert.alert('No PIN Set', 'Please configure a PIN during onboarding.');
        router.push('/onboarding/pin-setup');
        return;
      }
      const valid = await verifyPIN(pin, storedHash);
      if (!valid) {
        throw new Error('Incorrect PIN. Try again.');
      }
      await completeUnlock('PIN');
    } catch (error) {
      Alert.alert('PIN Error', error.message || 'Failed to verify PIN.');
    } finally {
      setUnlocking(false);
    }
  };

  const handleRecoverySubmit = async (phrase) => {
    try {
      setUnlocking(true);
      const stored = await secureStorage.getMnemonic();
      if (!stored) {
        Alert.alert('Missing Recovery Phrase', 'No recovery phrase stored on this device.');
        return;
      }
      const normalize = (value) => value?.trim().toLowerCase().replace(/\s+/g, ' ');
      if (normalize(phrase) !== normalize(stored)) {
        throw new Error('Recovery phrase does not match.');
      }
      await completeUnlock('Recovery phrase');
    } catch (error) {
      Alert.alert('Recovery Error', error.message || 'Unable to verify recovery phrase.');
    } finally {
      setUnlocking(false);
    }
  };

  const handleBiometricUnlock = async () => {
    try {
      setUnlocking(true);
      const result = await authenticateWithBiometric('Authenticate to view wallet secrets');
      if (!result.success) {
        throw new Error(result.error || 'Biometric authentication failed.');
      }
      await completeUnlock('Biometric');
    } catch (error) {
      Alert.alert('Biometric Error', error.message);
    } finally {
      setUnlocking(false);
    }
  };

  const secretCards = useMemo(
    () =>
      secretFields.map((field) => (
        <SecretCard
          key={field.key}
          label={field.label}
          value={secrets[field.key]}
          theme={theme}
          onCopy={() => handleCopy(field.label, secrets[field.key])}
        />
      )),
    [secrets, theme, handleCopy],
  );

  return (
    <ScrollView 
      style={{ flex: 1, backgroundColor: theme.background }} 
      contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20 }]}
    >
      <View style={[styles.header, { borderColor: theme.border }]}>
        <View style={styles.headerIcon}>
          <Shield color={theme.primary} size={32} />
        </View>
        <View>
          <Text style={[styles.title, { color: theme.text }]}>Profile & Security</Text>
          <Text style={{ color: theme.textTertiary }}>Manage appearance and wallet secrets</Text>
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: theme.surface }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Theme</Text>
        <View style={styles.row}>
          {['light', 'dark', 'system'].map((mode) => (
            <TouchableOpacity
              key={mode}
              style={[
                styles.btn,
                {
                  backgroundColor: themeMode === mode ? theme.primary : theme.surfaceSecondary,
                  borderColor: theme.border,
                },
              ]}
              onPress={() => setThemeMode(mode)}
            >
              <Text style={[styles.btnText, { color: themeMode === mode ? '#fff' : theme.text }]}>
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={[styles.helper, { color: theme.textTertiary }]}>
          Current theme: {themeMode} ({isDark ? 'Dark' : 'Light'} palette)
        </Text>
      </View>

      <View style={[styles.section, { backgroundColor: theme.surface }]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Accounts</Text>
          <TouchableOpacity
            onPress={handleCreateAccount}
            disabled={loadingAccounts}
            style={styles.addAccountBtn}
          >
            <Plus size={18} color={theme.primary} />
            <Text style={[styles.addAccountText, { color: theme.primary }]}>Add</Text>
          </TouchableOpacity>
        </View>
        {loadingAccounts ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={theme.primary} />
            <Text style={{ color: theme.text, marginLeft: 8 }}>Loading accounts…</Text>
          </View>
        ) : accounts.length === 0 ? (
          <View style={[styles.emptyState, { borderColor: theme.border }]}>
            <Users color={theme.textTertiary} size={24} />
            <Text style={[styles.emptyStateText, { color: theme.textTertiary }]}>
              No accounts found
            </Text>
          </View>
        ) : (
          <View style={styles.accountsList}>
            {accounts.map((account) => (
              <AccountCard
                key={account.index}
                account={account}
                isActive={account.index === activeAccountIndex}
                theme={theme}
                isDark={isDark}
                onSwitch={() => handleSwitchAccount(account.index)}
                onRename={() => {
                  setSelectedAccount(account);
                  setRenameModalVisible(true);
                }}
                onDelete={() => handleDeleteAccount(account.index)}
                onCopyAddress={() => handleCopyAddress(account.address)}
                canDelete={accounts.length > 1}
              />
            ))}
          </View>
        )}
      </View>

      <View style={[styles.section, { backgroundColor: theme.surface }]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Wallet Secrets</Text>
          {isUnlocked && !loadingSecrets && (
            <TouchableOpacity onPress={loadSecrets} style={styles.refreshBtn}>
              <RefreshCcw size={16} color={theme.textTertiary} />
              <Text style={[styles.refreshText, { color: theme.textTertiary }]}>Refresh</Text>
            </TouchableOpacity>
          )}
        </View>
        {!isUnlocked ? (
          <View style={[styles.lockedBox, { borderColor: theme.border }]}>
            <KeyRound color={theme.textTertiary} size={28} />
            <Text style={{ color: theme.text, fontWeight: '600', marginTop: 8 }}>Secrets Locked</Text>
            <Text style={[styles.helper, { color: theme.textTertiary, textAlign: 'center' }]}>
              Protecting your wallet keys. Authenticate with PIN, recovery phrase, or biometrics to reveal.
            </Text>
            <TouchableOpacity
              style={[styles.primaryAction, { backgroundColor: theme.primary }]}
              onPress={() => setAuthSheetVisible(true)}
            >
              <Eye color="#fff" size={18} />
              <Text style={styles.primaryActionText}>Unlock Wallet Secrets</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            {loadingSecrets ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={theme.primary} />
                <Text style={{ color: theme.text, marginLeft: 8 }}>Loading keys…</Text>
              </View>
            ) : (
              secretCards
            )}
            {!!integrityWarning && (
              <View
                style={[
                  styles.warningBox,
                  {
                    borderColor: theme.warning,
                    backgroundColor: isDark ? 'rgba(251, 191, 36, 0.08)' : '#FEF3C7',
                  },
                ]}
              >
                <Text style={[styles.warningText, { color: theme.warning }]}>{integrityWarning}</Text>
              </View>
            )}
            <TouchableOpacity
              style={[styles.dangerAction, { borderColor: theme.border }]}
              onPress={() => {
                setIsUnlocked(false);
                setSecrets({});
              }}
            >
              <EyeOff color={theme.textTertiary} size={18} />
              <Text style={[styles.dangerActionText, { color: theme.textTertiary }]}>Hide Secrets</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {!!feedback && (
        <View style={[styles.feedbackBadge, { backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}>
          <Text style={{ color: theme.text }}>{feedback}</Text>
        </View>
      )}

      <AuthSheet
        visible={authSheetVisible}
        onClose={() => setAuthSheetVisible(false)}
        onSelectMethod={(method) => {
          if (method === 'pin') {
            setPinModalVisible(true);
          } else if (method === 'phrase') {
            setRecoveryModalVisible(true);
          } else if (method === 'biometric') {
            handleBiometricUnlock();
          }
        }}
        biometricEnabled={biometricEnabled}
        theme={theme}
      />

      <PinModal
        visible={pinModalVisible}
        onClose={() => setPinModalVisible(false)}
        onSubmit={handlePinSubmit}
        theme={theme}
        busy={unlocking}
      />

      <RecoveryModal
        visible={recoveryModalVisible}
        onClose={() => setRecoveryModalVisible(false)}
        onSubmit={handleRecoverySubmit}
        theme={theme}
        busy={unlocking}
        onForgot={() => {
          setRecoveryModalVisible(false);
          router.push('/onboarding/recovery-phrase-entry');
        }}
      />

      <RenameAccountModal
        visible={renameModalVisible}
        onClose={() => {
          setRenameModalVisible(false);
          setSelectedAccount(null);
        }}
        onSubmit={(newLabel) => {
          if (selectedAccount) {
            handleRenameAccount(selectedAccount.index, newLabel);
          }
        }}
        account={selectedAccount}
        theme={theme}
      />
    </ScrollView>
  );
}

function AccountCard({ account, isActive, theme, isDark, onSwitch, onRename, onDelete, onCopyAddress, canDelete }) {
  const shortAddress = `${account.address.substring(0, 6)}...${account.address.substring(38)}`;

  return (
    <TouchableOpacity
      style={[
        styles.accountCard,
        {
          borderColor: isActive ? theme.primary : theme.border,
          backgroundColor: isActive ? (isDark ? 'rgba(6, 182, 212, 0.1)' : 'rgba(6, 182, 212, 0.05)') : 'transparent',
        },
      ]}
      onPress={!isActive ? onSwitch : undefined}
    >
      <View style={styles.accountCardHeader}>
        <View style={styles.accountCardLeft}>
          {isActive && <Check size={16} color={theme.primary} />}
          <View style={styles.accountInfo}>
            <Text style={[styles.accountLabel, { color: theme.text }]}>{account.label}</Text>
            <Text style={[styles.accountAddress, { color: theme.textTertiary }]} numberOfLines={1}>
              {shortAddress}
            </Text>
          </View>
        </View>
        <View style={styles.accountActions}>
          <TouchableOpacity
            onPress={onCopyAddress}
            style={[styles.accountActionBtn, { borderColor: theme.border }]}
          >
            <Copy size={14} color={theme.textTertiary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onRename}
            style={[styles.accountActionBtn, { borderColor: theme.border }]}
          >
            <Edit2 size={14} color={theme.textTertiary} />
          </TouchableOpacity>
          {canDelete && (
            <TouchableOpacity
              onPress={onDelete}
              style={[styles.accountActionBtn, { borderColor: theme.border }]}
            >
              <Trash2 size={14} color={theme.error || '#ef4444'} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

function RenameAccountModal({ visible, onClose, onSubmit, account, theme }) {
  const [newLabel, setNewLabel] = useState('');

  useEffect(() => {
    if (visible && account) {
      setNewLabel(account.label);
    } else {
      setNewLabel('');
    }
  }, [visible, account]);

  const handleSubmit = () => {
    if (!newLabel.trim()) {
      Alert.alert('Invalid Label', 'Account label cannot be empty');
      return;
    }
    onSubmit(newLabel.trim());
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.modalTitle, { color: theme.text }]}>Rename Account</Text>
          <Text style={[styles.helper, { color: theme.textTertiary, textAlign: 'center' }]}>
            Enter a new name for this account
          </Text>
          <TextInput
            value={newLabel}
            onChangeText={setNewLabel}
            style={[styles.input, { borderColor: theme.border, color: theme.text }]}
            placeholder="Account name"
            placeholderTextColor={theme.textTertiary}
            autoFocus
          />
          <View style={styles.modalActions}>
            <TouchableOpacity style={[styles.secondaryBtn, { borderColor: theme.border }]} onPress={onClose}>
              <Text style={{ color: theme.text }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: theme.primary }]}
              onPress={handleSubmit}
            >
              <Text style={styles.primaryBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function SecretCard({ label, value, theme, onCopy }) {
  return (
    <TouchableOpacity style={[styles.secretCard, { borderColor: theme.border }]} onLongPress={onCopy}>
      <Text style={[styles.secretLabel, { color: theme.textTertiary }]}>{label}</Text>
      <Text style={[styles.secretValue, { color: theme.text }]} numberOfLines={4} selectable>
        {value || 'Unavailable'}
      </Text>
      {value && <Text style={[styles.copyHint, { color: theme.textTertiary }]}>Long press to copy</Text>}
    </TouchableOpacity>
  );
}

function AuthSheet({ visible, onClose, onSelectMethod, biometricEnabled, theme }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetOverlay}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheetContent, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.sheetHandle} />
          <Text style={[styles.sheetTitle, { color: theme.text }]}>Authenticate to Continue</Text>
          <Text style={[styles.helper, { color: theme.textTertiary, textAlign: 'center' }]}>
            Choose a method to verify your identity
          </Text>
          <TouchableOpacity style={[styles.sheetButton, { borderColor: theme.border }]} onPress={() => onSelectMethod('pin')}>
            <KeyRound color={theme.text} size={20} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.sheetButtonTitle, { color: theme.text }]}>Use PIN</Text>
              <Text style={[styles.sheetButtonSubtitle, { color: theme.textTertiary }]}>Enter your 6-digit wallet PIN</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sheetButton, { borderColor: theme.border }]}
            onPress={() => onSelectMethod('phrase')}
          >
            <Shield color={theme.text} size={20} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.sheetButtonTitle, { color: theme.text }]}>Use Recovery Phrase</Text>
              <Text style={[styles.sheetButtonSubtitle, { color: theme.textTertiary }]}>Confirm your 12-word backup</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            disabled={!biometricEnabled}
            style={[
              styles.sheetButton,
              { borderColor: theme.border, opacity: biometricEnabled ? 1 : 0.4 },
            ]}
            onPress={() => biometricEnabled && onSelectMethod('biometric')}
          >
            <Fingerprint color={theme.text} size={20} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.sheetButtonTitle, { color: theme.text }]}>Use Biometric</Text>
              <Text style={[styles.sheetButtonSubtitle, { color: theme.textTertiary }]}>
                {biometricEnabled ? 'Authenticate with fingerprint/face' : 'Enable biometrics first'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function PinModal({ visible, onClose, onSubmit, theme, busy }) {
  const [pin, setPin] = useState('');

  useEffect(() => {
    if (!visible) setPin('');
  }, [visible]);

  const handleConfirm = () => {
    if (pin.length !== 6) {
      Alert.alert('Invalid PIN', 'PIN must be exactly 6 digits.');
      return;
    }
    onSubmit(pin);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.modalTitle, { color: theme.text }]}>Enter PIN</Text>
          <Text style={[styles.helper, { color: theme.textTertiary, textAlign: 'center' }]}>
            Enter the 6-digit PIN you set during onboarding
          </Text>
          <TextInput
            value={pin}
            onChangeText={(text) => setPin(text.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            maxLength={6}
            secureTextEntry
            style={[styles.pinInput, { borderColor: theme.border, color: theme.text }]}
            placeholder="••••••"
            placeholderTextColor={theme.textTertiary}
          />
          <View style={styles.modalActions}>
            <TouchableOpacity style={[styles.secondaryBtn, { borderColor: theme.border }]} onPress={onClose} disabled={busy}>
              <Text style={{ color: theme.text }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: theme.primary }]}
              onPress={handleConfirm}
              disabled={busy}
            >
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Verify PIN</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function RecoveryModal({ visible, onClose, onSubmit, theme, busy, onForgot }) {
  const [phrase, setPhrase] = useState('');

  useEffect(() => {
    if (!visible) setPhrase('');
  }, [visible]);

  const handleConfirm = () => {
    if (phrase.trim().split(/\s+/).length < 12) {
      Alert.alert('Incomplete Phrase', 'Please enter the full 12-word recovery phrase.');
      return;
    }
    onSubmit(phrase);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.modalTitle, { color: theme.text }]}>Verify Recovery Phrase</Text>
          <Text style={[styles.helper, { color: theme.textTertiary, textAlign: 'center' }]}>
            Enter the 12-word phrase you used to back up the wallet
          </Text>
          <TextInput
            value={phrase}
            onChangeText={setPhrase}
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            style={[styles.phraseInput, { borderColor: theme.border, color: theme.text }]}
            placeholder="word1 word2 word3 ..."
            placeholderTextColor={theme.textTertiary}
          />
          <TouchableOpacity onPress={onForgot}>
            <Text style={[styles.forgotText, { color: theme.primary }]}>Forgot phrase?</Text>
          </TouchableOpacity>
          <View style={styles.modalActions}>
            <TouchableOpacity style={[styles.secondaryBtn, { borderColor: theme.border }]} onPress={onClose} disabled={busy}>
              <Text style={{ color: theme.text }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: theme.primary }]}
              onPress={handleConfirm}
              disabled={busy}
            >
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Verify Phrase</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40, gap: 16 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    borderWidth: 1,
    borderRadius: 16,
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
  },
  title: { fontSize: 20, fontWeight: '700' },
  section: {
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 10 },
  btn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontWeight: '600' },
  helper: { fontSize: 13 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lockedBox: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 10,
  },
  primaryAction: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 999,
  },
  primaryActionText: { color: '#fff', fontWeight: '700' },
  secretCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
  secretLabel: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  secretValue: { fontSize: 14, marginTop: 4, fontFamily: 'Courier' },
  copyHint: { fontSize: 11, marginTop: 8 },
  dangerAction: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 8,
  },
  dangerActionText: { fontWeight: '600' },
  feedbackBadge: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheetContent: {
    padding: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    gap: 12,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  sheetButton: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  sheetButtonTitle: { fontSize: 15, fontWeight: '600' },
  sheetButtonSubtitle: { fontSize: 13 },
  refreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8 },
  refreshText: { fontSize: 12, fontWeight: '600' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
    gap: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  pinInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    fontSize: 24,
    letterSpacing: 8,
    textAlign: 'center',
    fontWeight: '600',
  },
  phraseInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    minHeight: 120,
    textAlignVertical: 'top',
    fontSize: 14,
  },
  forgotText: { fontSize: 13, textAlign: 'center', marginTop: -6 },
  modalActions: { flexDirection: 'row', gap: 10 },
  secondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
  addAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addAccountText: { fontSize: 14, fontWeight: '600' },
  accountsList: { gap: 12 },
  accountCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  accountCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  accountCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  accountInfo: { flex: 1 },
  accountLabel: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  accountAddress: { fontSize: 12, fontFamily: 'monospace' },
  accountActions: {
    flexDirection: 'row',
    gap: 6,
  },
  accountActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyStateText: { fontSize: 14 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    marginTop: 8,
  },
});