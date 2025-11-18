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
  // Multi-account storage keys
  ACCOUNTS: 'ssi_accounts',
  ACTIVE_ACCOUNT_INDEX: 'ssi_active_account_index',
  ACCOUNTS_MIGRATED: 'ssi_accounts_migrated',
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
    // Only log errors, not every retrieval (reduces log spam)
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
    // Clear multi-account data
    await deleteSecure(STORAGE_KEYS.ACCOUNTS);
    await deleteSecure(STORAGE_KEYS.ACTIVE_ACCOUNT_INDEX);
    await deleteSecure(STORAGE_KEYS.ACCOUNTS_MIGRATED);
    
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

// ============================================
// MULTI-ACCOUNT MANAGEMENT (MetaMask-style)
// ============================================

/**
 * Account data structure:
 * {
 *   index: number,
 *   address: string,
 *   privateKey: string (encrypted in storage),
 *   publicKey: string,
 *   did: string,
 *   label: string (optional, user-friendly name),
 *   createdAt: string (ISO timestamp),
 *   derivationPath: string
 * }
 */

/**
 * Get all accounts
 * @returns {Promise<Array>} Array of account objects
 */
export const getAllAccounts = async () => {
  try {
    const accountsJson = await getSecure(STORAGE_KEYS.ACCOUNTS);
    if (accountsJson) {
      const accounts = JSON.parse(accountsJson);
      // Don't return private keys in the list (security)
      return accounts.map(({ privateKey, ...account }) => account);
    }
    return [];
  } catch (error) {
    logger.error('Failed to get accounts');
    return [];
  }
};

/**
 * Get all accounts with private keys (for internal use only)
 * @returns {Promise<Array>} Array of account objects with private keys
 */
export const getAllAccountsWithKeys = async () => {
  try {
    const accountsJson = await getSecure(STORAGE_KEYS.ACCOUNTS);
    if (accountsJson) {
      return JSON.parse(accountsJson);
    }
    return [];
  } catch (error) {
    logger.error('Failed to get accounts with keys');
    return [];
  }
};

/**
 * Get account by index
 * @param {number} accountIndex - Account index
 * @param {boolean} includePrivateKey - Whether to include private key
 * @returns {Promise<object|null>} Account object or null
 */
export const getAccountByIndex = async (accountIndex, includePrivateKey = false) => {
  try {
    const accounts = await getAllAccountsWithKeys();
    const account = accounts.find(acc => acc.index === accountIndex);
    if (!account) return null;
    
    if (!includePrivateKey) {
      const { privateKey, ...accountWithoutKey } = account;
      return accountWithoutKey;
    }
    return account;
  } catch (error) {
    logger.error(`Failed to get account ${accountIndex}`);
    return null;
  }
};

/**
 * Get active account index
 * @returns {Promise<number>} Active account index (defaults to 0)
 */
export const getActiveAccountIndex = async () => {
  try {
    const indexStr = await getSecure(STORAGE_KEYS.ACTIVE_ACCOUNT_INDEX);
    return indexStr ? parseInt(indexStr, 10) : 0;
  } catch (error) {
    logger.error('Failed to get active account index');
    return 0;
  }
};

/**
 * Get active account
 * @param {boolean} includePrivateKey - Whether to include private key
 * @returns {Promise<object|null>} Active account object or null
 */
export const getActiveAccount = async (includePrivateKey = false) => {
  try {
    const activeIndex = await getActiveAccountIndex();
    return await getAccountByIndex(activeIndex, includePrivateKey);
  } catch (error) {
    logger.error('Failed to get active account');
    return null;
  }
};

/**
 * Save accounts array
 * @param {Array} accounts - Array of account objects
 * @returns {Promise<boolean>} Success status
 */
export const saveAccounts = async (accounts) => {
  try {
    const accountsJson = JSON.stringify(accounts);
    await saveSecure(STORAGE_KEYS.ACCOUNTS, accountsJson);
    logger.success(`✅ Saved ${accounts.length} account(s)`);
    return true;
  } catch (error) {
    logger.error('Failed to save accounts');
    throw error;
  }
};

/**
 * Add a new account
 * @param {object} accountData - Account data (index, address, privateKey, publicKey, did, label?, derivationPath)
 * @returns {Promise<boolean>} Success status
 */
export const addAccount = async (accountData) => {
  try {
    const accounts = await getAllAccountsWithKeys();
    
    // Check if account with this index already exists
    if (accounts.some(acc => acc.index === accountData.index)) {
      throw new Error(`Account with index ${accountData.index} already exists`);
    }
    
    // Add account
    accounts.push({
      ...accountData,
      createdAt: accountData.createdAt || new Date().toISOString(),
      label: accountData.label || `Account ${accountData.index + 1}`,
    });
    
    // Sort by index
    accounts.sort((a, b) => a.index - b.index);
    
    await saveAccounts(accounts);
    logger.success(`✅ Added account ${accountData.index}`);
    return true;
  } catch (error) {
    logger.error('Failed to add account');
    throw error;
  }
};

/**
 * Update account (e.g., change label)
 * @param {number} accountIndex - Account index
 * @param {object} updates - Fields to update (label, etc.)
 * @returns {Promise<boolean>} Success status
 */
