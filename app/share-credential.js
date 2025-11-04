// app/share-credential.js
// Share Credential Screen - Production Ready with QR Scanning

import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  StatusBar,
  Modal,
  TextInput,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ArrowLeft, CheckCircle2, Share2, Shield, QrCode, FileText } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import * as secureStorage from '../services/secureStorage';
import * as didManager from '../services/didManager';
import logger from '../utils/logger';
import * as vcService from '../services/vcService';

const API_BASE_URL = 'https://icbhyhmetd.execute-api.ap-south-1.amazonaws.com/';

export default function ShareCredentialScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
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

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadData();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

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

    // If a specific credential ID is passed, select it
    if (params.credentialId) {
      const cred = stored.find(c => c.id === params.credentialId);
      if (cred) {
        setSelectedCredentials([cred.id]);
      }
    }
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
      setChallenge(request.challenge || '');
      setShowScanner(false);
      setIsProcessing(false);

      Alert.alert(
        '📋 Verification Request',
        `${request.verifierName || 'A verifier'} is requesting credentials.\n\nSelect credentials to share.`,
        [{ text: 'OK' }]
      );

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

      const challengeToUse = verificationRequest?.challenge || challenge.trim() || undefined;

      logger.info('📋 Creating standard presentation...');
      logger.info(`   Credentials: ${selectedCreds.length}`);

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
              [{ text: 'OK', onPress: () => router.back() }]
            );
          } else {
            throw new Error(submitResult.error || 'Verification failed');
          }

        } catch (submitError) {
          logger.error('Auto-submit failed: ' + submitError.message);
          Alert.alert(
            '⚠️ Manual Share Required',
            `VP JWT copied to clipboard.\n\nPlease share it manually.`,
            [{ text: 'OK', onPress: () => router.back() }]
          );
        }
      } else {
        Alert.alert(
          '✅ Presentation Created!',
          `Full credentials (${selectedCreds.length}) shared.\n\nVP JWT copied to clipboard!`,
          [{ text: 'OK', onPress: () => router.back() }]
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
      logger.info('📋 Creating selective presentation...');
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
              ? `You shared ${selectedFieldKeys.length} of ${totalFields} fields:\n\n${selectedFieldKeys.map(k => `• ${k.replace(/_/g, ' ')}`).join('\n')}\n\nThe verifier can only see these fields.`
              : `You shared all ${totalFields} fields from this credential.`;

            Alert.alert('✅ Shared Successfully!', `${message}\n\nVP JWT copied to clipboard.`, [{ 
              text: 'OK',
              onPress: () => {
                setShowFieldSelector(false);
                setSelectedCredential(null);
                setSelectedFields({});
                router.back();
              }
            }]);
          } else {
            throw new Error(submitResult.error || 'Verification failed');
          }

        } catch (submitError) {
          logger.error('Auto-submit failed: ' + submitError.message);
          Alert.alert(
            '⚠️ Manual Share Required',
            `VP JWT copied to clipboard.`,
            [{ text: 'OK', onPress: () => router.back() }]
          );
        }
      } else {
        const isSelective = selectedFieldKeys.length < totalFields;
        const message = isSelective
          ? `You shared ${selectedFieldKeys.length} of ${totalFields} fields.`
          : `You shared all ${totalFields} fields.`;

        Alert.alert(
          '✅ Presentation Created!',
          `${message}\n\nVP JWT copied to clipboard!`,
          [{ 
            text: 'OK',
            onPress: () => {
              setShowFieldSelector(false);
              setSelectedCredential(null);
              setSelectedFields({});
              router.back();
            }
          }]
        );
      }

      logger.success('✅ Selective presentation created');

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
        <SafeAreaView style={styles.modalContainer}>
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
                From: {verificationRequest.verifierName || 'Unknown Verifier'}
              </Text>
              {verificationRequest.purpose && (
                <Text style={styles.requestInfoText}>
                  Purpose: {verificationRequest.purpose}
                </Text>
              )}
            </View>
          )}

          <View style={styles.privacyNotice}>
            <Shield color="#10B981" size={24} />
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
                  <Text style={styles.fieldKey}>
                    {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </Text>
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
                colors={['#06B6D4', '#8B5CF6']}
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
        </SafeAreaView>
      </Modal>
    );
  };

  // Format credential for display
  const formatCredentialTitle = (credential) => {
    const data = credential.data || {};
    const keys = Object.keys(data);
    if (keys.length > 0) {
      return keys[0].replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    return 'Credential';
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft color="#FFFFFF" size={24} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Share Credential</Text>
          <Text style={styles.headerSubtitle}>
            Create a verifiable presentation
          </Text>
        </View>
      </Animated.View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {verificationRequest && (
          <View style={styles.requestCard}>
            <Text style={styles.requestTitle}>📋 Responding to Request</Text>
            <View style={styles.requestRow}>
              <Text style={styles.requestLabel}>Verifier:</Text>
              <Text style={styles.requestValue}>{verificationRequest.verifierName || 'Unknown'}</Text>
            </View>
            {verificationRequest.purpose && (
              <View style={styles.requestRow}>
                <Text style={styles.requestLabel}>Purpose:</Text>
                <Text style={styles.requestValue}>{verificationRequest.purpose}</Text>
              </View>
            )}
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
                  <FileText color="#64748B" size={48} />
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
                            {formatCredentialTitle(credential)}
                          </Text>
                          <Text style={styles.credentialItemDetail} numberOfLines={1}>
                            {Object.keys(credential.data || {})[0]}: {String(Object.values(credential.data || {})[0] || '')}
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
                        <Shield color="#10B981" size={16} />
                        <Text style={styles.selectiveButtonText}>
                          Select Fields
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
                  placeholderTextColor="#64748B"
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
              style={[styles.actionButton, { opacity: isProcessing || selectedCredentials.length === 0 ? 0.5 : 1 }]}
              onPress={createStandardPresentation}
              disabled={isProcessing || selectedCredentials.length === 0}
            >
              <LinearGradient
                colors={['#06B6D4', '#8B5CF6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.actionButtonGradient}
              >
                <Share2 color="#FFFFFF" size={20} />
                <Text style={styles.actionButtonText}>
                  {isProcessing ? 'Creating...' : 'Share Full Credentials'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.scanButton}
              onPress={openScanner}
            >
              <QrCode color="#06B6D4" size={20} />
              <Text style={styles.scanButtonText}>Scan Verification Request</Text>
            </TouchableOpacity>

            <View style={styles.bottomPadding} />
          </>
        )}
      </ScrollView>

      {/* Field Selector Modal */}
      {renderFieldSelector()}

      {/* Scanner Modal */}
      <Modal
        visible={showScanner}
        animationType="slide"
        onRequestClose={() => setShowScanner(false)}
      >
        <SafeAreaView style={styles.scannerContainer}>
          <StatusBar barStyle="light-content" />
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
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F1F5F9',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748B',
  },
  scrollView: {
    flex: 1,
  },
  requestCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  requestTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#06B6D4',
    marginBottom: 12,
  },
  requestRow: {
    marginBottom: 8,
  },
  requestLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
  requestValue: {
    fontSize: 14,
    color: '#F1F5F9',
    fontWeight: '500',
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#F1F5F9',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 16,
  },
  credentialItemWrapper: {
    marginBottom: 12,
  },
  credentialItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#334155',
  },
  credentialItemSelected: {
    borderColor: '#06B6D4',
    backgroundColor: '#1E293B',
  },
  credentialItemContent: {
    flex: 1,
  },
  credentialItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F1F5F9',
    marginBottom: 4,
  },
  credentialItemDetail: {
    fontSize: 13,
    color: '#94A3B8',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#64748B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#06B6D4',
    borderColor: '#06B6D4',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  selectiveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  selectiveButtonText: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: '600',
  },
  label: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    padding: 16,
    color: '#F1F5F9',
    fontSize: 16,
  },
  selectedCount: {
    fontSize: 14,
    color: '#06B6D4',
    fontWeight: '600',
  },
  actionButton: {
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
  },
  actionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 18,
  },
  actionButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    padding: 16,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#06B6D4',
    marginBottom: 12,
  },
  scanButtonText: {
    color: '#06B6D4',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748B',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 8,
  },
  bottomPadding: {
    height: 40,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F1F5F9',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#64748B',
  },
  closeText: {
    fontSize: 32,
    color: '#F1F5F9',
    fontWeight: 'bold',
  },
  requestInfoCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  requestInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#06B6D4',
    marginBottom: 8,
  },
  requestInfoText: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 4,
  },
  privacyNotice: {
    flexDirection: 'row',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    gap: 12,
  },
  privacyContent: {
    flex: 1,
  },
  privacyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
    marginBottom: 4,
  },
  privacyText: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 18,
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 12,
  },
  quickActionButton: {
    flex: 1,
    padding: 12,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  quickActionText: {
    color: '#06B6D4',
    fontSize: 14,
    fontWeight: '600',
  },
  fieldList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  fieldItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#334155',
  },
  fieldItemSelected: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  fieldItemContent: {
    flex: 1,
  },
  fieldKey: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F1F5F9',
    marginBottom: 6,
  },
  fieldValue: {
    fontSize: 13,
    color: '#94A3B8',
  },
  fieldCheckbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#64748B',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  fieldCheckboxSelected: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  fieldCheckmark: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#334155',
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
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Scanner styles
  scannerContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  scannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  scannerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F1F5F9',
  },
  camera: {
    flex: 1,
    margin: 16,
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
    borderColor: '#06B6D4',
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
    padding: 16,
    backgroundColor: '#1E293B',
    alignItems: 'center',
  },
  scannerInstructionText: {
    fontSize: 16,
    color: '#F1F5F9',
    textAlign: 'center',
  },
});
