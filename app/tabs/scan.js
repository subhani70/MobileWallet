// wallet-app/app/scan.js
// FIXED: Optimized blockchain lookups with caching, parallelization, and timeouts

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  X,
  Zap,
  Image as ImageIcon,
  Clock,
  HelpCircle,
  CheckCircle2,
  XCircle,
  Shield,
  Building,
  Calendar,
  User,
  Hash,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react-native';
import * as didManager from '../../services/didManager';
import * as secureStorage from '../../services/secureStorage';
import apiClient from '../../services/api';
import logger from '../../utils/logger';

const withTimeout = (promise, timeoutMs = 10000) => {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
    ),
  ]);
};

const registrationCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

const getCachedRegistration = did => {
  const cached = registrationCache.get(did);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.registered;
  }
  return null;
};

const setCachedRegistration = (did, registered) => {
  registrationCache.set(did, {
    registered,
    timestamp: Date.now(),
  });
};

export default function ScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [walletInfo, setWalletInfo] = useState(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isScreenFocused, setIsScreenFocused] = useState(false);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [currentTip, setCurrentTip] = useState(0);
  const abortControllerRef = useRef(null);

  const tips = [
    'Hold steady for best results',
    'Ensure good lighting',
    'QR code should fill most of frame',
    'Keep camera parallel to code',
  ];

  useFocusEffect(
    useCallback(() => {
      setIsScreenFocused(true);
      setScanned(false);
      setProcessing(false);
      setProcessingStep('');
      setIsCameraReady(false);
      setVerificationResult(null);
      setShowHelp(false);
      setFlashEnabled(false);
      setCurrentTip(0);
      loadWallet();

      return () => {
        setIsScreenFocused(false);
        setIsCameraReady(false);
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
      };
    }, [])
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTip(prev => (prev + 1) % tips.length);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const loadWallet = async () => {
    try {
      const hasWallet = await didManager.hasWallet();
      if (hasWallet) {
        const info = await didManager.getWalletInfo();
        setWalletInfo(info);

        if (info?.did) {
          const holderAddress = info.did.split(':').pop();
          checkRegistrationWithCache(holderAddress).catch(() => {});
        }
      } else {
        setWalletInfo(null);
      }
    } catch (error) {
      logger.error('Failed to load wallet info');
      setWalletInfo(null);
    }
  };

  const checkRegistrationWithCache = async address => {
    const cached = getCachedRegistration(address);
    if (cached !== null) {
      logger.info(`📦 Using cached registration status for ${address}: ${cached}`);
      return cached;
    }

    try {
      const response = await withTimeout(
        apiClient.get(`/check-registration/${address}`),
        5000
      );

      const registered = response.data.registered;
      setCachedRegistration(address, registered);
      return registered;
    } catch (error) {
      if (error.message === 'Request timeout') {
        throw new Error('Registration check timed out. The blockchain may be slow.');
      }
      throw error;
    }
  };

  const handleCameraReady = () => {
    setIsCameraReady(true);
  };

  const handleBarCodeScanned = async ({ data }) => {
    if (scanned || processing || !isCameraReady) return;

    setScanned(true);
    setProcessing(true);
    setProcessingStep('Validating...');
    setVerificationResult(null);

    logger.info('🔄 Starting credential verification pipeline');

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    abortControllerRef.current = new AbortController();

    try {
      logger.info('📷 QR Code scanned');

      if (!walletInfo?.did) {
        throw new Error(
          'No DID found. Please create your identity first.\n\nGo to Home screen → Click "Create Your Identity"'
        );
      }

      let holderAddress;
      try {
        holderAddress = walletInfo.did.split(':').pop();
        if (!holderAddress || holderAddress.length < 40) {
          throw new Error('Invalid DID format');
        }
      } catch (error) {
        throw new Error('Your DID has an invalid format. Please recreate your identity.');
      }

      let claimToken;
      try {
        claimToken = JSON.parse(data);
      } catch (error) {
        throw new Error('Invalid QR code format. This is not a valid credential claim token.');
      }

      if (!claimToken || !claimToken.id || !claimToken.type) {
        throw new Error('Invalid claim token. Missing required fields.');
      }

      logger.info('✅ Local QR data validated');
      logger.info('📋 Claim token received');
      logger.info(`   Type: ${claimToken.type}`);
      logger.info(`   Token ID: ${claimToken.id}`);

      if (claimToken.type !== 'CREDENTIAL_CLAIM') {
        throw new Error('Invalid QR code. This is not a credential claim token.');
      }

      if (!claimToken.expiresAt) {
        throw new Error('Invalid claim token. Missing expiration information.');
      }

      if (Date.now() > claimToken.expiresAt) {
        throw new Error('This claim token has expired. Please request a new one from the issuer.');
      }

      const existingCredentials = await secureStorage.getCredentials();
      const alreadyClaimed = existingCredentials.some(
        cred => cred.claimTokenId === claimToken.id
      );

      if (alreadyClaimed) {
        throw new Error('You have already claimed this credential using this token.');
      }

      if (claimToken.requiredDID && claimToken.requiredDID !== walletInfo.did) {
        throw new Error(
          `This credential is issued for a different student.\n\nExpected: ${claimToken.requiredDID}\n\nYour DID: ${walletInfo.did}`
        );
      }

      setProcessingStep('Checking registrations...');
      logger.info('🔗 Initiating blockchain registration checks');

      const registrationChecks = [];
      registrationChecks.push(
        checkRegistrationWithCache(holderAddress)
          .then(registered => ({ type: 'holder', registered }))
          .catch(error => ({ type: 'holder', error }))
      );

      if (claimToken.issuer) {
        try {
          const issuerAddress = claimToken.issuer.split(':').pop();
          if (issuerAddress && issuerAddress.length >= 40) {
            registrationChecks.push(
              checkRegistrationWithCache(issuerAddress)
                .then(registered => ({ type: 'issuer', registered }))
                .catch(error => ({ type: 'issuer', error }))
            );
          }
        } catch (error) {
          logger.warning('⚠️ Invalid issuer DID format in claim token');
        }
      }

      const results = await Promise.all(registrationChecks);

      for (const result of results) {
        if (result.error) {
          if (result.type === 'holder') {
            throw new Error(
              'Failed to verify your DID registration. Please check your connection and try again.'
            );
          }
          logger.warning(`⚠️ Failed to verify issuer registration: ${result.error.message}`);
        } else if (result.type === 'holder' && !result.registered) {
          throw new Error(
            'Your DID is not registered on blockchain yet.\n\nPlease wait a moment for blockchain confirmation, or try creating your identity again.'
          );
        } else if (result.type === 'issuer' && !result.registered) {
          logger.warning('⚠️ Issuer DID not verified on blockchain, proceeding anyway');
        }
      }

      logger.info('🔗 Blockchain registration checks completed');

      setProcessingStep('Claiming credential...');

      logger.info('📤 Claiming credential from issuer...');
      logger.info(`   Your DID: ${walletInfo.did}`);
      logger.info('🌐 Sending claim-credential request to backend');

      const response = await withTimeout(
        apiClient.post('/claim-credential', {
          claimToken: claimToken,
          holderDID: walletInfo.did,
          validationContext: {
            holderRegistered: true,
            locallyValidated: true,
            clientVersion: '1.0.0',
          },
        }),
        15000
      );

      if (!response.data.success) {
        logger.warning('🌐 Claim API responded with failure status');
        const errorCode = response.data.code;
        const errorMessage = response.data.message || response.data.error;

        switch (errorCode) {
          case 'MISSING_REQUIRED_FIELDS':
            throw new Error('Missing required information. Please try scanning again.');
          case 'CREDENTIAL_ALREADY_CLAIMED':
            throw new Error('You have already claimed this credential.');
          case 'INVALID_HOLDER_DID_FORMAT':
            throw new Error('Your DID has an invalid format. Please recreate your identity.');
          case 'HOLDER_DID_NOT_REGISTERED':
            registrationCache.delete(holderAddress);
            throw new Error('Your DID is not registered on blockchain. Please create your identity first.');
          case 'INVALID_OR_USED_TOKEN':
            throw new Error('The claim token is invalid or has already been used.');
          case 'TOKEN_EXPIRED':
            throw new Error('The claim token has expired. Please request a new one.');
          case 'TOKEN_VALIDATION_FAILED':
            throw new Error('Token validation failed. The token may have been tampered with.');
          case 'DID_MISMATCH':
            throw new Error('This credential is intended for a different DID.');
          default:
            throw new Error(errorMessage || 'Failed to claim credential. Please try again.');
        }
      }

      logger.info('🌐 Claim API response received successfully');

      setProcessingStep('Storing credential...');
      logger.info('💾 Persisting credential locally');

      const credential = {
        id: response.data.credential.id,
        issuer: response.data.credential.issuer,
        subject: response.data.credential.subject,
        data: response.data.credential.data,
        jwt: response.data.credential.jwt,
        addedAt: new Date().toISOString(),
        claimTokenId: claimToken.id,
      };

      await secureStorage.addCredential(credential);

      logger.success('✅ Credential claimed and stored securely');

      setProcessing(false);
      setProcessingStep('');

      const credentialData = response.data.credential?.data || {};
      const credentialMeta = claimToken.credentialData || {};
      const successResult = {
        success: true,
        name:
          credentialData.name ||
          credentialData.fullName ||
          credentialData.studentName ||
          walletInfo?.did?.split(':').pop(),
        credential:
          credentialData.credential ||
          credentialData.title ||
          credentialMeta.credentialType ||
          'Verified Credential',
        institution:
          credentialData.institution ||
          credentialData.issuer ||
          credentialMeta.institution ||
          credentialMeta.issuerName ||
          response.data.credential?.issuer,
        date:
          credentialData.date ||
          credentialData.graduationDate ||
          (response.data.credential?.issuedAt
            ? `Issued ${new Date(response.data.credential.issuedAt).toLocaleDateString()}`
            : `Added ${new Date().toLocaleDateString()}`),
        status: 'VERIFIED',
        did: walletInfo?.did,
        proofUrl: credentialMeta.proofUrl || null,
      };

      setVerificationResult(successResult);

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }

      logger.info('🏁 Credential verification pipeline completed successfully');
    } catch (error) {
      if (error.name === 'AbortError') {
        logger.info('Claim operation cancelled');
        resetScanState();
        return;
      }

      logger.error('Failed to claim credential: ' + error.message);

      setProcessing(false);
      setProcessingStep('');

      let errorTitle = 'Claim Failed';
      let errorMessage = error.message;

      if (error.message === 'Request timeout') {
        errorTitle = 'Request Timeout';
        errorMessage = 'The request took too long. The blockchain may be slow. Please try again.';
      } else if (error.message.includes('No DID found')) {
        errorTitle = 'Identity Required';
        errorMessage = 'You need to create your identity first. Go to Home and tap "Create Your Identity".';
      } else if (error.message.includes('not registered on blockchain')) {
        errorTitle = 'Registration Pending';
      } else if (error.message.includes('expired')) {
        errorTitle = 'Token Expired';
      } else if (error.message.includes('already claimed')) {
        errorTitle = 'Already Claimed';
      } else if (error.message.includes('different')) {
        errorTitle = 'DID Mismatch';
      } else if (error.message.includes('Invalid QR')) {
        errorTitle = 'Invalid QR Code';
      } else if (error.response) {
        const status = error.response.status;
        if (status === 500) {
          errorTitle = 'Server Error';
          errorMessage = 'An error occurred on the server. Please try again later.';
        } else if (status === 503) {
          errorTitle = 'Service Unavailable';
          errorMessage = 'The service is temporarily unavailable. Please try again later.';
        }
      } else if (error.message.toLowerCase().includes('network')) {
        errorTitle = 'Network Error';
        errorMessage = 'Unable to connect to the server. Please check your internet connection.';
      }

      setVerificationResult({
        success: false,
        error: errorMessage,
        errorTitle,
      });

      logger.info('⚠️ Credential verification pipeline ended with an error state');

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      }
    } finally {
      abortControllerRef.current = null;
    }
  };

  const resetScanState = () => {
    setScanned(false);
    setProcessing(false);
    setProcessingStep('');
    setVerificationResult(null);
  };

  const cancelProcessing = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    resetScanState();
  };

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <View style={styles.permissionContent}>
          <View style={styles.permissionIcon}>
            <ImageIcon color="#94A3B8" size={64} />
          </View>
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionMessage}>
            Please allow camera access to scan QR codes
          </Text>
          <TouchableOpacity
            style={styles.enableButton}
            onPress={requestPermission}
          >
            <Text style={styles.enableButtonText}>Enable Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backLink}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const handleToggleFlash = () => {
    setFlashEnabled(prev => !prev);
  };

  const handleShowHelp = () => {
    setShowHelp(true);
  };

  const handleCloseHelp = () => {
    setShowHelp(false);
  };

  const handleScanAgain = () => {
    resetScanState();
  };

  const handleDone = () => {
    setVerificationResult(null);
    router.back();
  };

  return (
    <View style={styles.container}>
      {isScreenFocused ? (
        <CameraView
          key={isScreenFocused ? 'focused' : 'unfocused'}
          style={StyleSheet.absoluteFill}
          facing="back"
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          onCameraReady={handleCameraReady}
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
          enableTorch={flashEnabled}
        >
          <View style={styles.overlay}>
            <TopControls
              flashEnabled={flashEnabled}
              onToggleFlash={handleToggleFlash}
              onClose={() => router.back()}
            />

            <ScanningArea
              processing={processing}
              processingStep={processingStep}
              currentTip={tips[currentTip]}
              isCameraReady={isCameraReady}
            />

            <BottomActions onHelp={handleShowHelp} />

            {processing && (
              <ProcessingOverlay
                processingStep={processingStep}
                onCancel={cancelProcessing}
              />
            )}
          </View>
        </CameraView>
      ) : (
        <View style={styles.inactiveCamera}>
          <Text style={styles.inactiveCameraText}>Camera paused</Text>
        </View>
      )}

      {verificationResult && (
        <VerificationResultModal
          result={verificationResult}
          onClose={verificationResult.success ? handleDone : () => setVerificationResult(null)}
          onScanAgain={handleScanAgain}
        />
      )}

      {showHelp && <HelpModal onClose={handleCloseHelp} />}
    </View>
  );
}

