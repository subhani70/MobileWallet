// wallet/app/verify.js
// ENHANCED: Auto-submit to verifier (no manual copy-paste!)

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  StatusBar,
  TextInput,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Clipboard from 'expo-clipboard';
import * as secureStorage from '../services/secureStorage';
import * as didManager from '../services/didManager';
import { vpAPI } from '../services/api';
import logger from '../utils/logger';
import * as vcService from '../services/vcService';

// 🔧 IMPORTANT: Change this to your computer's IP address!
const API_BASE_URL = 'http://172.16.10.117:5000'; // ← UPDATE THIS!

export default function EnhancedVerifyScreen() {
  const [mode, setMode] = useState('create');
  const [credentials, setCredentials] = useState([]);
  const [selectedCredentials, setSelectedCredentials] = useState([]);
  const [walletInfo, setWalletInfo] = useState(null);
  const [challenge, setChallenge] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Verification mode states
  const [vpJwt, setVpJwt] = useState('');
  const [verificationResult, setVerificationResult] = useState(null);

  // Scanner mode states
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [verificationRequest, setVerificationRequest] = useState(null);
  const [showScanner, setShowScanner] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    const hasWallet = await didManager.hasWallet();

    if (!hasWallet) {
      setCredentials([]);
      setSelectedCredentials([]);
      setWalletInfo(null);
      return;
    }

    const stored = await secureStorage.getCredentials();
    setCredentials(stored);

    const info = await didManager.getWalletInfo();
    setWalletInfo(info);
  };

  // ============================================
  // QR SCANNER FOR VERIFICATION REQUESTS
  // ============================================
  const handleScanRequest = async ({ data }) => {
    if (scanned || isProcessing) return;

    setScanned(true);
    setIsProcessing(true);

    try {
      const request = JSON.parse(data);

      logger.info('📷 Verification request scanned');

      if (request.type !== 'PRESENTATION_REQUEST') {
        throw new Error('Invalid QR code. Not a verification request.');
      }

      logger.info('📋 Verification Request Details:');
      logger.info(`   Verifier: ${request.verifierName || 'Unknown'}`);
      logger.info(`   Challenge: ${request.challenge}`);

      setVerificationRequest(request);
      setChallenge(request.challenge);
      setShowScanner(false);
      setMode('create');
      setIsProcessing(false);

      Alert.alert(
        '📋 Verification Request',
        `${request.verifierName || 'A verifier'} is requesting credentials.\n\nPurpose: ${request.purpose || 'Verification'}\n\nSelect credentials to share and tap "Create Presentation".`,
        [{ text: 'OK' }]
      );

    } catch (error) {
      logger.error('Failed to parse verification request: ' + error.message);
      Alert.alert(
        '❌ Invalid QR Code',
        error.message,
        [
          {
            text: 'OK',
            onPress: () => {
              setScanned(false);
              setIsProcessing(false);
            }
          }
        ]
      );
    }
  };

  const openScanner = () => {
    if (!permission?.granted) {
      Alert.alert(
        'Camera Permission',
        'Camera access is required to scan verification requests',
        [
          { text: 'Cancel' },
          { text: 'Grant', onPress: requestPermission }
        ]
      );
      return;
    }
    setShowScanner(true);
    setScanned(false);
    setIsProcessing(false);
  };

  // ============================================
  // CREDENTIAL SELECTION
  // ============================================
  const toggleCredentialSelection = (credentialId) => {
    if (selectedCredentials.includes(credentialId)) {
      setSelectedCredentials(selectedCredentials.filter(id => id !== credentialId));
    } else {
      setSelectedCredentials([...selectedCredentials, credentialId]);
    }
  };

  // ============================================
  // CREATE PRESENTATION - WITH AUTO-SUBMIT!
  // ============================================
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
      const selectedCreds = credentials.filter(c =>
        selectedCredentials.includes(c.id)
      );

      const challengeToUse = challenge.trim() || undefined;

      logger.info('📋 Creating presentation...');
      logger.info(`   Credentials: ${selectedCreds.length}`);
      if (challengeToUse) {
        logger.info(`   Challenge: ${challengeToUse}`);
      }

      // Create VP locally
      const result = await vcService.createPresentationLocally(
        selectedCreds,
        challengeToUse
      );

      // Always copy to clipboard as backup
      await Clipboard.setStringAsync(result.vpJwt);

      // 🚀 AUTO-SUBMIT: If this is a response to a verification request
      if (verificationRequest && verificationRequest.id) {
        logger.info('📤 Auto-submitting to verifier...');

        try {
          const submitResponse = await fetch(`${API_BASE_URL}/verifier/submit-response`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId: verificationRequest.id,
              vpJwt: result.vpJwt
            })
          });

          const submitResult = await submitResponse.json();

          if (submitResult.success && submitResult.verified) {
            logger.success('✅ Presentation verified by verifier!');

            Alert.alert(
              '✅ Success!',
              `Your credentials have been automatically submitted to ${verificationRequest.verifierName}!\n\nVerification Status: ✅ Verified\n\n(VP JWT also copied to clipboard as backup)`,
              [{ text: 'OK' }]
            );
          } else {
            throw new Error(submitResult.error || 'Verification failed');
          }

        } catch (submitError) {
          logger.error('Auto-submit failed: ' + submitError.message);

          Alert.alert(
            '⚠️ Manual Share Required',
            `Automatic submission failed.\n\nVP JWT has been copied to clipboard.\n\nPlease share it manually with ${verificationRequest.verifierName}.`,
            [{ text: 'OK' }]
          );
        }
      } else {
        // Manual VP creation (no verification request)
        Alert.alert(
          '✅ Presentation Created!',
          `Credentials: ${selectedCreds.length}${challengeToUse ? `\nChallenge: ${challengeToUse}` : ''}\n\nVP JWT copied to clipboard!\n\nShare it with the verifier or verify it yourself.`,
          [
            {
              text: 'Verify Now',
              onPress: () => {
                setMode('verify');
                setVpJwt(result.vpJwt);
              }
            },
            { text: 'OK' }
          ]
        );
      }

      logger.success('✅ Presentation created');

      // Clear selections
      setSelectedCredentials([]);
      setVerificationRequest(null);
      setChallenge('');

    } catch (error) {
      logger.error(`Failed to create presentation: ${error.message}`);
      Alert.alert('Error', `Failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // ============================================
  // VERIFY PRESENTATION
  // ============================================
  const verifyPresentation = async () => {
    if (!vpJwt.trim()) {
      Alert.alert('Error', 'Enter a VP JWT to verify');
      return;
    }

    setIsProcessing(true);
    setVerificationResult(null);

    try {
      const challengeToUse = challenge.trim() || undefined;

      logger.info('🔍 Verifying presentation...');

      const result = await vpAPI.verify(vpJwt, challengeToUse);

      setVerificationResult(result);

      if (result.verified) {
        Alert.alert('✅ Verified', 'Presentation is valid!');
        logger.success('✅ Presentation verified');
      } else {
        Alert.alert('❌ Invalid', 'Verification failed');
        logger.error('❌ Verification failed');
      }

    } catch (error) {
      logger.error(`Verification error: ${error.message}`);
      Alert.alert('Error', `Verification failed: ${error.message}`);
      setVerificationResult({ verified: false, error: error.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const clearVerifyForm = () => {
    setVpJwt('');
    setChallenge('');
    setVerificationResult(null);
    setVerificationRequest(null);
  };

  // ============================================
  // RENDER CREATE MODE
  // ============================================
  const renderCreateMode = () => (
    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
      {/* Verification Request Info */}
      {verificationRequest && (
        <View style={styles.requestCard}>
          <Text style={styles.requestTitle}>📋 Responding to Request</Text>
          <View style={styles.requestRow}>
            <Text style={styles.requestLabel}>Verifier:</Text>
            <Text style={styles.requestValue}>{verificationRequest.verifierName}</Text>
          </View>
          <View style={styles.requestRow}>
            <Text style={styles.requestLabel}>Purpose:</Text>
            <Text style={styles.requestValue}>{verificationRequest.purpose || 'Verification'}</Text>
          </View>
        </View>
      )}

      {!walletInfo ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No wallet found</Text>
          <Text style={styles.emptySubtext}>Create your identity first</Text>
        </View>
      ) : (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select Credentials</Text>
            <Text style={styles.sectionSubtitle}>
              Choose credentials to share
            </Text>

            {credentials.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No credentials</Text>
                <Text style={styles.emptySubtext}>Receive credentials first</Text>
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

          {!verificationRequest && (
            <View style={styles.section}>
              <Text style={styles.label}>Challenge (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Leave empty for no challenge"
                placeholderTextColor="#666"
                value={challenge}
                onChangeText={setChallenge}
              />
            </View>
          )}

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

          {/* Scan Verification Request Button */}
          <TouchableOpacity
            style={styles.scanButton}
            onPress={openScanner}
          >
            <Text style={styles.scanButtonText}>📷 Scan Verification Request</Text>
          </TouchableOpacity>
        </>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );

  // ============================================
  // RENDER VERIFY MODE
  // ============================================
  const renderVerifyMode = () => (
    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Verify Presentation</Text>
        <Text style={styles.sectionSubtitle}>
          Paste a VP JWT to verify
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>VP JWT</Text>
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
          placeholder="Leave empty if no challenge"
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
            {isProcessing ? 'Verifying...' : '🔍 Verify'}
          </Text>
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.clearButton}
        onPress={clearVerifyForm}
      >
        <Text style={styles.clearButtonText}>Clear</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

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

      {mode === 'create' ? renderCreateMode() : renderVerifyMode()}

      {/* Scanner Modal */}
      <Modal
        visible={showScanner}
        animationType="slide"
        onRequestClose={() => setShowScanner(false)}
      >
        <View style={styles.scannerContainer}>
          <View style={styles.scannerHeader}>
            <Text style={styles.scannerTitle}>Scan Verification Request</Text>
            <TouchableOpacity onPress={() => setShowScanner(false)}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <CameraView
            style={styles.camera}
            facing="back"
            onBarcodeScanned={scanned ? undefined : handleScanRequest}
            barcodeScannerSettings={{
              barcodeTypes: ['qr'],
            }}
          >
            <View style={styles.overlay}>
              <View style={styles.scanArea}>
                <View style={[styles.corner, styles.topLeft]} />
                <View style={[styles.corner, styles.topRight]} />
                <View style={[styles.corner, styles.bottomLeft]} />
                <View style={[styles.corner, styles.bottomRight]} />
              </View>
            </View>
          </CameraView>

          <View style={styles.scannerInstructions}>
            <Text style={styles.scannerInstructionText}>
              Point camera at verifier's QR code
            </Text>
          </View>
        </View>
      </Modal>
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
  requestCard: {
    backgroundColor: '#1a2a3a',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#2a4a5a',
  },
  requestTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4ade80',
    marginBottom: 12,
  },
  requestRow: {
    marginBottom: 8,
  },
  requestLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  requestValue: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
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
    marginBottom: 12,
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
  scanButton: {
    marginHorizontal: 20,
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#2a2a3e',
  },
  scanButtonText: {
    color: '#667eea',
    fontSize: 16,
    fontWeight: '600',
  },
  clearButton: {
    marginHorizontal: 20,
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
  },
  clearButtonText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
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
  scannerContainer: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  scannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  scannerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeText: {
    fontSize: 32,
    color: '#fff',
    fontWeight: 'bold',
  },
  camera: {
    flex: 1,
    margin: 20,
    borderRadius: 20,
    overflow: 'hidden',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanArea: {
    width: 250,
    height: 250,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#667eea',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 10,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 10,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 10,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 10,
  },
  scannerInstructions: {
    padding: 20,
    backgroundColor: '#1a1a2e',
  },
  scannerInstructionText: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
  },
});