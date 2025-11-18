import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_STORAGE_KEY = 'voltus:customTokens';

const normalize = (token) => {
  if (!token?.address) return null;
  return {
    address: token.address.toLowerCase(),
    symbol: token.symbol || '',
    name: token.name || token.symbol || '',
    decimals: Number(token.decimals) || 18,
    logo: token.logo || null,
    chainId: token.chainId || null,
  };
};

const loadAll = async () => {
  try {
    const stored = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
    if (!stored) {
      return {};
    }
    const parsed = JSON.parse(stored);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    console.warn('Failed to load saved tokens', error);
    return {};
  }
};

const saveAll = async (data) => {
  await AsyncStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(data || {}));
};

export const getTokensForNetwork = async (networkId) => {
  if (!networkId) return [];
  const all = await loadAll();
  const list = all[networkId] || [];
  return list.map((token) => normalize(token)).filter(Boolean);
};

export const addCustomToken = async (networkId, token) => {
  if (!networkId) throw new Error('Network ID required.');
  const normalized = normalize(token);
  if (!normalized) throw new Error('Invalid token data.');
  const all = await loadAll();
  const list = all[networkId] || [];
  if (list.some((item) => item.address === normalized.address)) {
    throw new Error('Token already added.');
  }
  const updated = [...list, normalized];
  all[networkId] = updated;
  await saveAll(all);
  return normalized;
};

export const removeCustomToken = async (networkId, tokenAddress) => {
  if (!networkId || !tokenAddress) return;
  const all = await loadAll();
  const list = all[networkId] || [];
  const updated = list.filter((token) => token.address !== tokenAddress.toLowerCase());
  all[networkId] = updated;
  await saveAll(all);
  return updated;
};

