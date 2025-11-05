// wallet-app/app/scan.js
// FIXED: Camera properly reinitializes when returning from other tabs

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  StatusBar,
  ActivityIndicator
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import * as didManager from '../../services/didManager';
import * as secureStorage from '../../services/secureStorage';
import apiClient from '../../services/api';
import logger from '../../utils/logger';

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [walletInfo, setWalletInfo] = useState(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isScreenFocused, setIsScreenFocused] = useState(false);

  // ✅ FIX: Reset camera state when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('📷 Scan screen focused');
      setIsScreenFocused(true);
      setScanned(false);
      setProcessing(false);
      setIsCameraReady(false);
      loadWallet();

      // Cleanup when screen loses focus
      return () => {
        console.log('📷 Scan screen unfocused');
        setIsScreenFocused(false);
        setIsCameraReady(false);
      };
    }, [])
  );

  const loadWallet = async () => {
    try {
      const hasWallet = await didManager.hasWallet();
      if (hasWallet) {
        const info = await didManager.getWalletInfo();
        setWalletInfo(info);
      } else {
        setWalletInfo(null);
      }
    } catch (error) {
      logger.error('Failed to load wallet info');
      setWalletInfo(null);
    }
  };

  // ✅ FIX: Handle camera ready state
  const handleCameraReady = () => {
    console.log('📷 Camera ready');
    setIsCameraReady(true);
  };

  const handleBarCodeScanned = async ({ data }) => {
    if (scanned || processing || !isCameraReady) return;

    setScanned(true);
    setProcessing(true);

    try {
      logger.info('📷 QR Code scanned');

      // ✅ CHECK 1: Wallet exists
      if (!walletInfo?.did) {
        throw new Error('No DID found. Please create your identity first.\n\nGo to Home screen → Click "Create Your Identity"');
      }

      // ✅ CHECK 2: Extract and validate holder DID format
      let holderAddress;
      try {
        holderAddress = walletInfo.did.split(':').pop();
        if (!holderAddress || holderAddress.length < 40) {
          throw new Error('Invalid DID format');
        }
      } catch (error) {
        throw new Error('Your DID has an invalid format. Please recreate your identity.');
      }

      // ✅ CHECK 3: Holder DID registered on blockchain
      logger.info('🔍 Checking holder DID registration on blockchain...');
      const registrationCheck = await apiClient.get(`/check-registration/${holderAddress}`);

      if (!registrationCheck.data.registered) {
        throw new Error('Your DID is not registered on blockchain yet.\n\nPlease wait a moment for blockchain confirmation, or try creating your identity again.');
      }

      logger.info('✅ Holder DID is registered on blockchain');

      // ✅ CHECK 4: Parse and validate claim token structure
      let claimToken;
      try {
        claimToken = JSON.parse(data);
      } catch (error) {
        throw new Error('Invalid QR code format. This is not a valid credential claim token.');
      }

      // ✅ CHECK 5: Required fields in claim token
      if (!claimToken || !claimToken.id || !claimToken.type) {
        throw new Error('Invalid claim token. Missing required fields.');
      }

      logger.info('📋 Claim token received');
      logger.info(`   Type: ${claimToken.type}`);
      logger.info(`   Token ID: ${claimToken.id}`);

      // ✅ CHECK 6: Validate claim token type
      if (claimToken.type !== 'CREDENTIAL_CLAIM') {
        throw new Error('Invalid QR code. This is not a credential claim token.');
      }

      // ✅ CHECK 7: Check expiration (client-side for UX)
      if (!claimToken.expiresAt) {
        throw new Error('Invalid claim token. Missing expiration information.');
      }

      if (Date.now() > claimToken.expiresAt) {
        throw new Error('This claim token has expired. Please request a new one from the issuer.');
      }

      // ✅ CHECK 8: Check if already claimed locally (by claimTokenId)
      const existingCredentials = await secureStorage.getCredentials();
      const alreadyClaimed = existingCredentials.some(
        cred => cred.claimTokenId === claimToken.id
      );

      if (alreadyClaimed) {
        throw new Error('You have already claimed this credential using this token.');
      }

      // ✅ CHECK 9: Verify DID if pre-registered (optional client-side check)
      if (claimToken.requiredDID && claimToken.requiredDID !== walletInfo.did) {
        throw new Error(`This credential is issued for a different student.\n\nExpected: ${claimToken.requiredDID}\n\nYour DID: ${walletInfo.did}`);
      }

      // ✅ CHECK 10: Validate issuer DID format if present
      if (claimToken.issuer) {
        try {
          const issuerAddress = claimToken.issuer.split(':').pop();
          if (!issuerAddress || issuerAddress.length < 40) {
            throw new Error('Invalid issuer DID format in claim token.');
          }

          logger.info('🔍 Checking issuer DID registration on blockchain...');
          const issuerRegistrationCheck = await apiClient.get(`/check-registration/${issuerAddress}`);

          if (!issuerRegistrationCheck.data.registered) {
            throw new Error('The issuer DID from the claim token is not registered on the blockchain. The credential cannot be issued.');
          }

          logger.info('✅ Issuer DID is registered on blockchain');
        } catch (error) {
          if (error.message.includes('issuer DID')) {
            throw error;
          }
          throw new Error('Invalid issuer DID format in claim token.');
        }
      } else {
        logger.warning('⚠️ No issuer DID found in claim token');
      }

      // ✅ ALL CHECKS PASSED - Claim credential from backend
      logger.info('📤 Claiming credential from issuer...');
      logger.info(`   Your DID: ${walletInfo.did}`);

      const response = await apiClient.post('/claim-credential', {
        claimToken: claimToken,
        holderDID: walletInfo.did
      });

      // Handle backend response errors
      if (!response.data.success) {
        const errorCode = response.data.code;
        const errorMessage = response.data.message || response.data.error;

        // Map backend error codes to user-friendly messages
        switch (errorCode) {
          case 'MISSING_REQUIRED_FIELDS':
            throw new Error('Missing required information. Please try scanning again.');
          case 'CREDENTIAL_ALREADY_CLAIMED':
            throw new Error('You have already claimed this credential.');
          case 'INVALID_HOLDER_DID_FORMAT':
            throw new Error('Your DID has an invalid format. Please recreate your identity.');
          case 'HOLDER_DID_NOT_REGISTERED':
            throw new Error('Your DID is not registered on blockchain. Please create your identity first.');
          case 'INVALID_OR_USED_TOKEN':
            throw new Error('The claim token is invalid or has already been used.');
          case 'TOKEN_EXPIRED':
            throw new Error('The claim token has expired. Please request a new one.');
          case 'TOKEN_VALIDATION_FAILED':
            throw new Error('Token validation failed. The token may have been tampered with.');
          case 'DID_MISMATCH':
            throw new Error('This credential is intended for a different DID.');
          case 'MISSING_ISSUER_DID':
            throw new Error('The claim token is missing issuer information. Please contact the credential issuer.');
          case 'INVALID_ISSUER_DID_FORMAT':
            throw new Error('The issuer DID in the claim token has an invalid format.');
          case 'ISSUER_DID_NOT_REGISTERED':
            throw new Error('The issuer DID from the claim token is not registered on the blockchain. The credential cannot be issued.');
          case 'CREDENTIAL_CREATION_FAILED':
            throw new Error('Failed to create the credential. Please try again or contact support.');
          default:
            throw new Error(errorMessage || 'Failed to claim credential. Please try again.');
        }
      }

      // Store credential locally
      const credential = {
        id: response.data.credential.id,
        issuer: response.data.credential.issuer,
        subject: response.data.credential.subject,
        data: response.data.credential.data,
        jwt: response.data.credential.jwt,
        addedAt: new Date().toISOString(),
        claimTokenId: claimToken.id
      };

      await secureStorage.addCredential(credential);

      logger.success('✅ Credential claimed and stored securely');

      Alert.alert(
        '✅ Credential Claimed!',
        `${claimToken.credentialData?.credentialType || 'Credential'} has been added to your wallet.\n\n🔐 Securely verified and issued.\n\nGo to the Wallet tab to view it.`,
        [
          {
            text: 'View Wallet',
            onPress: () => {
              resetScanState();
            }
          },
          {
            text: 'Scan Another',
            onPress: () => {
              resetScanState();
            }
          }
        ]
      );

    } catch (error) {
      logger.error('Failed to claim credential: ' + error.message);

      // Handle network errors
      if (error.response) {
        const status = error.response.status;
        const errorData = error.response.data;

        let errorTitle = '❌ Claim Failed';
        let errorMessage = errorData?.message || errorData?.error || 'Failed to claim credential';

        // Map HTTP status codes and error codes
        if (status === 400) {
          errorTitle = '⚠️ Validation Error';
          if (errorData?.code === 'TOKEN_EXPIRED') {
            errorTitle = '⏰ Token Expired';
            errorMessage = 'The claim token has expired. Please request a new one from the issuer.';
          } else if (errorData?.code === 'INVALID_OR_USED_TOKEN') {
            errorTitle = '🔒 Invalid Token';
            errorMessage = 'The claim token is invalid or has already been used.';
          } else if (errorData?.code === 'TOKEN_VALIDATION_FAILED') {
            errorTitle = '🔐 Validation Failed';
            errorMessage = 'Token validation failed. The token may have been tampered with.';
          }
        } else if (status === 403) {
          errorTitle = '🚫 Access Denied';
          if (errorData?.code === 'HOLDER_DID_NOT_REGISTERED') {
            errorTitle = '⏳ Registration Required';
            errorMessage = 'Your DID is not registered on blockchain. Please create your identity first.';
          } else if (errorData?.code === 'DID_MISMATCH') {
            errorTitle = '🚫 Not For You';
            errorMessage = 'This credential is intended for a different DID.';
          }
        } else if (status === 409) {
          errorTitle = '🔒 Already Claimed';
          errorMessage = 'You have already claimed this credential.';
        } else if (status === 500) {
          errorTitle = '⚠️ Server Error';
          errorMessage = 'An error occurred on the server. Please try again later or contact support.';
        }

        Alert.alert(
          errorTitle,
          errorMessage,
          [
            {
              text: 'OK',
              onPress: () => {
                resetScanState();
              }
            }
          ]
        );
      } else {
        // Handle other errors (network, parsing, etc.)
        let errorTitle = '❌ Claim Failed';
        let errorMessage = error.message;

        // User-friendly error messages for common errors
        if (error.message.includes('No DID found') || error.message.includes('create your identity')) {
          errorTitle = '🆔 Identity Required';
          errorMessage = 'You need to create your identity first.\n\nGo to Home screen and click "Create Your Identity"';
        } else if (error.message.includes('not registered on blockchain')) {
          errorTitle = '⏳ Registration Pending';
          errorMessage = 'Your DID is being registered on blockchain.\n\nPlease wait a moment and try again.\n\nIf this persists, try creating your identity again.';
        } else if (error.message.includes('expired')) {
          errorTitle = '⏰ Token Expired';
          errorMessage = 'This claim link has expired. Please request a new one from your institution.';
        } else if (error.message.includes('already claimed') || error.message.includes('already used')) {
          errorTitle = '🔒 Already Claimed';
          errorMessage = 'This credential has already been claimed and cannot be used again.';
        } else if (error.message.includes('different student') || error.message.includes('different DID')) {
          errorTitle = '🚫 Not For You';
          errorMessage = error.message;
        } else if (error.message.includes('Invalid QR code') || error.message.includes('Invalid claim token')) {
          errorTitle = '❌ Invalid QR Code';
          errorMessage = error.message;
        } else if (error.message.includes('network') || error.message.includes('Network')) {
          errorTitle = '🌐 Network Error';
          errorMessage = 'Unable to connect to the server. Please check your internet connection and try again.';
        }

        Alert.alert(
          errorTitle,
          errorMessage,
          [
            {
              text: 'OK',
              onPress: () => {
                resetScanState();
              }
            }
          ]
        );
      }
    }
  };

  // ✅ FIX: Proper state reset
  const resetScanState = () => {
    setScanned(false);
    setProcessing(false);
    // Don't reset isCameraReady - let it stay ready
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionIcon}>📷</Text>
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionText}>
            We need camera permission to scan QR codes for receiving credentials
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.permissionButtonGradient}
            >
              <Text style={styles.permissionButtonText}>Grant Permission</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Scan QR Code</Text>
        <Text style={styles.headerSubtitle}>
          Point camera at credential QR code
        </Text>

        {/* DID Status Indicator */}
        {walletInfo?.did ? (
          <View style={styles.didStatusCard}>
            <Text style={styles.didStatusIcon}>✅</Text>
            <View style={styles.didStatusText}>
              <Text style={styles.didStatusTitle}>Identity Ready</Text>
              <Text style={styles.didStatusSubtitle}>
                {walletInfo.did.slice(0, 30)}...
              </Text>
            </View>
          </View>
        ) : (
          <View style={[styles.didStatusCard, styles.didStatusCardWarning]}>
            <Text style={styles.didStatusIcon}>⚠️</Text>
            <View style={styles.didStatusText}>
              <Text style={styles.didStatusTitle}>No Identity Found</Text>
              <Text style={styles.didStatusSubtitle}>
                Create your identity first on Home screen
              </Text>
            </View>
          </View>
        )}
      </View>

      <View style={styles.cameraContainer}>
        {/* ✅ FIX: Only render camera when screen is focused */}
        {isScreenFocused && permission.granted ? (
          <CameraView
            key={isScreenFocused ? 'focused' : 'unfocused'} // Force remount
            style={styles.camera}
            facing="back"
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
            onCameraReady={handleCameraReady}
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
        ) : (
          <View style={styles.cameraLoading}>
            <ActivityIndicator size="large" color="#667eea" />
            <Text style={styles.cameraLoadingText}>Loading camera...</Text>
          </View>
        )}

        {processing && (
          <View style={styles.processingOverlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.processingText}>Processing credential...</Text>
          </View>
        )}

        {/* Camera Status Indicator */}
        {isScreenFocused && !isCameraReady && !processing && (
          <View style={styles.cameraStatusOverlay}>
            <ActivityIndicator size="small" color="#667eea" />
            <Text style={styles.cameraStatusText}>Initializing camera...</Text>
          </View>
        )}
      </View>

      <View style={styles.instructions}>
        <Text style={styles.instructionTitle}>📱 How to receive credentials</Text>
        <Text style={styles.instructionText}>
          1. Make sure you have created your identity{'\n'}
          2. Ask the issuer to generate a QR code{'\n'}
          3. Point your camera at the QR code{'\n'}
          4. Credential will be automatically added to your wallet
        </Text>
      </View>

      {scanned && !processing && (
        <TouchableOpacity
          style={styles.resetButton}
          onPress={resetScanState}
        >
          <LinearGradient
            colors={['#667eea', '#764ba2']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.resetButtonGradient}
          >
            <Text style={styles.resetButtonText}>Scan Another</Text>
          </LinearGradient>
        </TouchableOpacity>
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
    fontSize: 16,
    color: '#888',
    marginBottom: 16,
  },
  didStatusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a3a1a',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2a5a2a',
  },
  didStatusCardWarning: {
    backgroundColor: '#3a2a1a',
    borderColor: '#5a4a2a',
  },
  didStatusIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  didStatusText: {
    flex: 1,
  },
  didStatusTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  didStatusSubtitle: {
    fontSize: 12,
    color: '#aaa',
  },
  cameraContainer: {
    flex: 1,
    margin: 20,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  cameraLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  cameraLoadingText: {
    color: '#fff',
    fontSize: 14,
    marginTop: 12,
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
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
    fontWeight: '600',
  },
  cameraStatusOverlay: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  cameraStatusText: {
    color: '#667eea',
    fontSize: 12,
    fontWeight: '600',
  },
  instructions: {
    padding: 20,
    backgroundColor: '#1a1a2e',
    margin: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  instructionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  instructionText: {
    fontSize: 14,
    color: '#aaa',
    lineHeight: 22,
  },
  resetButton: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  resetButtonGradient: {
    padding: 18,
    alignItems: 'center',
  },
  resetButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  permissionIcon: {
    fontSize: 80,
    marginBottom: 20,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 24,
  },
  permissionButton: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  permissionButtonGradient: {
    padding: 18,
    alignItems: 'center',
  },
  permissionButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
});