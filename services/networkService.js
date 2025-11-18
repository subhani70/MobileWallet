import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  NETWORK_OPTIONS,
  DEFAULT_NETWORK,
  NETWORK_STORAGE_KEY,
  CUSTOM_NETWORKS_STORAGE_KEY,
} from '../constants/networks';

const normalizeNetwork = (network, { isCustom = false } = {}) => {
  if (!network) return null;
  return {
    ...network,
    id: network.id || network.chainId,
    chainId: `${network.chainId || network.id || ''}`,
    isCustom: isCustom || network.isCustom || false,
    type: network.type || (isCustom ? 'Custom' : 'Default'),
  };
};

export const getCustomNetworks = async () => {
  try {
    const stored = await AsyncStorage.getItem(CUSTOM_NETWORKS_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((network) => normalizeNetwork(network, { isCustom: true }))
      .filter(Boolean);
  } catch (error) {
    console.warn('Failed to load custom networks', error);
    return [];
  }
};

export const saveCustomNetworks = async (networks) => {
  await AsyncStorage.setItem(CUSTOM_NETWORKS_STORAGE_KEY, JSON.stringify(networks || []));
};

export const getAllNetworks = async () => {
  const custom = await getCustomNetworks();
  return [...NETWORK_OPTIONS.map((n) => normalizeNetwork(n)), ...custom];
};

export const getSelectedNetwork = async () => {
  try {
    const stored = await AsyncStorage.getItem(NETWORK_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed?.id || parsed?.chainId) {
        return normalizeNetwork(parsed, { isCustom: parsed?.isCustom });
      }
    }
  } catch (error) {
    console.warn('Failed to parse selected network', error);
  }
  await AsyncStorage.setItem(NETWORK_STORAGE_KEY, JSON.stringify(DEFAULT_NETWORK));
  return DEFAULT_NETWORK;
};

export const setSelectedNetwork = async (network) => {
  const normalized = normalizeNetwork(network, { isCustom: network?.isCustom });
  if (!normalized?.rpcUrl) {
    throw new Error('Network RPC URL is required.');
  }
  await AsyncStorage.setItem(NETWORK_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
};

