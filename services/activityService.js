import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'voltus:activity:v1';
const MAX_ENTRIES_PER_ACCOUNT = 100;

const safeLower = (value) => (typeof value === 'string' ? value.toLowerCase() : '');

const loadState = async () => {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (!stored) return {};
    const parsed = JSON.parse(stored);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    console.warn('Failed to load activity log', error);
    return {};
  }
};

const saveState = async (state) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state || {}));
  } catch (error) {
    console.warn('Failed to persist activity log', error);
  }
};

const makeEntry = (payload = {}) => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  timestamp: Date.now(),
  direction: 'outgoing',
  status: 'confirmed',
  type: 'send',
  assetType: 'native',
  assetSymbol: 'VW',
  amount: '0',
  recipient: '',
  metadata: {},
  ...payload,
});

export const logTransactionActivity = async ({
  networkId,
  accountAddress,
  networkName,
  txHash,
  type = 'send',
  status = 'confirmed',
  assetType = 'native',
  assetSymbol = 'VW',
  assetAddress = null,
  amount = '0',
  recipient = '',
  note = '',
}) => {
  if (!networkId || !accountAddress) return null;
  const state = await loadState();
  const normalizedNetwork = networkId;
  const normalizedAccount = safeLower(accountAddress);
  const perNetwork = state[normalizedNetwork] || {};
  const existing = Array.isArray(perNetwork[normalizedAccount]) ? perNetwork[normalizedAccount] : [];

  const entry = makeEntry({
    networkId: normalizedNetwork,
    networkName: networkName || '',
    accountAddress: normalizedAccount,
    txHash: txHash || null,
    type,
    status,
    assetType,
    assetSymbol,
    assetAddress,
    amount: String(amount),
    recipient,
    note,
  });

  perNetwork[normalizedAccount] = [entry, ...existing].slice(0, MAX_ENTRIES_PER_ACCOUNT);
  state[normalizedNetwork] = perNetwork;
  await saveState(state);
  return entry;
};

export const getActivityForAccount = async ({ networkId, accountAddress, limit = 25 }) => {
  if (!networkId || !accountAddress) return [];
  const state = await loadState();
  const perNetwork = state[networkId];
  if (!perNetwork) return [];
  const list = perNetwork[safeLower(accountAddress)];
  if (!Array.isArray(list) || !list.length) return [];
  return list.slice(0, limit);
};

export const clearActivityForAccount = async ({ networkId, accountAddress }) => {
  if (!networkId || !accountAddress) return;
  const state = await loadState();
  const perNetwork = state[networkId];
  if (!perNetwork) return;
  delete perNetwork[safeLower(accountAddress)];
  state[networkId] = perNetwork;
  await saveState(state);
};

