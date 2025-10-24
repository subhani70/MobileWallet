// services/secureStorage.js
// Secure storage with PIN and Mnemonic support

import * as SecureStore from 'expo-secure-store';

// Note: logger import removed for testing - add back when integrating with full app
// import logger from '../utils/logger.js';

const logger = {
  success: (msg) => console.log('✅', msg),
  error: (msg) => console.error('❌', msg),
  info: (msg) => console.log('ℹ️', msg),
  warning: (msg) => console.warn('⚠️', msg)
};

// Storage keys
const STORAGE_KEYS = {
  PRIVATE_KEY: 'ssi_private_key',
  PUBLIC_KEY: 'ssi_public_key',
  DID: 'ssi_did',
  ADDRESS: 'ssi_address',
  MNEMONIC: 'ssi_mnemonic',
  PIN_HASH: 'ssi_pin_hash',
  CREDENTIALS: 'ssi_credentials',
  WALLET_INITIALIZED: 'ssi_wallet_initialized',
  BIOMETRIC_ENABLED: 'ssi_biometric_enabled',
  ONBOARDING_COMPLETED: 'ssi_onboarding_completed',
};

/**
 * Save data securely (encrypted by device)
 */
export const saveSecure = async (key, value) => {
  try {
    await SecureStore.setItemAsync(key, value);
    logger.success(`🔐 Saved securely: ${key}`);
    return true;
  } catch (error) {
    logger.error(`Failed to save ${key}: ${error.message}`);
    throw error;
  }
};

/**
 * Get secure data
 */
export const getSecure = async (key) => {
  try {
    const value = await SecureStore.getItemAsync(key);
    if (value) {
      logger.info(`🔓 Retrieved: ${key}`);
    }
    return value;
  } catch (error) {
    logger.error(`Failed to retrieve ${key}: ${error.message}`);
    return null;
  }
};

/**
 * Delete secure data
 */
export const deleteSecure = async (key) => {
  try {
    await SecureStore.deleteItemAsync(key);
    logger.info(`🗑️ Deleted: ${key}`);
    return true;
  } catch (error) {
    logger.error(`Failed to delete ${key}: ${error.message}`);
    return false;
  }
};

// ============================================
// WALLET KEY MANAGEMENT (Updated with Mnemonic)
// ============================================

/**
 * Save wallet keys from mnemonic (NEW PRIMARY METHOD)
 */
export const saveWalletFromMnemonic = async (privateKey, publicKey, address, did, mnemonic, pinHash) => {
  try {
    await saveSecure(STORAGE_KEYS.PRIVATE_KEY, privateKey);
    await saveSecure(STORAGE_KEYS.PUBLIC_KEY, publicKey);
    await saveSecure(STORAGE_KEYS.ADDRESS, address);
    await saveSecure(STORAGE_KEYS.DID, did);
    await saveSecure(STORAGE_KEYS.MNEMONIC, mnemonic);
    await saveSecure(STORAGE_KEYS.PIN_HASH, pinHash);
    await saveSecure(STORAGE_KEYS.WALLET_INITIALIZED, 'true');
    await saveSecure(STORAGE_KEYS.ONBOARDING_COMPLETED, 'true');
    
    logger.success('✅ Wallet with mnemonic saved securely');
    return true;
  } catch (error) {
    logger.error('Failed to save wallet');
    throw error;
  }
};

/**
 * Save wallet keys (legacy method - kept for backward compatibility)
 */
export const saveWalletKeys = async (privateKey, publicKey, address, did) => {
  try {
    await saveSecure(STORAGE_KEYS.PRIVATE_KEY, privateKey);
    await saveSecure(STORAGE_KEYS.PUBLIC_KEY, publicKey);
    await saveSecure(STORAGE_KEYS.ADDRESS, address);
    await saveSecure(STORAGE_KEYS.DID, did);
    await saveSecure(STORAGE_KEYS.WALLET_INITIALIZED, 'true');
    
    logger.success('✅ Wallet keys saved securely');
    return true;
  } catch (error) {
    logger.error('Failed to save wallet keys');
    throw error;
  }
};

/**
 * Get private key (for signing)
 */
export const getPrivateKey = async () => {
  return await getSecure(STORAGE_KEYS.PRIVATE_KEY);
};

/**
 * Get public key
 */
export const getPublicKey = async () => {
  return await getSecure(STORAGE_KEYS.PUBLIC_KEY);
};

/**
 * Get wallet address
 */
export const getAddress = async () => {
  return await getSecure(STORAGE_KEYS.ADDRESS);
};

/**
 * Get DID
 */
export const getDID = async () => {
  return await getSecure(STORAGE_KEYS.DID);
};

/**
 * Get mnemonic phrase (NEW)
 */
export const getMnemonic = async () => {
  return await getSecure(STORAGE_KEYS.MNEMONIC);
};

/**
 * Check if wallet is initialized
 */
