// services/accountManager.js
// High-level account management service for multi-account wallets (MetaMask-style)

import { ethers } from 'ethers';
import { deriveAccountAtIndex } from '../utils/crypto.js';
import * as secureStorage from './secureStorage.js';
import logger from '../utils/logger.js';

/**
 * Initialize multi-account system (run migration if needed)
 * Call this on app startup
 */
export const initializeAccounts = async () => {
  try {
    await secureStorage.migrateToMultiAccount();
    return true;
  } catch (error) {
    logger.error('Failed to initialize accounts: ' + error.message);
    throw error;
  }
};

/**
 * Get all accounts (without private keys)
 * @returns {Promise<Array>} Array of account objects
 */
export const getAllAccounts = async () => {
  return await secureStorage.getAllAccounts();
};

/**
 * Get active account index
 * @returns {Promise<number>} Active account index (defaults to 0)
 */
export const getActiveAccountIndex = async () => {
  return await secureStorage.getActiveAccountIndex();
};

/**
 * Get active account
 * @param {boolean} includePrivateKey - Whether to include private key
 * @returns {Promise<object|null>} Active account object
 */
export const getActiveAccount = async (includePrivateKey = false) => {
  return await secureStorage.getActiveAccount(includePrivateKey);
};

/**
 * Get account by index
 * @param {number} accountIndex - Account index
 * @param {boolean} includePrivateKey - Whether to include private key
 * @returns {Promise<object|null>} Account object
 */
export const getAccountByIndex = async (accountIndex, includePrivateKey = false) => {
  return await secureStorage.getAccountByIndex(accountIndex, includePrivateKey);
};

/**
 * Create a new account from mnemonic
 * @param {string} label - Optional label for the account
 * @returns {Promise<object>} New account object
 */
export const createNewAccount = async (label = null) => {
  try {
    // Get mnemonic
    const mnemonic = await secureStorage.getMnemonic();
    if (!mnemonic) {
      throw new Error('Mnemonic not found. Cannot create new account.');
    }

    // Get next account index
    const accountIndex = await secureStorage.getNextAccountIndex();

    // Derive account at this index
    logger.info(`🔑 Deriving account ${accountIndex}...`);
    const walletData = await deriveAccountAtIndex(mnemonic, accountIndex);

    // Create account object
    const accountData = {
      index: accountIndex,
      address: walletData.address,
      privateKey: walletData.privateKey,
      publicKey: walletData.publicKey,
      did: walletData.did,
      label: label || `Account ${accountIndex + 1}`,
      derivationPath: walletData.derivationPath,
    };

    // Save account
    await secureStorage.addAccount(accountData);

    logger.success(`✅ Created account ${accountIndex}: ${walletData.address.substring(0, 10)}...`);

    // Return account without private key
    const { privateKey, ...account } = accountData;
    return account;
  } catch (error) {
    logger.error('Failed to create new account: ' + error.message);
    throw error;
  }
};

/**
 * Import an existing account using a raw private key
 * @param {string} privateKeyInput - Private key provided by user
 * @param {string|null} label - Optional label for the account
 * @returns {Promise<object>} Imported account object (without private key)
 */
export const importAccountFromPrivateKey = async (privateKeyInput, label = null) => {
  try {
    if (!privateKeyInput || typeof privateKeyInput !== 'string') {
      throw new Error('Private key is required');
    }

    let normalizedKey = privateKeyInput.trim();
    if (!normalizedKey.startsWith('0x')) {
      normalizedKey = `0x${normalizedKey}`;
    }

    if (!ethers.isHexString(normalizedKey, 32)) {
      throw new Error('Invalid private key format');
    }

    const wallet = new ethers.Wallet(normalizedKey);
    const accountsWithKeys = await secureStorage.getAllAccountsWithKeys();
    const exists = accountsWithKeys.some(
      (account) => account.address?.toLowerCase() === wallet.address.toLowerCase()
    );
    if (exists) {
      throw new Error('This account is already added');
    }

    const accountIndex = await secureStorage.getNextAccountIndex();
    const publicKey =
      wallet.signingKey?.publicKey ||
      wallet.publicKey ||
      ethers.SigningKey.computePublicKey(wallet.privateKey, false);

    const accountData = {
      index: accountIndex,
      address: wallet.address,
      privateKey: wallet.privateKey,
      publicKey: String(publicKey),
      did: `did:ethr:VoltusWave:${wallet.address.toLowerCase()}`,
      label: label?.trim() || `Imported ${accountIndex + 1}`,
      derivationPath: 'imported-private-key',
      createdAt: new Date().toISOString(),
      isImported: true,
    };

    await secureStorage.addAccount(accountData);
    await secureStorage.setActiveAccount(accountIndex);

    logger.success(`✅ Imported account ${accountIndex}: ${wallet.address.substring(0, 10)}...`);

    const { privateKey, ...account } = accountData;
    return account;
  } catch (error) {
    logger.error('Failed to import account: ' + error.message);
    throw error;
  }
};

