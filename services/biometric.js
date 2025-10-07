// services/biometric.js
// Biometric authentication (fingerprint, face ID)

import * as LocalAuthentication from 'expo-local-authentication';
import logger from '../utils/logger';

/**
 * Check if device supports biometric authentication
 */
export const isBiometricSupported = async () => {
  try {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    return compatible;
  } catch (error) {
    logger.error('Error checking biometric support');
    return false;
  }
};

/**
 * Check if biometric is enrolled (fingerprint/face registered)
 */
export const isBiometricEnrolled = async () => {
  try {
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return enrolled;
  } catch (error) {
    logger.error('Error checking biometric enrollment');
    return false;
  }
};

/**
 * Get supported authentication types
 */
export const getSupportedAuthTypes = async () => {
  try {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    const authTypes = [];
    
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      authTypes.push('Fingerprint');
    }
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      authTypes.push('Face ID');
    }
    if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
      authTypes.push('Iris');
    }
    
    return authTypes;
  } catch (error) {
    logger.error('Error getting auth types');
    return [];
  }
};

/**
 * Authenticate user with biometric
 */
export const authenticateWithBiometric = async (promptMessage = 'Authenticate to access wallet') => {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      fallbackLabel: 'Use Passcode',
      cancelLabel: 'Cancel',
    });
    
    if (result.success) {
      logger.success('✅ Biometric authentication successful');
      return { success: true };
    } else {
      logger.warning('⚠️ Biometric authentication failed');
      return { 
        success: false, 
        error: result.error || 'Authentication failed' 
      };
    }
  } catch (error) {
    logger.error(`Biometric authentication error: ${error.message}`);
    return { 
      success: false, 
      error: error.message 
    };
  }
};

/**
 * Check if biometric can be used
 */
export const canUseBiometric = async () => {
  const supported = await isBiometricSupported();
  const enrolled = await isBiometricEnrolled();
  return supported && enrolled;
};

export default {
  isBiometricSupported,
  isBiometricEnrolled,
  getSupportedAuthTypes,
  authenticateWithBiometric,
  canUseBiometric,
};