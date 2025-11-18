import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../contexts/ThemeContext';
import { ethers } from 'ethers';
import {
  DEFAULT_NETWORK,
  NETWORK_OPTIONS,
} from '../constants/networks';
import {
  getCustomNetworks,
  saveCustomNetworks,
  setSelectedNetwork as persistSelectedNetwork,
  getSelectedNetwork,
} from '../services/networkService';
import { resetProviderCache } from '../services/blockchainService';

export default function ManageNetworksScreen() {
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const [activeNetwork, setActiveNetwork] = useState(DEFAULT_NETWORK);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customNetworks, setCustomNetworks] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [editingNetworkId, setEditingNetworkId] = useState(null);
  const [submittingNetwork, setSubmittingNetwork] = useState(false);
  const [form, setForm] = useState({
    name: '',
    rpcUrl: '',
    chainId: '',
    symbol: '',
    explorer: '',
  });
  const [verifyingNetworkId, setVerifyingNetworkId] = useState(null);

  const allNetworks = useMemo(() => [...NETWORK_OPTIONS, ...customNetworks], [customNetworks]);

  useEffect(() => {
    const load = async () => {
      try {
        const [selected, custom] = await Promise.all([getSelectedNetwork(), getCustomNetworks()]);
        setActiveNetwork(selected || DEFAULT_NETWORK);
        setCustomNetworks(custom);
      } catch (error) {
        console.warn('Failed to load network', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const updateSelectedNetwork = useCallback(
    async (network, { silent } = { silent: false }) => {
      if (!silent) {
        setSaving(true);
      }
      try {
        const normalized = await persistSelectedNetwork(network);
        setActiveNetwork(normalized);
        resetProviderCache();
        if (!silent) {
          Alert.alert('Network updated', `Now connected to ${normalized.name}`);
        }
      } catch (error) {
        Alert.alert('Error', error.message || 'Unable to save network preference.');
      } finally {
        if (!silent) {
          setSaving(false);
        }
      }
    },
    []
  );

  const handleSelect = async (network) => {
    setVerifyingNetworkId(network.id);
    try {
      await ensureNetworkReachable(network);
      await updateSelectedNetwork(network);
    } catch (error) {
      Alert.alert('Network unreachable', error.message || 'Could not connect to this RPC endpoint.');
    } finally {
      setVerifyingNetworkId(null);
    }
  };

  const resetForm = useCallback(() => {
    setForm({
      name: '',
      rpcUrl: '',
      chainId: '',
      symbol: '',
      explorer: '',
    });
  }, []);

  const closeModal = useCallback(() => {
    setModalVisible(false);
    setModalMode('add');
    setEditingNetworkId(null);
    resetForm();
  }, [resetForm]);

  const openAddModal = useCallback(() => {
    resetForm();
    setModalMode('add');
    setEditingNetworkId(null);
    setModalVisible(true);
  }, [resetForm]);

  const openEditModal = useCallback((network) => {
    if (!network?.id) return;
    setModalMode('edit');
    setEditingNetworkId(network.id);
    setForm({
      name: network.name || '',
      rpcUrl: network.rpcUrl || '',
      chainId: network.chainId ? String(network.chainId) : '',
      symbol: network.symbol || '',
      explorer: network.explorer || '',
    });
    setModalVisible(true);
  }, []);

  const handleSubmitNetwork = async () => {
    const trimmed = {
      name: form.name.trim(),
      rpcUrl: form.rpcUrl.trim(),
      chainId: form.chainId.trim(),
      symbol: form.symbol.trim(),
      explorer: form.explorer.trim(),
    };

    if (!trimmed.name || !trimmed.rpcUrl || !trimmed.chainId || !trimmed.symbol) {
      Alert.alert('Missing info', 'Please complete all required fields.');
      return;
    }

    const duplicateChainId = allNetworks.some((network) => {
      if (modalMode === 'edit' && network.id === editingNetworkId) {
        return false;
      }
      return network.chainId === trimmed.chainId;
    });

    if (duplicateChainId) {
      Alert.alert('Duplicate chain ID', 'A network with this chain ID already exists.');
      return;
    }

    if (modalMode === 'edit' && !editingNetworkId) {
      Alert.alert('Missing info', 'No network selected to edit.');
      return;
    }

    const existingNetwork = modalMode === 'edit' ? customNetworks.find((network) => network.id === editingNetworkId) : null;
    if (modalMode === 'edit' && !existingNetwork) {
      Alert.alert('Not found', 'Unable to locate this custom network.');
      return;
    }

    const payload = {
      id: trimmed.chainId,
      name: trimmed.name,
      rpcUrl: trimmed.rpcUrl,
      chainId: trimmed.chainId,
      symbol: trimmed.symbol,
      explorer: trimmed.explorer,
      isCustom: true,
      type: existingNetwork?.type || 'Custom',
    };

    setSubmittingNetwork(true);
    try {
      await ensureNetworkReachable(payload);
      if (modalMode === 'add') {
        const updatedCustom = [...customNetworks, payload];
        await saveCustomNetworks(updatedCustom);
        setCustomNetworks(updatedCustom);
        await updateSelectedNetwork(payload, { silent: true });
        Alert.alert('Success', 'Custom network added and selected.');
      } else {
        const updatedCustom = customNetworks.map((network) => (network.id === editingNetworkId ? payload : network));
        await saveCustomNetworks(updatedCustom);
        setCustomNetworks(updatedCustom);
        if (activeNetwork?.id === editingNetworkId) {
          await updateSelectedNetwork(payload, { silent: true });
        }
        Alert.alert('Updated', 'Custom network updated.');
      }
      closeModal();
    } catch (error) {
      const isAddMode = modalMode === 'add';
      Alert.alert(
        isAddMode ? 'Network unreachable' : 'Update failed',
        error.message || (isAddMode ? 'Could not connect to this RPC endpoint.' : 'Unable to update this network.')
      );
    } finally {
      setSubmittingNetwork(false);
    }
  };

  const handleDeleteNetwork = (network) => {
    Alert.alert('Remove Network', `Remove ${network.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const updated = customNetworks.filter((item) => item.id !== network.id);
          setCustomNetworks(updated);
          await saveCustomNetworks(updated);
          if (activeNetwork?.id === network.id) {
            await updateSelectedNetwork(DEFAULT_NETWORK, { silent: true });
          }
          Alert.alert('Removed', `${network.name} has been removed.`);
        },
      },
    ]);
  };

  const renderNetworkItem = (network) => {
    const isSelected = network.id === activeNetwork?.id;
    return (
      <View style={[styles.networkItem]}>
        <TouchableOpacity
          style={styles.networkContent}
          onPress={() => handleSelect(network)}
          activeOpacity={0.85}
          disabled={saving}
        >
          <View style={styles.networkLeft}>
            <View
              style={[
                styles.radioOuter,
                {
                  borderColor: isSelected ? theme.primary : theme.textTertiary,
                },
                isSelected && { borderColor: theme.primary },
              ]}
            >
              {isSelected && <View style={[styles.radioInner, { backgroundColor: theme.primary }]} />}
            </View>
            <View>
              <Text style={[styles.networkName, { color: theme.text }]}>{network.name}</Text>
              <Text style={[styles.networkDetail, { color: theme.textTertiary }]}>Chain ID: {network.chainId}</Text>
              <Text style={[styles.networkDetail, { color: theme.textTertiary }]}>Currency: {network.symbol || 'N/A'}</Text>
            </View>
          </View>
          <View style={styles.networkRight}>
            {verifyingNetworkId === network.id ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : network.isCustom ? (
              <View style={styles.customActions}>
                <TouchableOpacity
                  style={[
                    styles.editButton,
                    {
                      borderColor: theme.border,
                      backgroundColor: isDark ? 'rgba(59,130,246,0.18)' : '#EEF2FF',
                    },
                  ]}
                  onPress={(event) => {
                    event.stopPropagation?.();
                    openEditModal(network);
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="create-outline" size={18} color={theme.primary} />
                  <Text style={[styles.editButtonText, { color: theme.primary }]}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.deleteButton,
                    {
                      backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : '#FEE2E2',
                    },
                  ]}
                  onPress={(event) => {
                    event.stopPropagation?.();
                    handleDeleteNetwork(network);
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={[styles.pill, { backgroundColor: isDark ? 'rgba(148,163,184,0.2)' : 'rgba(148,163,184,0.15)' }]}>
                <Text style={styles.pillText}>{network.type || 'Default'}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={[styles.backButton, { borderColor: theme.border }]}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-back" size={20} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Manage Networks</Text>
        <TouchableOpacity
          style={[styles.addButton, { borderColor: theme.border }]}
          onPress={openAddModal}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={20} color={theme.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={theme.primary} />
          <Text style={{ color: theme.text, marginTop: 12 }}>Loading networks…</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.sectionTitle, { color: theme.textTertiary }]}>Available Networks</Text>

          <View style={[styles.networkList, { borderColor: theme.border, backgroundColor: theme.surface }]}>
            {allNetworks.map((network, index) => (
              <View key={network.id} style={{ borderBottomWidth: index < allNetworks.length - 1 ? StyleSheet.hairlineWidth : 0, borderBottomColor: theme.border }}>
                {renderNetworkItem(network)}
              </View>
            ))}
          </View>

          <View style={[styles.infoCard, { backgroundColor: theme.surfaceSecondary || theme.surface, borderColor: theme.border }]}>
            <Ionicons name="information-circle-outline" size={22} color={theme.primary} />
            <Text style={[styles.infoText, { color: theme.textSecondary }]}>
              Custom networks let you connect to any EVM-compatible chain. Always verify RPC URLs and chain IDs before adding them.
            </Text>
          </View>
        </ScrollView>
      )}

      <Modal animationType="slide" transparent visible={modalVisible} onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                {modalMode === 'edit' ? 'Edit Custom Network' : 'Add Custom Network'}
              </Text>
              <TouchableOpacity onPress={closeModal}>
                <Ionicons name="close" size={22} color={theme.text} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Network Name *</Text>
              <TextInput
                style={[styles.input, { borderColor: theme.border, backgroundColor: theme.surfaceSecondary || theme.surface, color: theme.text }]}
                placeholder="Volt Devnet"
                placeholderTextColor={theme.textTertiary}
                value={form.name}
                onChangeText={(value) => setForm((prev) => ({ ...prev, name: value }))}
              />

              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>RPC URL *</Text>
              <TextInput
                style={[styles.input, { borderColor: theme.border, backgroundColor: theme.surfaceSecondary || theme.surface, color: theme.text }]}
                placeholder="https://rpc.example.com"
                placeholderTextColor={theme.textTertiary}
                autoCapitalize="none"
                value={form.rpcUrl}
                onChangeText={(value) => setForm((prev) => ({ ...prev, rpcUrl: value }))}
              />

              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Chain ID *</Text>
              <TextInput
                style={[styles.input, { borderColor: theme.border, backgroundColor: theme.surfaceSecondary || theme.surface, color: theme.text }]}
                placeholder="e.g. 777"
                placeholderTextColor={theme.textTertiary}
                keyboardType="numeric"
                value={form.chainId}
                onChangeText={(value) => setForm((prev) => ({ ...prev, chainId: value }))}
              />

              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Currency Symbol *</Text>
              <TextInput
                style={[styles.input, { borderColor: theme.border, backgroundColor: theme.surfaceSecondary || theme.surface, color: theme.text }]}
                placeholder="VW"
                placeholderTextColor={theme.textTertiary}
                autoCapitalize="characters"
                value={form.symbol}
                onChangeText={(value) => setForm((prev) => ({ ...prev, symbol: value }))}
              />

              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Block Explorer URL</Text>
              <TextInput
                style={[styles.input, { borderColor: theme.border, backgroundColor: theme.surfaceSecondary || theme.surface, color: theme.text }]}
                placeholder="https://explorer.example.com"
                placeholderTextColor={theme.textTertiary}
                autoCapitalize="none"
                value={form.explorer}
                onChangeText={(value) => setForm((prev) => ({ ...prev, explorer: value }))}
              />

              <View style={[styles.warningCard, { borderColor: '#F59E0B', backgroundColor: isDark ? 'rgba(245,158,11,0.15)' : '#FFF8EB' }]}>
                <Ionicons name="warning-outline" size={20} color="#F59E0B" />
                <Text style={[styles.warningText, { color: '#B45309' }]}>
                  Only add RPC endpoints you trust. Malicious endpoints can steal funds or leak sensitive data.
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.submitButton, { backgroundColor: theme.primary }]}
                onPress={handleSubmitNetwork}
                disabled={submittingNetwork}
                activeOpacity={0.9}
              >
                {submittingNetwork ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>
                    {modalMode === 'edit' ? 'Save Changes' : 'Add Network'}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const ensureNetworkReachable = async (network) => {
  if (!network?.rpcUrl) {
    throw new Error('RPC URL is required.');
  }
  const rpc = network.rpcUrl.trim();
  if (!rpc) {
    throw new Error('RPC URL cannot be empty.');
  }
  try {
    const provider = new ethers.JsonRpcProvider(rpc, network.chainId ? Number(network.chainId) : undefined);
    const blockNumber = await provider.getBlockNumber();
    if (!Number.isFinite(blockNumber)) {
      throw new Error('RPC responded with an invalid block number.');
    }
  } catch (error) {
    throw new Error(error?.message || 'RPC endpoint is not reachable.');
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
    gap: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  networkList: {
    borderWidth: 1,
    borderRadius: 24,
    overflow: 'hidden',
  },
  networkItem: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  networkContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  networkLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  networkRight: {
    minWidth: 40,
    alignItems: 'flex-end',
  },
  radioOuter: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  networkName: {
    fontSize: 16,
    fontWeight: '600',
  },
  networkDetail: {
    fontSize: 12,
  },
  customActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  editButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  deleteButton: {
    padding: 8,
    borderRadius: 14,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  pillText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  infoCard: {
    flexDirection: 'row',
    gap: 12,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 12,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 6,
    fontSize: 15,
  },
  warningCard: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  submitButton: {
    marginTop: 16,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