/**
 * Switch to a different account
 * @param {number} accountIndex - Account index to switch to
 * @returns {Promise<boolean>} Success status
 */
export const switchAccount = async (accountIndex) => {
  try {
    await secureStorage.setActiveAccount(accountIndex);
    logger.success(`✅ Switched to account ${accountIndex}`);
    return true;
  } catch (error) {
    logger.error('Failed to switch account: ' + error.message);
    throw error;
  }
};

/**
 * Update account label
 * @param {number} accountIndex - Account index
 * @param {string} label - New label
 * @returns {Promise<boolean>} Success status
 */
export const updateAccountLabel = async (accountIndex, label) => {
  try {
    if (!label || label.trim().length === 0) {
      throw new Error('Label cannot be empty');
    }
    await secureStorage.updateAccount(accountIndex, { label: label.trim() });
    logger.success(`✅ Updated account ${accountIndex} label to "${label}"`);
    return true;
  } catch (error) {
    logger.error('Failed to update account label: ' + error.message);
    throw error;
  }
};

/**
 * Delete an account
 * @param {number} accountIndex - Account index to delete
 * @returns {Promise<boolean>} Success status
 */
export const deleteAccount = async (accountIndex) => {
  try {
    await secureStorage.deleteAccount(accountIndex);
    logger.success(`✅ Deleted account ${accountIndex}`);
    return true;
  } catch (error) {
    logger.error('Failed to delete account: ' + error.message);
    throw error;
  }
};

/**
 * Get active account's private key (for signing transactions)
 * @returns {Promise<string|null>} Private key or null
 */
export const getActiveAccountPrivateKey = async () => {
  try {
    const account = await secureStorage.getActiveAccount(true);
    return account ? account.privateKey : null;
  } catch (error) {
    logger.error('Failed to get active account private key');
    return null;
  }
};

/**
 * Get active account's address
 * @returns {Promise<string|null>} Address or null
 */
export const getActiveAccountAddress = async () => {
  try {
    const account = await secureStorage.getActiveAccount();
    return account ? account.address : null;
  } catch (error) {
    logger.error('Failed to get active account address');
    return null;
  }
};

/**
 * Get active account's DID
 * @returns {Promise<string|null>} DID or null
 */
export const getActiveAccountDID = async () => {
  try {
    const account = await secureStorage.getActiveAccount();
    return account ? account.did : null;
  } catch (error) {
    logger.error('Failed to get active account DID');
    return null;
  }
};

/**
 * Check if account exists
 * @param {number} accountIndex - Account index
 * @returns {Promise<boolean>} True if account exists
 */
export const accountExists = async (accountIndex) => {
  try {
    const account = await secureStorage.getAccountByIndex(accountIndex);
    return account !== null;
  } catch (error) {
    return false;
  }
};

/**
 * Get account count
 * @returns {Promise<number>} Number of accounts
 */
export const getAccountCount = async () => {
  try {
    const accounts = await secureStorage.getAllAccounts();
    return accounts.length;
  } catch (error) {
    return 0;
  }
};

export default {
  initializeAccounts,
  getAllAccounts,
  getActiveAccountIndex,
  getActiveAccount,
  getAccountByIndex,
  createNewAccount,
  importAccountFromPrivateKey,
  switchAccount,
  updateAccountLabel,
  deleteAccount,
  getActiveAccountPrivateKey,
  getActiveAccountAddress,
  getActiveAccountDID,
  accountExists,
  getAccountCount,
};

