// app/verify.js
// Verify Credentials and Create Presentations

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  StatusBar,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as secureStorage from '../services/secureStorage';
import * as didManager from '../services/didManager';
import { vcAPI, vpAPI } from '../services/api';
import logger from '../utils/logger';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

export default function VerifyScreen() {
  const [mode, setMode] = useState('create'); // 'create' or 'verify'
  const [credentials, setCredentials] = useState([]);
  const [selectedCredentials, setSelectedCredentials] = useState([]);
  const [walletInfo, setWalletInfo] = useState(null);
  const [challenge, setChallenge] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // For verification
  const [vpJwt, setVpJwt] = useState('');
  const [verificationResult, setVerificationResult] = useState(null);

 useFocusEffect(
  useCallback(() => {
    loadData();
  }, [])
);

  const loadData = async () => {
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

//   const createPresentation = async () => {
//     if (selectedCredentials.length === 0) {
//       Alert.alert('Error', 'Select at least one credential');
//       return;
//     }

//     if (!walletInfo?.did) {
//       Alert.alert('Error', 'No DID found');
//       return;
//     }

//     setIsProcessing(true);

//     try {
//       // Get selected credential IDs
//       const credentialIds = selectedCredentials;
      
//       // Generate challenge if empty
//       const challengeToUse = challenge || `challenge-${Date.now()}`;

//       // Create presentation
//       const result = await vpAPI.create(
//         walletInfo.did,
//         credentialIds,
//         challengeToUse
//       );

//       Alert.alert(
//         'Presentation Created',
//         `VP JWT created successfully!\n\nYou can now share this presentation.\n\nJWT: ${result.vpJwt.slice(0, 50)}...`,
//         [{ text: 'OK' }]
//       );

//       logger.success('Presentation created');
      
//       // Reset
//       setSelectedCredentials([]);
//       setChallenge('');

//     } catch (error) {
//       logger.error(`Failed to create presentation: ${error.message}`);
//       Alert.alert('Error', `Failed to create presentation: ${error.message}`);
//     } finally {
//       setIsProcessing(false);
//     }
//   };
// const createPresentation = async () => {
//   if (selectedCredentials.length === 0) {
//     Alert.alert('Error', 'Select at least one credential');
//     return;
//   }

//   if (!walletInfo?.did) {
//     Alert.alert('Error', 'No DID found');
//     return;
//   }

//   setIsProcessing(true);

//   try {
//     // Get the full credential objects (not just IDs)
//     const selectedCreds = credentials.filter(c => 
//       selectedCredentials.includes(c.id)
//     );

//     // Generate challenge if empty
//     const challengeToUse = challenge || `challenge-${Date.now()}`;

//     // Create presentation - send full credentials
//     const result = await vpAPI.create(
//       walletInfo.did,
//       selectedCreds, // Send full credential objects
//       challengeToUse
//     );

//     Alert.alert(
//       'Presentation Created',
//       `VP created successfully!\n\nJWT (first 50 chars):\n${result.vpJwt.slice(0, 50)}...`,
//       [
//         { text: 'Copy JWT', onPress: () => {
//           // You can add clipboard copy here if needed
//           logger.info(`VP JWT: ${result.vpJwt}`);
//         }},
//         { text: 'OK' }
//       ]
//     );

//     logger.success('Presentation created');
    
//     // Reset
//     setSelectedCredentials([]);
//     setChallenge('');

//   } catch (error) {
//     logger.error(`Failed to create presentation: ${error.message}`);
//     Alert.alert('Error', `Failed: ${error.message}`);
//   } finally {
//     setIsProcessing(false);
//   }
// };
const createPresentation = async () => {
  if (selectedCredentials.length === 0) {
    Alert.alert('Error', 'Select at least one credential');
    return;
  }

  if (!walletInfo?.did) {
    Alert.alert('Error', 'No DID found');
    return;
  }

  setIsProcessing(true);

  try {
    // Get the full credential objects
    const selectedCreds = credentials.filter(c => 
      selectedCredentials.includes(c.id)
    );

    // Generate challenge if empty
    const challengeToUse = challenge || `challenge-${Date.now()}`;

    // Create presentation
    const result = await vpAPI.create(
      walletInfo.did,
      selectedCreds,
      challengeToUse
    );

    // Copy to clipboard automatically
    await Clipboard.setStringAsync(result.vpJwt);

    Alert.alert(
      'Presentation Created',
      `VP JWT created and copied to clipboard!\n\nCredentials: ${selectedCreds.length}\nChallenge: ${challengeToUse}\n\nYou can now paste it in Verify mode or share with verifiers.`,
      [
        { 
          text: 'Verify Now', 
          onPress: () => {
            setMode('verify');
            setVpJwt(result.vpJwt);
            setChallenge(challengeToUse);
          }
        },
        { text: 'OK' }
      ]
    );

    logger.success('Presentation created and copied to clipboard');
    
    // Reset selection
    setSelectedCredentials([]);

  } catch (error) {
    logger.error(`Failed to create presentation: ${error.message}`);
    Alert.alert('Error', `Failed: ${error.message}`);
  } finally {
    setIsProcessing(false);
  }
};
  const verifyPresentation = async () => {
    if (!vpJwt.trim()) {
      Alert.alert('Error', 'Enter a VP JWT to verify');
      return;
    }

    setIsProcessing(true);
    setVerificationResult(null);

    try {
      const result = await vpAPI.verify(vpJwt, challenge || undefined);
      
      setVerificationResult(result);
      
      if (result.verified) {
        Alert.alert('Verified', 'Presentation is valid and verified!');
        logger.success('Presentation verified successfully');
      } else {
        Alert.alert('Invalid', 'Presentation verification failed');
        logger.error('Presentation verification failed');
      }

    } catch (error) {
      logger.error(`Verification error: ${error.message}`);
      Alert.alert('Error', `Verification failed: ${error.message}`);
      setVerificationResult({ verified: false, error: error.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const verifyCredential = async (credentialJwt) => {
    setIsProcessing(true);

    try {
      const result = await vcAPI.verify(credentialJwt);
      
      if (result.verified) {
        Alert.alert('Valid', 'Credential is valid and verified!');
      } else {
        Alert.alert('Invalid', 'Credential verification failed');
      }

    } catch (error) {
      Alert.alert('Error', `Verification failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const renderCreateMode = () => (
    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Select Credentials</Text>
        <Text style={styles.sectionSubtitle}>
          Choose credentials to include in the presentation
        </Text>

        {credentials.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No credentials in wallet</Text>
            <Text style={styles.emptySubtext}>Issue credentials first</Text>
          </View>
        ) : (
          credentials.map((credential) => {
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
                <View style={styles.credentialItemContent}>
                  <Text style={styles.credentialItemTitle}>
                    {credential.data.credentialType || 'Credential'}
                  </Text>
                  <Text style={styles.credentialItemDetail} numberOfLines={1}>
                    {Object.keys(credential.data)[0]}: {String(Object.values(credential.data)[0])}
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
          })
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Challenge/Nonce (Optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter challenge or leave empty"
          placeholderTextColor="#666"
          value={challenge}
          onChangeText={setChallenge}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.selectedCount}>
          {selectedCredentials.length} credential(s) selected
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.actionButton, { opacity: isProcessing ? 0.5 : 1 }]}
        onPress={createPresentation}
        disabled={isProcessing}
      >
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.actionButtonGradient}
        >
          <Text style={styles.actionButtonText}>
            {isProcessing ? 'Creating...' : '📋 Create Presentation'}
          </Text>
        </LinearGradient>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );

  const renderVerifyMode = () => (
    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Verify Presentation</Text>
        <Text style={styles.sectionSubtitle}>
          Paste a VP JWT to verify its authenticity
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Verifiable Presentation JWT</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Paste VP JWT here..."
          placeholderTextColor="#666"
          value={vpJwt}
          onChangeText={setVpJwt}
          multiline
          numberOfLines={4}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Challenge (Optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter challenge if used"
          placeholderTextColor="#666"
          value={challenge}
          onChangeText={setChallenge}
        />
      </View>

      {verificationResult && (
        <View style={styles.section}>
          <View style={[
            styles.resultCard,
            { backgroundColor: verificationResult.verified ? '#1a3a1a' : '#3a1a1a' }
          ]}>
            <Text style={[
              styles.resultTitle,
              { color: verificationResult.verified ? '#4ade80' : '#ef4444' }
            ]}>
              {verificationResult.verified ? '✓ Verified' : '✗ Invalid'}
            </Text>
            {verificationResult.error && (
              <Text style={styles.resultError}>{verificationResult.error}</Text>
            )}
          </View>
        </View>
      )}

      <TouchableOpacity
        style={[styles.actionButton, { opacity: isProcessing ? 0.5 : 1 }]}
        onPress={verifyPresentation}
        disabled={isProcessing}
      >
        <LinearGradient
          colors={['#4ade80', '#38f9d7']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.actionButtonGradient}
        >
          <Text style={styles.actionButtonText}>
            {isProcessing ? 'Verifying...' : '✓ Verify Presentation'}
          </Text>
        </LinearGradient>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Presentations</Text>
      </View>

      {/* Mode Switcher */}
      <View style={styles.modeSwitcher}>
        <TouchableOpacity
          style={[styles.modeButton, mode === 'create' && styles.modeButtonActive]}
          onPress={() => setMode('create')}
        >
          <Text style={[styles.modeButtonText, mode === 'create' && styles.modeButtonTextActive]}>
            Create
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeButton, mode === 'verify' && styles.modeButtonActive]}
          onPress={() => setMode('verify')}
        >
          <Text style={[styles.modeButtonText, mode === 'verify' && styles.modeButtonTextActive]}>
            Verify
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {mode === 'create' ? renderCreateMode() : renderVerifyMode()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  modeSwitcher: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 4,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
  },
  modeButtonActive: {
    backgroundColor: '#667eea',
  },
  modeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  modeButtonTextActive: {
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#888',
    marginBottom: 16,
  },
  credentialItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#2a2a3e',
  },
  credentialItemSelected: {
    borderColor: '#667eea',
    backgroundColor: '#1a1a3e',
  },
  credentialItemContent: {
    flex: 1,
  },
  credentialItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  credentialItemDetail: {
    fontSize: 13,
    color: '#888',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#666',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  label: {
    fontSize: 14,
    color: '#aaa',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#2a2a3e',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  selectedCount: {
    fontSize: 14,
    color: '#667eea',
    fontWeight: '600',
  },
  actionButton: {
    marginHorizontal: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  actionButtonGradient: {
    padding: 18,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#888',
    marginTop: 8,
  },
  resultCard: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  resultError: {
    fontSize: 14,
    color: '#ef4444',
  },
});