function TopControls({ flashEnabled, onToggleFlash, onClose }) {
  return (
    <LinearGradient
      colors={['rgba(0,0,0,0.7)', 'transparent']}
      style={styles.topControls}
    >
      <TouchableOpacity style={styles.controlButton} onPress={onClose}>
        <X color="#FFFFFF" size={28} />
      </TouchableOpacity>

      <Text style={styles.title}>Scan QR Code</Text>

      <TouchableOpacity style={styles.controlButton} onPress={onToggleFlash}>
        <Zap
          color={flashEnabled ? '#FFD700' : '#FFFFFF'}
          size={28}
          fill={flashEnabled ? '#FFD700' : 'transparent'}
        />
      </TouchableOpacity>
    </LinearGradient>
  );
}

function ScanningArea({ processing, processingStep, currentTip, isCameraReady }) {
  const instructionPrimary = processing
    ? processingStep || 'Processing credential...'
    : isCameraReady
      ? 'Position QR code within frame'
      : 'Initializing camera...';

  return (
    <View style={styles.scanningArea}>
      <View style={styles.viewfinderContainer}>
        <View style={styles.viewfinder}>
          <ScanningLine />
          <CornerBrackets />
        </View>
      </View>

      <View style={styles.instructionCard}>
        <Shield color="#06B6D4" size={24} />
        <View style={styles.instructionTextContainer}>
          <Text style={styles.instructionPrimary}>{instructionPrimary}</Text>
          <Text style={styles.instructionTip}>{currentTip}</Text>
        </View>
      </View>
    </View>
  );
}

