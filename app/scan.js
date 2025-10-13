import { useState, useEffect } from 'react';
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
import * as didManager from '../services/didManager';
import * as secureStorage from '../services/secureStorage';
import apiClient from '../services/api';
import logger from '../utils/logger';

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [walletInfo, setWalletInfo] = useState(null);

  useEffect(() => {
    loadWallet();
  }, []);

  const loadWallet = async () => {
    const info = await didManager.getWalletInfo();
    setWalletInfo(info);
  };

  const handleBarCodeScanned = async ({ data }) => {
    if (scanned || processing) return;

    setScanned(true);
    setProcessing(true);

    try {
      logger.info('📷 QR Code scanned');

      // Parse QR data
      const credentialOffer = JSON.parse(data);

      logger.info('📋 Credential offer received');
      logger.info(`   Type: ${credentialOffer.credentialType}`);

      if (credentialOffer.type !== 'CREDENTIAL_OFFER') {
        throw new Error('Invalid QR code. Not a credential offer.');
      }

      if (!walletInfo?.did) {
        throw new Error('No DID found. Create your identity first.');
      }

      // Request credential from issuer
      logger.info('📤 Requesting credential from issuer...');

      const response = await apiClient.post('/issue-to-holder', {
        holderDID: walletInfo.did,
        credentialData: credentialOffer.credentialData
      });

      if (!response.data.success) {
        throw new Error('Failed to receive credential from issuer');
      }

      // Store credential locally
      const credential = {
        id: response.data.credential.id,
        issuer: response.data.credential.issuer,
        subject: response.data.credential.subject,
        data: response.data.credential.data,
        jwt: response.data.credential.jwt,
        addedAt: new Date().toISOString()
      };

      await secureStorage.addCredential(credential);

      logger.success('✅ Credential received and stored');

      Alert.alert(
        '✅ Credential Received!',
        `${credentialOffer.credentialType} has been added to your wallet.\n\nGo to the Wallet tab to view it.`,
        [
          { 
            text: 'View Wallet', 
            onPress: () => {
              setScanned(false);
              setProcessing(false);
            }
          },
          {
            text: 'Scan Another',
            onPress: () => {
              setScanned(false);
              setProcessing(false);
            }
          }
        ]
      );

    } catch (error) {
      logger.error('Failed to process credential: ' + error.message);
      
      Alert.alert(
        '❌ Error',
        error.message,
        [
          {
            text: 'Try Again',
            onPress: () => {
              setScanned(false);
              setProcessing(false);
            }
          }
        ]
      );
    }
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
      </View>

      <View style={styles.cameraContainer}>
        <CameraView
          style={styles.camera}
          facing="back"
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
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

        {processing && (
          <View style={styles.processingOverlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.processingText}>Processing credential...</Text>
          </View>
        )}
      </View>

      <View style={styles.instructions}>
        <Text style={styles.instructionTitle}>📱 How to receive credentials</Text>
        <Text style={styles.instructionText}>
          1. Ask the issuer to generate a QR code{'\n'}
          2. Point your camera at the QR code{'\n'}
          3. Credential will be automatically added to your wallet
        </Text>
      </View>

      {scanned && !processing && (
        <TouchableOpacity
          style={styles.resetButton}
          onPress={() => setScanned(false)}
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