export const isWalletInitialized = async () => {
  const initialized = await getSecure(STORAGE_KEYS.WALLET_INITIALIZED);
  return initialized === 'true';
};

/**
 * Check if onboarding completed (NEW)
 */
export const isOnboardingCompleted = async () => {
  const completed = await getSecure(STORAGE_KEYS.ONBOARDING_COMPLETED);
  return completed === 'true';
};

// ============================================
// PIN MANAGEMENT (NEW)
// ============================================

/**
 * Save PIN hash
 */
export const savePINHash = async (pinHash) => {
  try {
    await saveSecure(STORAGE_KEYS.PIN_HASH, pinHash);
    logger.success('🔐 PIN saved securely');
    return true;
  } catch (error) {
    logger.error('Failed to save PIN');
    throw error;
  }
};

/**
 * Get PIN hash
 */
export const getPINHash = async () => {
  return await getSecure(STORAGE_KEYS.PIN_HASH);
};

/**
 * Check if PIN is set
 */
export const isPINSet = async () => {
  const pinHash = await getPINHash();
  return pinHash !== null && pinHash !== undefined;
};

// ============================================
// CREDENTIALS MANAGEMENT
// ============================================

/**
 * Save verifiable credentials
 */
export const saveCredentials = async (credentials) => {
  try {
    const credentialsJson = JSON.stringify(credentials);
    await saveSecure(STORAGE_KEYS.CREDENTIALS, credentialsJson);
    logger.success(`📜 Saved ${credentials.length} credentials`);
    return true;
  } catch (error) {
    logger.error('Failed to save credentials');
    throw error;
  }
};

/**
 * Get all credentials
 */
export const getCredentials = async () => {
  try {
    const credentialsJson = await getSecure(STORAGE_KEYS.CREDENTIALS);
    if (credentialsJson) {
      return JSON.parse(credentialsJson);
    }
    return [];
  } catch (error) {
    logger.error('Failed to get credentials');
    return [];
  }
};

/**
 * Add a single credential
 */
export const addCredential = async (credential) => {
  try {
    const existingCredentials = await getCredentials();
    existingCredentials.push({
      ...credential,
      id: Date.now().toString(),
      addedAt: new Date().toISOString(),
    });
    await saveCredentials(existingCredentials);
    logger.success('📜 Credential added to wallet');
    return true;
  } catch (error) {
    logger.error('Failed to add credential');
    throw error;
  }
};

/**
 * Delete a credential
 */
export const deleteCredential = async (credentialId) => {
  try {
    const existingCredentials = await getCredentials();
    const filtered = existingCredentials.filter(c => c.id !== credentialId);
    await saveCredentials(filtered);
    logger.success('🗑️ Credential deleted');
    return true;
  } catch (error) {
    logger.error('Failed to delete credential');
    throw error;
  }
};

// ============================================
// WALLET RESET
// ============================================

/**
 * Clear all wallet data (use with caution!)
 */
export const clearWallet = async () => {
  try {
    await deleteSecure(STORAGE_KEYS.PRIVATE_KEY);
    await deleteSecure(STORAGE_KEYS.PUBLIC_KEY);
    await deleteSecure(STORAGE_KEYS.ADDRESS);
    await deleteSecure(STORAGE_KEYS.DID);
    await deleteSecure(STORAGE_KEYS.MNEMONIC);
    await deleteSecure(STORAGE_KEYS.PIN_HASH);
    await deleteSecure(STORAGE_KEYS.CREDENTIALS);
    await deleteSecure(STORAGE_KEYS.WALLET_INITIALIZED);
    await deleteSecure(STORAGE_KEYS.BIOMETRIC_ENABLED);
    await deleteSecure(STORAGE_KEYS.ONBOARDING_COMPLETED);
    
    logger.warning('⚠️ Wallet cleared');
    return true;
  } catch (error) {
    logger.error('Failed to clear wallet');
    throw error;
  }
};

// ============================================
// BIOMETRIC SETTINGS
// ============================================

/**
 * Enable biometric authentication
 */
export const setBiometricEnabled = async (enabled) => {
  await saveSecure(STORAGE_KEYS.BIOMETRIC_ENABLED, enabled ? 'true' : 'false');
};

/**
 * Check if biometric is enabled
 */
export const isBiometricEnabled = async () => {
  const enabled = await getSecure(STORAGE_KEYS.BIOMETRIC_ENABLED);
  return enabled === 'true';
};

export default {
  saveSecure,
  getSecure,
  deleteSecure,
  saveWalletFromMnemonic,
  saveWalletKeys,
  getPrivateKey,
  getPublicKey,
  getAddress,
  getDID,
  getMnemonic,
  isWalletInitialized,
  isOnboardingCompleted,
  savePINHash,
  getPINHash,
  isPINSet,
  saveCredentials,
  getCredentials,
  addCredential,
  deleteCredential,
  clearWallet,
  setBiometricEnabled,
  isBiometricEnabled,
};