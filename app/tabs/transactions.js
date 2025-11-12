import { useState, useCallback } from 'react';
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
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../contexts/ThemeContext';
import { getEthBalance, sendEth, getTokenBalance, sendToken } from '../../services/blockchainService';
import { getWalletInfo } from '../../services/didManager';
import { Send as SendIcon } from 'lucide-react-native';

export default function TransactionsTab() {
  const { theme } = useTheme();
  
  const [ethBalance, setEthBalance] = useState('0');
  const [voltBalance, setVoltBalance] = useState('0');
  const [address, setAddress] = useState('');
  
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [isSendingToken, setIsSendingToken] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingBalance, setIsFetchingBalance] = useState(true);

  const loadWalletData = useCallback(async () => {
    setIsFetchingBalance(true);
    try {
      const info = await getWalletInfo();
      if (info && info.address) {
        setAddress(info.address);
        const [ethBal, voltBal] = await Promise.all([
          getEthBalance(),
          getTokenBalance('VOLT')
        ]);
        setEthBalance(ethBal);
        setVoltBalance(voltBal);
      }
    } catch (error) {
      console.error('Failed to load wallet data:', error);
    } finally {
      setIsFetchingBalance(false);
    }
  }, []);

  useFocusEffect(loadWalletData);

  const handleSend = async () => {
    if (!recipient || !amount) {
      Alert.alert('Missing Info', 'Please enter a recipient address and an amount.');
      return;
    }

    setIsLoading(true);
    const asset = isSendingToken ? 'VOLT' : 'ETH';
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
              result = await sendEth(recipient, amount);
            }
            setIsLoading(false);

            if (result.success) {
              Alert.alert('Success!', `Transaction confirmed in block ${result.receipt.blockNumber}`);
              setRecipient('');
              setAmount('');
              loadWalletData(); // Refresh balances
            } else {
              Alert.alert('Transaction Failed', result.error);
            }
          },
        },
      ]
    );
  };

  const assetToSend = isSendingToken ? 'VOLT' : 'ETH';

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Transactions</Text>
        
        <View style={[styles.balanceCard, { backgroundColor: theme.surface }]}>
          <Text style={[styles.balanceLabel, { color: theme.textSecondary }]}>Your Balances</Text>
          {isFetchingBalance ? (
            <ActivityIndicator color={theme.primary} style={{ marginVertical: 20 }} />
          ) : (
            <>
              <View style={styles.balanceRow}>
                <Text style={[styles.balanceAmount, { color: theme.text }]}>{parseFloat(ethBalance).toFixed(4)}</Text>
                <Text style={[styles.balanceSymbol, { color: theme.textSecondary }]}>ETH</Text>
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
              <Text style={[styles.toggleLabel, { color: !isSendingToken ? theme.primary : theme.textTertiary }]}>ETH</Text>
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
  balanceCard: { padding: 20, borderRadius: 16, marginBottom: 24, gap: 16 },
  balanceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  balanceAmount: { fontSize: 32, fontWeight: 'bold', lineHeight: 36 },
  balanceSymbol: { fontSize: 16, paddingBottom: 4, fontWeight: '600' },
  balanceLabel: { fontSize: 16, fontWeight: '600' },
  address: { fontSize: 12, marginTop: 8, fontFamily: 'monospace' },
  sendCard: { padding: 20, borderRadius: 16 },
  sendHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sendTitle: { fontSize: 20, fontWeight: 'bold' },
  toggleContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggleLabel: { fontSize: 14, fontWeight: '600' },
  input: { height: 50, borderWidth: 1, borderRadius: 10, paddingHorizontal: 15, fontSize: 16, marginBottom: 12 },
  sendButton: { height: 50, borderRadius: 10, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 8 },
  sendButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
});