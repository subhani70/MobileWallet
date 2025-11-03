// wallet-app/app/verify.js
// Presentation Creation Only (No Manual JWT Verification)

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  StatusBar,
  Modal,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Clipboard from 'expo-clipboard';
import * as secureStorage from '../services/secureStorage';
import * as didManager from '../services/didManager';
import logger from '../utils/logger';
import * as vcService from '../services/vcService';

const API_BASE_URL = 'https://icbhyhmetd.execute-api.ap-south-1.amazonaws.com/';

export default function VerifyScreen() {
  const [credentials, setCredentials] = useState([]);
  const [selectedCredentials, setSelectedCredentials] = useState([]);
  const [walletInfo, setWalletInfo] = useState(null);
  const [challenge, setChallenge] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Scanner states
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [verificationRequest, setVerificationRequest] = useState(null);
  const [showScanner, setShowScanner] = useState(false);

  // Selective disclosure states
  const [showFieldSelector, setShowFieldSelector] = useState(false);
  const [selectedCredential, setSelectedCredential] = useState(null);
  const [selectedFields, setSelectedFields] = useState({});

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
  // SCAN VERIFICATION REQUEST
  // ============================================
  const handleScanRequest = async ({ data }) => {
    if (scanned || isProcessing) return;

    setScanned(true);
    setIsProcessing(true);

    try {
      const request = JSON.parse(data);

      if (request.type !== 'PRESENTATION_REQUEST') {
        throw new Error('Invalid QR code. Not a verification request.');
      }

      setVerificationRequest(request);
      setChallenge(request.challenge);
      setShowScanner(false);
      setIsProcessing(false);

      // Show credential selector
      if (credentials.length === 1) {
        handleCredentialSelection(credentials[0]);
      } else if (credentials.length > 1) {
        Alert.alert(
          '📋 Verification Request',
          `${request.verifierName || 'A verifier'} is requesting credentials.\n\nSelect which credential to share.`,
          [{ text: 'OK' }]
        );
      } else {
        throw new Error('No credentials found in wallet');
      }

    } catch (error) {
      logger.error('Failed to parse verification request: ' + error.message);
      Alert.alert('❌ Invalid QR Code', error.message, [
        {
          text: 'OK',
          onPress: () => {
            setScanned(false);
            setIsProcessing(false);
          }
        }
      ]);
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
  // CREDENTIAL & FIELD SELECTION
  // ============================================
  const toggleCredentialSelection = (credentialId) => {
    if (selectedCredentials.includes(credentialId)) {
      setSelectedCredentials(selectedCredentials.filter(id => id !== credentialId));
    } else {
      setSelectedCredentials([...selectedCredentials, credentialId]);
    }
  };

  const handleCredentialSelection = (credential) => {
    setSelectedCredential(credential);

    // Initialize all fields as selected by default
    const allFields = {};
    Object.keys(credential.data || {}).forEach(key => {
      allFields[key] = true;
    });
    setSelectedFields(allFields);

    setShowFieldSelector(true);
  };

  const toggleFieldSelection = (fieldKey) => {
    setSelectedFields(prev => ({
      ...prev,
      [fieldKey]: !prev[fieldKey]
    }));
  };

  const selectAllFields = () => {
    const allFields = {};
    Object.keys(selectedCredential.data || {}).forEach(key => {
      allFields[key] = true;
    });
    setSelectedFields(allFields);
  };

  const deselectAllFields = () => {
    setSelectedFields({});
  };

  // ============================================
  // CREATE STANDARD PRESENTATION (Full Credentials)
  // ============================================
  const createStandardPresentation = async () => {
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

      logger.info('📋 Creating standard presentation...');
      logger.info(`   Credentials: ${selectedCreds.length}`);
      if (challengeToUse) {
        logger.info(`   Challenge: ${challengeToUse}`);
      }

      // Create full VP (all fields)
      const result = await vcService.createPresentationLocally(
        selectedCreds,
        challengeToUse
      );

      await Clipboard.setStringAsync(result.vpJwt);

      // Auto-submit if verification request exists
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
              `Your credentials have been automatically submitted!\n\n(Full credentials shared)\n\nVP JWT also copied to clipboard.`,
              [{ text: 'OK' }]
            );
          } else {
            throw new Error(submitResult.error || 'Verification failed');
          }

        } catch (submitError) {
          logger.error('Auto-submit failed: ' + submitError.message);
          Alert.alert(
            '⚠️ Manual Share Required',
            `VP JWT copied to clipboard.\n\nPlease share it manually.`,
            [{ text: 'OK' }]
          );
        }
      } else {
        Alert.alert(
          '✅ Presentation Created!',
          `Full credentials (${selectedCreds.length}) shared.\n\nVP JWT copied to clipboard!`,
          [{ text: 'OK' }]
        );
      }

      logger.success('✅ Standard presentation created');
      setSelectedCredentials([]);
      setVerificationRequest(null);

    } catch (error) {
      logger.error(`Failed to create presentation: ${error.message}`);
      Alert.alert('Error', `Failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // ============================================
  // CREATE SELECTIVE PRESENTATION (Selected Fields Only)
  // ============================================
  const createSelectivePresentation = async () => {
    const selectedFieldKeys = Object.keys(selectedFields).filter(
      key => selectedFields[key]
    );

    if (selectedFieldKeys.length === 0) {
      Alert.alert('Error', 'Select at least one field to share');
      return;
    }

    setIsProcessing(true);

    try {
      const filteredData = {};
      selectedFieldKeys.forEach(key => {
        filteredData[key] = selectedCredential.data[key];
      });

      const selectiveCredential = {
        ...selectedCredential,
        data: filteredData
      };

      const totalFields = Object.keys(selectedCredential.data).length;
      logger.info('📋 Creating presentation...');
      logger.info(`   Sharing ${selectedFieldKeys.length} of ${totalFields} fields`);

      const challengeToUse = verificationRequest?.challenge || challenge.trim() || undefined;

      const result = await vcService.createSelectivePresentation(
        [selectiveCredential],
        challengeToUse,
        [selectedCredential]
      );

      await Clipboard.setStringAsync(result.vpJwt);

      // Auto-submit
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
            logger.success('✅ Presentation verified!');

            const isSelective = selectedFieldKeys.length < totalFields;
            const message = isSelective
              ? `You shared ${selectedFieldKeys.length} of ${totalFields} fields:\n\n${selectedFieldKeys.map(k => `• ${k}`).join('\n')}\n\nThe verifier can only see these fields.`
              : `You shared all ${totalFields} fields from this credential.`;

            Alert.alert('✅ Shared Successfully!', message, [{ text: 'OK' }]);
          } else {
            throw new Error(submitResult.error || 'Verification failed');
          }

        } catch (submitError) {
          logger.error('Auto-submit failed: ' + submitError.message);
          Alert.alert(
            '⚠️ Manual Share Required',
            `VP JWT copied to clipboard.`,
            [{ text: 'OK' }]
          );
        }
      } else {
        Alert.alert(
          '✅ Presentation Created!',
          `Shared ${selectedFieldKeys.length} fields.\n\nVP JWT copied to clipboard!`,
          [{ text: 'OK' }]
        );
      }

      logger.success('✅ Presentation created');
      setShowFieldSelector(false);
      setSelectedCredential(null);
      setSelectedFields({});
      setVerificationRequest(null);

    } catch (error) {
      logger.error(`Failed to create presentation: ${error.message}`);
      Alert.alert('Error', `Failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // ============================================
  // RENDER FIELD SELECTOR MODAL
  // ============================================
  const renderFieldSelector = () => {
    if (!selectedCredential) return null;

    const allFields = Object.entries(selectedCredential.data || {});
    const selectedCount = Object.values(selectedFields).filter(v => v).length;

    return (
      <Modal
        visible={showFieldSelector}
        animationType="slide"
        onRequestClose={() => setShowFieldSelector(false)}
      >
        <View style={styles.modalContainer}>
          <StatusBar barStyle="light-content" />

          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Select Fields to Share</Text>
              <Text style={styles.modalSubtitle}>
                {selectedCount} of {allFields.length} fields selected
              </Text>
            </View>
            <TouchableOpacity onPress={() => setShowFieldSelector(false)}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {verificationRequest && (
            <View style={styles.requestInfoCard}>
              <Text style={styles.requestInfoTitle}>📋 Verification Request</Text>
              <Text style={styles.requestInfoText}>
                From: {verificationRequest.verifierName}
              </Text>
              <Text style={styles.requestInfoText}>
                Purpose: {verificationRequest.purpose}
              </Text>
            </View>
          )}

          <View style={styles.privacyNotice}>
            <Text style={styles.privacyIcon}>🔒</Text>
            <View style={styles.privacyContent}>
              <Text style={styles.privacyTitle}>Selective Disclosure</Text>
              <Text style={styles.privacyText}>
                Share only what's necessary. The verifier will ONLY see the fields you select.
              </Text>
            </View>
          </View>

          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={selectAllFields}
            >
              <Text style={styles.quickActionText}>✓ Select All</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={deselectAllFields}
            >
              <Text style={styles.quickActionText}>✗ Deselect All</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.fieldList} showsVerticalScrollIndicator={false}>
            {allFields.map(([key, value]) => (
              <TouchableOpacity
                key={key}
                style={[
                  styles.fieldItem,
                  selectedFields[key] && styles.fieldItemSelected
                ]}
                onPress={() => toggleFieldSelection(key)}
              >
                <View style={styles.fieldItemContent}>
                  <Text style={styles.fieldKey}>{key}</Text>
                  <Text style={styles.fieldValue} numberOfLines={2}>
                    {String(value)}
                  </Text>
                </View>
                <View style={[
                  styles.fieldCheckbox,
                  selectedFields[key] && styles.fieldCheckboxSelected
                ]}>
                  {selectedFields[key] && (
                    <Text style={styles.fieldCheckmark}>✓</Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.shareButton, { opacity: isProcessing ? 0.5 : 1 }]}
              onPress={createSelectivePresentation}
              disabled={isProcessing || selectedCount === 0}
            >
              <LinearGradient
                colors={['#4ade80', '#38f9d7']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.shareButtonGradient}
              >
                <Text style={styles.shareButtonText}>
                  {isProcessing ? 'Sharing...' : `📤 Share ${selectedCount} Field${selectedCount !== 1 ? 's' : ''}`}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  // ============================================
  // MAIN RENDER
  // ============================================
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Share Credentials</Text>
        <Text style={styles.headerSubtitle}>
          Create presentations to share with verifiers
        </Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
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
                Choose credentials to share (tap for selective disclosure)
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
                    <View key={credential.id} style={styles.credentialItemWrapper}>
                      <TouchableOpacity
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

                      {/* Selective Disclosure Button */}
                      <TouchableOpacity
                        style={styles.selectiveButton}
                        onPress={() => handleCredentialSelection(credential)}
                      >
                        <Text style={styles.selectiveButtonText}>
                          🔒 Select Fields
                        </Text>
                      </TouchableOpacity>
                    </View>
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
              onPress={createStandardPresentation}
              disabled={isProcessing}
            >
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.actionButtonGradient}
              >
                <Text style={styles.actionButtonText}>
                  {isProcessing ? 'Creating...' : '📋 Share Full Credentials'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

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

      {/* Field Selector Modal */}
      {renderFieldSelector()}

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
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
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
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#888',
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
  credentialItemWrapper: {
    marginBottom: 12,
  },
  credentialItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
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
  selectiveButton: {
    backgroundColor: '#1a2a1a',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#2a5a2a',
  },
  selectiveButtonText: {
    color: '#4ade80',
    fontSize: 13,
    fontWeight: '600',
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
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#888',
  },
  closeText: {
    fontSize: 32,
    color: '#fff',
    fontWeight: 'bold',
  },
  requestInfoCard: {
    backgroundColor: '#1a2a3a',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#2a4a5a',
  },
  requestInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4ade80',
    marginBottom: 8,
  },
  requestInfoText: {
    fontSize: 13,
    color: '#aaa',
    marginBottom: 4,
  },
  privacyNotice: {
    flexDirection: 'row',
    backgroundColor: '#1a3a1a',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2a5a2a',
  },
  privacyIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  privacyContent: {
    flex: 1,
  },
  privacyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4ade80',
    marginBottom: 4,
  },
  privacyText: {
    fontSize: 12,
    color: '#aaa',
    lineHeight: 18,
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 12,
  },
  quickActionButton: {
    flex: 1,
    padding: 12,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  quickActionText: {
    color: '#667eea',
    fontSize: 14,
    fontWeight: '600',
  },
  fieldList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  fieldItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#2a2a3e',
  },
  fieldItemSelected: {
    borderColor: '#4ade80',
    backgroundColor: '#1a2a1a',
  },
  fieldItemContent: {
    flex: 1,
  },
  fieldKey: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 6,
    textTransform: 'capitalize',
  },
  fieldValue: {
    fontSize: 13,
    color: '#888',
  },
  fieldCheckbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#666',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  fieldCheckboxSelected: {
    backgroundColor: '#4ade80',
    borderColor: '#4ade80',
  },
  fieldCheckmark: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#2a2a3e',
  },
  shareButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  shareButtonGradient: {
    padding: 18,
    alignItems: 'center',
  },
  shareButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  // Scanner styles
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