function ScanningLine() {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [animatedValue]);

  const translateY = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 280],
  });

  return (
    <Animated.View
      style={[
        styles.scanningLine,
        {
          transform: [{ translateY }],
        },
      ]}
    />
  );
}

function CornerBrackets() {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  return (
    <>
      <Animated.View
        style={[
          styles.cornerBracket,
          styles.topLeft,
          { transform: [{ scale: pulseAnim }] },
        ]}
      />
      <Animated.View
        style={[
          styles.cornerBracket,
          styles.topRight,
          { transform: [{ scale: pulseAnim }] },
        ]}
      />
      <Animated.View
        style={[
          styles.cornerBracket,
          styles.bottomLeft,
          { transform: [{ scale: pulseAnim }] },
        ]}
      />
      <Animated.View
        style={[
          styles.cornerBracket,
          styles.bottomRight,
          { transform: [{ scale: pulseAnim }] },
        ]}
      />
    </>
  );
}

function BottomActions({ onHelp }) {
  return (
    <LinearGradient
      colors={['transparent', 'rgba(0,0,0,0.7)']}
      style={styles.bottomActions}
    >
      <TouchableOpacity style={styles.actionButton}>
        <Clock color="#FFFFFF" size={24} />
      </TouchableOpacity>

      <View style={styles.galleryButtonContainer}>
        <TouchableOpacity style={styles.galleryButton}>
          <ImageIcon color="#FFFFFF" size={32} />
        </TouchableOpacity>
        <Text style={styles.galleryLabel}>Scan from Photos</Text>
      </View>

      <TouchableOpacity style={styles.actionButton} onPress={onHelp}>
        <HelpCircle color="#FFFFFF" size={24} />
      </TouchableOpacity>
    </LinearGradient>
  );
}

