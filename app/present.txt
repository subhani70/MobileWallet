// app/present.jsx
// Enterprise SSI Wallet - Present Credentials

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  StatusBar,
  Share,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import * as secureStorage from '../services/secureStorage';
import * as didManager from '../services/didManager';
import * as vcService from '../services/vcService';
import logger from '../utils/logger';

export default function PresentScreen() {
  const [credentials, setCredentials] = useState([]);
  const [selectedCredentials, setSelectedCredentials] = useState([]);
  const [walletInfo, setWalletInfo] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    const hasWallet = await didManager.hasWallet();
    
    if (!hasWallet) {
      setCredentials([]);
      setWalletInfo(null);
      return;
    }

    const stored = await secureStorage.getCredentials();
    setCredentials(stored);
    
    const info = await didManager.getWalletInfo();
    setWalletInfo(info);
  };

  const toggleCredentialSelection = (credentialId) => {
    if (selectedCredentials.includes(credentialId)) {
      setSelectedCredentials(selectedCredentials.filter(id => id !== credentialId));
    } else {
      setSelectedCredentials([...selectedCredentials, credentialId]);
    }
  };

  const handleCreatePresentation = async () => {
    if (selectedCredentials.length === 0) {
      Alert.alert('No Selection', 'Please select at least one credential to present');
      return;
    }

    setIsProcessing(true);

    try {
      const selectedCreds = credentials.filter(c => 
        selectedCredentials.includes(c.id)
      );

      const result = await vcService.createPresentationLocally(
        selectedCreds,
        undefined // No challenge for now
      );

      // Copy to clipboard
      await Clipboard.setStringAsync(result.vpJwt);

      Alert.alert(
        '✅ Presentation Created',
        `Verifiable Presentation with ${selectedCreds.length} credential(s) has been created and copied to clipboard.\n\nYou can now share it with verifiers.`,
        [
          {
            text: 'Share',
            onPress: () => handleShare(result.vpJwt)
          },
          { text: 'Done' }
        ]
      );

      logger.success('Presentation created and copied');
      setSelectedCredentials([]);

    } catch (error) {
      logger.error(`Failed to create presentation: ${error.message}`);
      Alert.alert('Error', `Failed to create presentation: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleShare = async (vpJwt) => {
    try {
      await Share.share({
        message: vpJwt,
        title: 'Verifiable Presentation',
      });
    } catch (error) {
      logger.error('Share failed');
    }
  };

  if (!walletInfo) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🔐</Text>
          <Text style={styles.emptyTitle}>No Wallet Found</Text>
          <Text style={styles.emptySubtitle}>
            Create your wallet first from the Home tab
          </Text>
        </View>
      </View>
    );
  }

  if (credentials.length === 0) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Present Credentials</Text>
          <Text style={styles.headerSubtitle}>Share your verified credentials securely</Text>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📤</Text>
          <Text style={styles.emptyTitle}>No Credentials Yet</Text>
          <Text style={styles.emptySubtitle}>
            You need credentials to create presentations.{'\n'}
            Claim credentials from the Scan tab.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Create Presentation</Text>
        <Text style={styles.headerSubtitle}>
          Select credentials to share with verifiers
        </Text>
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Select Credentials ({selectedCredentials.length}/{credentials.length})
          </Text>

          {credentials.map((credential) => {
            const isSelected = selectedCredentials.includes(credential.id);
            return (
              <TouchableOpacity
                key={credential.id}
                style={[
                  styles.credentialItem,
                  isSelected && styles.credentialItemSelected
                ]}
                onPress={() => toggleCredentialSelection(credential.id)}
              >
                <View style={styles.credentialIcon}>
                  <Text style={styles.credentialIconText}>📜</Text>
                </View>
                
                <View style={styles.credentialContent}>
                  <Text style={styles.credentialTitle}>
                    {credential.data.credentialType || 'Credential'}
                  </Text>
                  <Text style={styles.credentialDetail} numberOfLines={1}>
                    {Object.keys(credential.data).slice(0, 2).map(key => 
                      `${key}: ${credential.data[key]}`
                    ).join(' • ')}
                  </Text>
                  <Text style={styles.credentialDate}>
                    Added: {new Date(credential.addedAt).toLocaleDateString()}
                  </Text>
                </View>

                <View style={[
                  styles.checkbox,
                  isSelected && styles.checkboxSelected
                ]}>
                  {isSelected && <Text style={styles.checkmark}>✓</Text>}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Fixed Bottom Button */}
      {selectedCredentials.length > 0 && (
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.createButton, { opacity: isProcessing ? 0.6 : 1 }]}
            onPress={handleCreatePresentation}
            disabled={isProcessing}
          >
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.createButtonGradient}
            >
              <Text style={styles.createButtonText}>
                {isProcessing ? 'Creating...' : `Create Presentation (${selectedCredentials.length})`}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 15,
    color: '#888',
    lineHeight: 22,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  credentialItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#2a2a3e',
  },
  credentialItemSelected: {
    borderColor: '#667eea',
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
  },
  credentialIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#2a2a3e',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  credentialIconText: {
    fontSize: 24,
  },
  credentialContent: {
    flex: 1,
  },
  credentialTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  credentialDetail: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  credentialDate: {
    fontSize: 11,
    color: '#666',
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#666',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  checkboxSelected: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  checkmark: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 30,
    backgroundColor: '#0a0a0f',
    borderTopWidth: 1,
    borderTopColor: '#2a2a3e',
  },
  createButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  createButtonGradient: {
    padding: 18,
    alignItems: 'center',
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#888',
    textAlign: 'center',
    lineHeight: 22,
  },
});