export const updateAccount = async (accountIndex, updates) => {
  try {
    const accounts = await getAllAccountsWithKeys();
    const accountIndex_found = accounts.findIndex(acc => acc.index === accountIndex);
    
    if (accountIndex_found === -1) {
      throw new Error(`Account with index ${accountIndex} not found`);
    }
    
    // Update account (don't allow updating private key, address, etc.)
    const allowedUpdates = ['label'];
    Object.keys(updates).forEach(key => {
      if (allowedUpdates.includes(key)) {
        accounts[accountIndex_found][key] = updates[key];
      }
    });
    
    await saveAccounts(accounts);
    logger.success(`✅ Updated account ${accountIndex}`);
    return true;
  } catch (error) {
    logger.error('Failed to update account');
    throw error;
  }
};

/**
 * Set active account
 * @param {number} accountIndex - Account index to set as active
 * @returns {Promise<boolean>} Success status
 */
export const setActiveAccount = async (accountIndex) => {
  try {
    const accounts = await getAllAccounts();
    if (!accounts.some(acc => acc.index === accountIndex)) {
      throw new Error(`Account with index ${accountIndex} does not exist`);
    }
    
    await saveSecure(STORAGE_KEYS.ACTIVE_ACCOUNT_INDEX, accountIndex.toString());
    logger.success(`✅ Set account ${accountIndex} as active`);
    return true;
  } catch (error) {
    logger.error('Failed to set active account');
    throw error;
  }
};

/**
 * Delete account (cannot delete if it's the only account)
 * @param {number} accountIndex - Account index to delete
 * @returns {Promise<boolean>} Success status
 */
export const deleteAccount = async (accountIndex) => {
  try {
    const accounts = await getAllAccountsWithKeys();
    
    if (accounts.length <= 1) {
      throw new Error('Cannot delete the last remaining account');
    }
    
    const filtered = accounts.filter(acc => acc.index !== accountIndex);
    
    if (filtered.length === accounts.length) {
      throw new Error(`Account with index ${accountIndex} not found`);
    }
    
    await saveAccounts(filtered);
    
    // If deleted account was active, switch to account 0
    const activeIndex = await getActiveAccountIndex();
    if (activeIndex === accountIndex) {
      await setActiveAccount(0);
    }
    
    logger.success(`✅ Deleted account ${accountIndex}`);
    return true;
  } catch (error) {
    logger.error('Failed to delete account');
    throw error;
  }
};

/**
 * Migrate existing single account to multi-account structure
 * This converts the old storage format to the new accounts array
 * @returns {Promise<boolean>} Success status
 */
export const migrateToMultiAccount = async () => {
  try {
    // Check if already migrated
    const migrated = await getSecure(STORAGE_KEYS.ACCOUNTS_MIGRATED);
    if (migrated === 'true') {
      logger.info('Accounts already migrated');
      return true;
    }
    
    // Check if wallet is initialized
    const initialized = await isWalletInitialized();
    if (!initialized) {
      // No wallet to migrate
      await saveSecure(STORAGE_KEYS.ACCOUNTS_MIGRATED, 'true');
      return true;
    }
    
    logger.info('🔄 Migrating to multi-account structure...');
    
    // Get existing account data
    const [privateKey, publicKey, address, did, mnemonic] = await Promise.all([
      getPrivateKey(),
      getPublicKey(),
      getAddress(),
      getDID(),
      getMnemonic(),
    ]);
    
    if (!privateKey || !address) {
      logger.warning('No existing account data found to migrate');
      await saveSecure(STORAGE_KEYS.ACCOUNTS_MIGRATED, 'true');
      return true;
    }
    
    // Create Account 0 from existing data
    const account0 = {
      index: 0,
      address: address,
      privateKey: privateKey,
      publicKey: publicKey || '',
      did: did || `did:ethr:VoltusWave:${address.toLowerCase()}`,
      label: 'Account 1',
      createdAt: new Date().toISOString(),
      derivationPath: "m/44'/60'/0'/0/0",
    };
    
    // Save as accounts array
    await saveAccounts([account0]);
    await setActiveAccount(0);
    await saveSecure(STORAGE_KEYS.ACCOUNTS_MIGRATED, 'true');
    
    logger.success('✅ Migration completed: Existing wallet is now Account 0');
    return true;
  } catch (error) {
    logger.error('Failed to migrate to multi-account: ' + error.message);
    throw error;
  }
};

/**
 * Get next available account index
 * @returns {Promise<number>} Next available account index
 */
export const getNextAccountIndex = async () => {
  try {
    const accounts = await getAllAccounts();
    if (accounts.length === 0) return 0;
    
    const maxIndex = Math.max(...accounts.map(acc => acc.index));
    return maxIndex + 1;
  } catch (error) {
    logger.error('Failed to get next account index');
    return 0;
  }
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
  // Multi-account functions
  getAllAccounts,
  getAllAccountsWithKeys,
  getAccountByIndex,
  getActiveAccountIndex,
  getActiveAccount,
  saveAccounts,
  addAccount,
  updateAccount,
  setActiveAccount,
  deleteAccount,
  migrateToMultiAccount,
  getNextAccountIndex,
};