function ProcessingOverlay({ processingStep, onCancel }) {
  const [step, setStep] = useState(0);
  const steps = [
    'Reading QR code...',
    'Fetching credential...',
    'Verifying signature...',
    'Checking blockchain...',
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setStep(prev => (prev < steps.length - 1 ? prev + 1 : prev));
    }, 400);

    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.processingOverlay}>
      <View style={styles.processingContent}>
        <View style={styles.processingSpinner}>
          <View style={styles.spinner} />
        </View>
        <Text style={styles.processingText}>{processingStep || steps[step]}</Text>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function VerificationResultModal({
  result,
  onClose,
  onScanAgain,
}) {
  const slideAnim = useRef(new Animated.Value(500)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0,
      tension: 50,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, [slideAnim]);

  const isSuccess = result.success;

  return (
    <Modal transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <Animated.View
          style={[
            styles.resultCard,
            {
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.resultContent}>
            {isSuccess ? (
              <>
                <View style={styles.successIcon}>
                  <CheckCircle2 color="#10B981" size={64} />
                </View>
                <Text style={styles.resultTitle}>Credential Claimed ✓</Text>
                {result.status && (
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusBadgeText}>{result.status}</Text>
                  </View>
                )}

                <View style={styles.credentialDetails}>
                  {result.name && (
                    <DetailRow icon={User} label="Name" value={result.name} />
                  )}
                  {result.credential && (
                    <DetailRow icon={Shield} label="Credential" value={result.credential} />
                  )}
                  {result.institution && (
                    <DetailRow icon={Building} label="Institution" value={result.institution} />
                  )}
                  {result.date && (
                    <DetailRow icon={Calendar} label="Date" value={result.date} />
                  )}
                  {result.did && (
                    <DetailRow icon={Hash} label="DID" value={result.did} />
                  )}
                </View>

                {result.proofUrl ? (
                  <TouchableOpacity style={styles.blockchainProof} onPress={() => {}}>
                    <Text style={styles.blockchainProofText}>View Blockchain Proof</Text>
                    <ChevronRight color="#06B6D4" size={20} />
                  </TouchableOpacity>
                ) : null}

                <TouchableOpacity style={styles.primaryButton} onPress={onClose}>
                  <Text style={styles.primaryButtonText}>Done</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.secondaryButton} onPress={onScanAgain}>
                  <Text style={styles.secondaryButtonText}>Scan Another</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.failureIcon}>
                  <XCircle color="#EF4444" size={64} />
                </View>
                <Text style={styles.resultTitleError}>{result.errorTitle || 'Verification Failed'}</Text>

                <View style={styles.errorCard}>
                  <AlertTriangle color="#EF4444" size={24} />
                  <View style={styles.errorContent}>
                    <Text style={styles.errorTitle}>{result.errorTitle || 'Verification Failed'}</Text>
                    <Text style={styles.errorMessage}>
                      {result.error || 'The credential could not be verified. Please try again.'}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity style={styles.retryButton} onPress={onScanAgain}>
                  <Text style={styles.retryButtonText}>Try Again</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.reportButton}>
                  <Text style={styles.reportButtonText}>Report Issue</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={onClose}>
                  <Text style={styles.closeLink}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function DetailRow({ icon: Icon, label, value }) {
  return (
    <View style={styles.detailRow}>
      <Icon color="#64748B" size={20} />
      <View style={styles.detailContent}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

function HelpModal({ onClose }) {
  return (
    <Modal animationType="slide" presentationStyle="pageSheet">
      <View style={styles.helpModal}>
        <View style={styles.helpHeader}>
          <Text style={styles.helpTitle}>How to Scan</Text>
          <TouchableOpacity onPress={onClose}>
            <X color="#1E293B" size={28} />
          </TouchableOpacity>
        </View>

        <View style={styles.helpContent}>
          <HelpStep
            number="1"
            title="Position QR Code"
            description="Center the QR code in the frame"
          />
          <HelpStep
            number="2"
            title="Hold Steady"
            description="Keep your phone still for best results"
          />
          <HelpStep
            number="3"
            title="Good Lighting"
            description="Ensure adequate lighting or use flash"
          />
          <HelpStep
            number="4"
            title="Wait for Verification"
            description="Verification happens automatically"
          />
        </View>

        <TouchableOpacity style={styles.gotItButton} onPress={onClose}>
          <Text style={styles.gotItButtonText}>Got It</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

function HelpStep({ number, title, description }) {
  return (
    <View style={styles.helpStep}>
      <View style={styles.stepNumber}>
        <Text style={styles.stepNumberText}>{number}</Text>
      </View>
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepDescription}>{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionContent: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  permissionIcon: {
    marginBottom: 24,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F1F5F9',
    marginBottom: 12,
    textAlign: 'center',
  },
  permissionMessage: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  enableButton: {
    backgroundColor: '#06B6D4',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  enableButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  backLink: {
    color: '#06B6D4',
    fontSize: 16,
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  scanningArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewfinderContainer: {
    width: 280,
    height: 280,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewfinder: {
    width: 280,
    height: 280,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    borderRadius: 24,
    position: 'relative',
    overflow: 'hidden',
  },
  scanningLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#06B6D4',
    shadowColor: '#06B6D4',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  cornerBracket: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: '#FFFFFF',
    borderWidth: 4,
  },
  topLeft: {
    top: -4,
    left: -4,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 24,
  },
  topRight: {
    top: -4,
    right: -4,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 24,
  },
  bottomLeft: {
    bottom: -4,
    left: -4,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 24,
  },
  bottomRight: {
    bottom: -4,
    right: -4,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 24,
  },
  instructionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 16,
    padding: 16,
    marginTop: 24,
    maxWidth: 320,
  },
  instructionTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  instructionPrimary: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  instructionTip: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  bottomActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 40,
    paddingTop: 20,
  },
  actionButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  galleryButtonContainer: {
    alignItems: 'center',
  },
  galleryButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  galleryLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#FFFFFF',
    marginTop: 8,
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingContent: {
    alignItems: 'center',
  },
  processingSpinner: {
    width: 48,
    height: 48,
    marginBottom: 16,
  },
  spinner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 4,
    borderColor: '#06B6D4',
    borderTopColor: 'transparent',
  },
  processingText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  cancelButton: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  resultCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    minHeight: '60%',
    maxHeight: '90%',
  },
  resultContent: {
    padding: 24,
  },
  successIcon: {
    alignSelf: 'center',
    marginBottom: 16,
  },
  failureIcon: {
    alignSelf: 'center',
    marginBottom: 16,
  },
  resultTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#10B981',
    textAlign: 'center',
    marginBottom: 16,
  },
  resultTitleError: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 16,
  },
  statusBadge: {
    alignSelf: 'center',
    backgroundColor: '#DCFCE7',
    borderWidth: 2,
    borderColor: '#10B981',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  statusBadgeText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#166534',
  },
  credentialDetails: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  detailContent: {
    marginLeft: 12,
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  blockchainProof: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    marginBottom: 16,
  },
  blockchainProofText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#06B6D4',
    marginRight: 4,
  },
  primaryButton: {
    backgroundColor: '#06B6D4',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  secondaryButton: {
    borderWidth: 2,
    borderColor: '#06B6D4',
    paddingVertical: 16,
    borderRadius: 12,
  },
  secondaryButtonText: {
    color: '#06B6D4',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  errorCard: {
    flexDirection: 'row',
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  errorContent: {
    marginLeft: 12,
    flex: 1,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#991B1B',
    marginBottom: 4,
  },
  errorMessage: {
    fontSize: 14,
    color: '#7F1D1D',
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: '#EF4444',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  reportButton: {
    borderWidth: 2,
    borderColor: '#EF4444',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  reportButtonText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  closeLink: {
    color: '#64748B',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  helpModal: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  helpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingTop: 60,
  },
  helpTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  helpContent: {
    flex: 1,
    padding: 24,
  },
  helpStep: {
    flexDirection: 'row',
    marginBottom: 32,
  },
  stepNumber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#06B6D4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  stepNumberText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 16,
    color: '#64748B',
    lineHeight: 22,
  },
  gotItButton: {
    backgroundColor: '#06B6D4',
    margin: 16,
    marginBottom: 40,
    paddingVertical: 16,
    borderRadius: 12,
  },
  gotItButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  inactiveCamera: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inactiveCameraText: {
    color: '#64748B',
    fontSize: 16,
  },
});
