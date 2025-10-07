// app/index.js
// SSI Wallet Home Screen - Redesigned

import { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Alert,
  StatusBar 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { healthAPI } from '../services/api';
import * as didManager from '../services/didManager';
import * as secureStorage from '../services/secureStorage';
import * as biometric from '../services/biometric';
import logger from '../utils/logger';

export default function HomeScreen() {
  const [isConnected, setIsConnected] = useState(false);
  const [backendInfo, setBackendInfo] = useState(null);
  const [hasWallet, setHasWallet] = useState(false);
  const [walletInfo, setWalletInfo] = useState(null);
  const [isCreatingDID, setIsCreatingDID] = useState(false);
  const [logs, setLogs] = useState([]);

  const checkHealth = async () => {
    try {
      const response = await healthAPI.check();
      setIsConnected(true);
      setBackendInfo(response);
    } catch (err) {
      setIsConnected(false);
      setBackendInfo(null);
    } finally {
      setLogs(logger.getLogs());
    }
  };

  const checkWallet = async () => {
    try {
      const exists = await didManager.hasWallet();
      setHasWallet(exists);
      
      if (exists) {
        const info = await didManager.getWalletInfo();
        setWalletInfo(info);
      }
    } catch (err) {
      logger.error('Failed to check wallet');
    }
  };

  useEffect(() => {
    checkHealth();
    checkWallet();
    
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleCreateDID = async () => {
    Alert.alert(
      'Create Your Identity',
      'Generate a new Self-Sovereign Identity. Your private key will never leave this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Create', onPress: createDID },
      ]
    );
  };

  const createDID = async () => {
    setIsCreatingDID(true);
    
    try {
      const result = await didManager.createLocalDID();
      setHasWallet(true);
      setWalletInfo(result);
      
      Alert.alert(
        '✅ Identity Created',
        `Your DID:\n${result.did}\n\nRegistered on blockchain!`,
        [{ text: 'OK' }]
      );
    } catch (err) {
      Alert.alert('Error', 'Failed to create DID. Please try again.');
    } finally {
      setIsCreatingDID(false);
      setLogs(logger.getLogs());
    }
  };

  const handleClearWallet = async () => {
    Alert.alert(
      '⚠️ Clear Wallet',
      'This will delete your DID and all data. Cannot be undone!',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await secureStorage.clearWallet();
            setHasWallet(false);
            setWalletInfo(null);
            setLogs(logger.getLogs());
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Self-Sovereign</Text>
          <Text style={styles.heroTitle}>Identity Wallet</Text>
          <Text style={styles.heroSubtitle}>
            Your keys. Your identity. Your control.
          </Text>
        </View>

        {/* Connection Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <View style={[
              styles.statusDot, 
              { backgroundColor: isConnected ? '#4ade80' : '#ef4444' }
            ]} />
            <Text style={[
              styles.statusText,
              { color: isConnected ? '#4ade80' : '#ef4444' }
            ]}>
              {isConnected ? 'Connected' : 'Offline'}
            </Text>
          </View>
          {isConnected && backendInfo && (
            <Text style={styles.blockchainText}>⛓️ Blockchain Active</Text>
          )}
        </View>

        {/* DID Card or Create Button */}
        {hasWallet ? (
          <LinearGradient
            colors={['#667eea', '#764ba2']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.didCard}
          >
            <Text style={styles.didLabel}>YOUR IDENTITY</Text>
            <Text style={styles.didValue} numberOfLines={1}>
              {walletInfo?.did}
            </Text>
            <View style={styles.didFooter}>
              <View>
                <Text style={styles.didAddressLabel}>Address</Text>
                <Text style={styles.didAddress}>
                  {walletInfo?.address?.slice(0, 10)}...{walletInfo?.address?.slice(-8)}
                </Text>
              </View>
              <View style={styles.didBadge}>
                <Text style={styles.didBadgeText}>✓ VERIFIED</Text>
              </View>
            </View>
          </LinearGradient>
        ) : (
          <TouchableOpacity
            style={[styles.createButton, { opacity: isCreatingDID ? 0.5 : 1 }]}
            onPress={handleCreateDID}
            disabled={isCreatingDID}
          >
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.createButtonGradient}
            >
              <Text style={styles.createButtonIcon}>🆔</Text>
              <Text style={styles.createButtonText}>
                {isCreatingDID ? 'Creating...' : 'Create Your Identity'}
              </Text>
              <Text style={styles.createButtonSubtext}>
                Generate DID on this device
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Quick Actions */}
        {hasWallet && (
          <View style={styles.quickActions}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.actionsGrid}>
              <TouchableOpacity style={styles.actionCard}>
                <Text style={styles.actionIcon}>📜</Text>
                <Text style={styles.actionText}>Issue Credential</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionCard}>
                <Text style={styles.actionIcon}>📤</Text>
                <Text style={styles.actionText}>Share</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionCard}>
                <Text style={styles.actionIcon}>✅</Text>
                <Text style={styles.actionText}>Verify</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.actionCard}
                onPress={handleClearWallet}
              >
                <Text style={styles.actionIcon}>🗑️</Text>
                <Text style={styles.actionText}>Reset</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Activity Log */}
        <View style={styles.activitySection}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          {logs.slice(0, 5).map((log) => (
            <View key={log.id} style={styles.logItem}>
              <View style={[
                styles.logDot,
                { backgroundColor: 
                  log.type === 'error' ? '#ef4444' : 
                  log.type === 'success' ? '#4ade80' : '#888' 
                }
              ]} />
              <View style={styles.logContent}>
                <Text style={styles.logMessage} numberOfLines={2}>
                  {log.message}
                </Text>
                <Text style={styles.logTime}>{log.timestamp}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  scrollView: {
    flex: 1,
  },
  hero: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 30,
  },
  heroTitle: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: -1,
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#888',
    marginTop: 12,
    lineHeight: 24,
  },
  statusCard: {
    marginHorizontal: 20,
    padding: 16,
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2a2a3e',
    marginBottom: 20,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
  },
  blockchainText: {
    fontSize: 13,
    color: '#888',
    marginTop: 8,
  },
  didCard: {
    marginHorizontal: 20,
    padding: 24,
    borderRadius: 20,
    marginBottom: 30,
  },
  didLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
    letterSpacing: 1,
    marginBottom: 12,
  },
  didValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  didFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  didAddressLabel: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 4,
  },
  didAddress: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
  },
  didBadge: {
    backgroundColor: 'rgba(74, 222, 128, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  didBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#4ade80',
  },
  createButton: {
    marginHorizontal: 20,
    marginBottom: 30,
    borderRadius: 20,
    overflow: 'hidden',
  },
  createButtonGradient: {
    padding: 32,
    alignItems: 'center',
  },
  createButtonIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  createButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  createButtonSubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  quickActions: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  actionCard: {
    width: '48%',
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 20,
    margin: '1%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  actionIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  actionText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  activitySection: {
    paddingHorizontal: 20,
  },
  logItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a2e',
  },
  logDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
    marginRight: 12,
  },
  logContent: {
    flex: 1,
  },
  logMessage: {
    fontSize: 13,
    color: '#ccc',
    marginBottom: 4,
  },
  logTime: {
    fontSize: 11,
    color: '#666',
  },
});