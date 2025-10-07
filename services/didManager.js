// services/didManager.js
// DID Manager - Creates DIDs locally, registers on blockchain

import { generateKeyPair, createDID, signData } from '../utils/crypto';
import * as secureStorage from './secureStorage';
import apiClient from './api';
import logger from '../utils/logger';

/**
 * Create new DID locally (private key stays on device)
 */
export const createLocalDID = async () => {
  try {
    logger.info('🔑 Generating key pair locally...');
    
    // Generate key pair on device
    const { privateKey, publicKey, address, did } = await generateKeyPair();
    
    logger.success(`🆔 DID created locally: ${did}`);
    
    // Save keys securely on device (encrypted)
    await secureStorage.saveWalletKeys(privateKey, publicKey, address, did);
    
    // Register DID on blockchain
    try {
      await registerDIDOnBlockchain(did, publicKey, address);
    } catch (error) {
      logger.warning('⚠️ DID created locally but blockchain registration failed');
    }
    
    logger.success('✅ DID created successfully');
    
    return {
      did,
      address,
      publicKey,
    };
  } catch (error) {
    logger.error('Failed to create DID');
    throw error;
  }
};

/**
 * Register DID on blockchain via backend
 * Only sends public information
 */
const registerDIDOnBlockchain = async (did, publicKey, address) => {
  try {
    logger.info('📡 Registering DID on blockchain...');
    
    const response = await apiClient.post('/register', {
      did,
      publicKey,
      address,
    });
    
    logger.success(`⛓️ DID registered on blockchain: ${response.data.txHash}`);
    return response.data;
  } catch (error) {
    logger.error('Blockchain registration failed');
    throw error;
  }
};

/**
 * Get current DID from secure storage
 */
export const getCurrentDID = async () => {
  return await secureStorage.getDID();
};

/**
 * Get wallet info
 */
export const getWalletInfo = async () => {
  const did = await secureStorage.getDID();
  const address = await secureStorage.getAddress();
  const publicKey = await secureStorage.getPublicKey();
  
  return {
    did,
    address,
    publicKey,
  };
};

/**
 * Sign credential or presentation locally
 */
export const signLocally = async (data) => {
  try {
    const privateKey = await secureStorage.getPrivateKey();
    
    if (!privateKey) {
      throw new Error('No private key found');
    }
    
    const signature = await signData(privateKey, data);
    logger.success('✍️ Data signed locally');
    
    return signature;
  } catch (error) {
    logger.error('Failed to sign data');
    throw error;
  }
};

/**
 * Check if wallet exists
 */
export const hasWallet = async () => {
  return await secureStorage.isWalletInitialized();
};

export default {
  createLocalDID,
  getCurrentDID,
  getWalletInfo,
  signLocally,
  hasWallet,
};