import { generateKeyPair, createDID, signData } from '../utils/crypto';
import * as secureStorage from './secureStorage';
import apiClient from './api';
import logger from '../utils/logger';
import API_CONFIG from '../config/config';

/**
 * Poll blockchain to wait for DID registration confirmation
 */
const waitForRegistration = async (address, maxAttempts = 10, delayMs = 3000) => {
  logger.info('⏳ Waiting for blockchain confirmation...');
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await apiClient.get(`/check-registration/${address}`);
      
      if (response.data.registered) {
        logger.success(`✅ DID registered confirmed! (Block: ${response.data.blockNumber})`);
        return { success: true, blockNumber: response.data.blockNumber };
      }
      
      logger.info(`   Attempt ${i + 1}/${maxAttempts} - Not confirmed yet, waiting...`);
      
      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, delayMs));
      
    } catch (error) {
      logger.error(`   Check attempt ${i + 1} failed: ${error.message}`);
    }
  }
  
  return { success: false };
};

/**
 * Register DID on blockchain via backend
 */
const registerDIDOnBlockchain = async (did, publicKey, address, privateKey) => {
  try {
    logger.info('📡 Registering DID on blockchain...');
    
    // Create proof that you own this address
    const message = `Register DID: ${did}`;
    const signature = await signData(privateKey, message);
    
    logger.info('🔐 Signed proof of ownership');
    logger.info('📤 Sending to backend...');
    
    // Backend will verify signature and submit transaction
    const response = await apiClient.post('/register-on-chain', {
      did,
      publicKey,
      address,
      signature,
      message
    });
    
    if (!response.data.success) {
      throw new Error('Backend registration failed');
    }
    
    logger.success(`⛓️ Transaction submitted!`);
    logger.success(`🔗 TX Hash: ${response.data.txHash}`);
    
    // ✅ FIX: Wait for blockchain confirmation
    const confirmation = await waitForRegistration(address);
    
    if (!confirmation.success) {
      throw new Error('Blockchain confirmation timeout. DID registration may still be pending.');
    }
    
    return {
      success: true,
      txHash: response.data.txHash,
      blockNumber: confirmation.blockNumber
    };
    
  } catch (error) {
    logger.error('Blockchain registration failed: ' + error.message);
    throw error;
  }
};

/**
 * Create new DID locally and register on blockchain
 */
export const createLocalDID = async () => {
  try {
    logger.info('🔑 Generating key pair locally...');

    const { privateKey, publicKey, address, did } = await generateKeyPair();
    logger.success(`🆔 DID created locally: ${did}`);

    // Save keys first (so user doesn't lose them if blockchain registration fails)
    await secureStorage.saveWalletKeys(privateKey, publicKey, address, did);
    logger.success('💾 Keys saved securely on device');

    try {
      // Register on blockchain and WAIT for confirmation
      const result = await registerDIDOnBlockchain(did, publicKey, address, privateKey);
      
      logger.success('✅ DID registered and confirmed on blockchain');
      
      return { 
        did, 
        address, 
        publicKey,
        registered: true,
        txHash: result.txHash,
        blockNumber: result.blockNumber
      };
      
    } catch (error) {
      logger.warning('⚠️ DID created locally but blockchain registration failed');
      logger.warning('You can try registering again later');
      
      return { 
        did, 
        address, 
        publicKey,
        registered: false,
        error: error.message
      };
    }

  } catch (error) {
    logger.error('Failed to create DID');
    throw error;
  }
};

/**
 * Retry registration for existing DID
 */
export const retryRegistration = async () => {
  try {
    const did = await secureStorage.getDID();
    const address = await secureStorage.getAddress();
    const publicKey = await secureStorage.getPublicKey();
    const privateKey = await secureStorage.getPrivateKey();
    
    if (!did || !address || !publicKey || !privateKey) {
      throw new Error('No wallet found. Create your identity first.');
    }
    
    logger.info('🔄 Retrying DID registration...');
    
    // Check if already registered
    const checkResponse = await apiClient.get(`/check-registration/${address}`);
    if (checkResponse.data.registered) {
      logger.success('✅ DID is already registered!');
      return { success: true, alreadyRegistered: true };
    }
    
    // Try to register again
    const result = await registerDIDOnBlockchain(did, publicKey, address, privateKey);
    
    return { success: true, ...result };
    
  } catch (error) {
    logger.error('Retry registration failed: ' + error.message);
    throw error;
  }
};

export const getCurrentDID = async () => {
  return await secureStorage.getDID();
};

export const getWalletInfo = async () => {
  const did = await secureStorage.getDID();
  const address = await secureStorage.getAddress();
  const publicKey = await secureStorage.getPublicKey();
  return { did, address, publicKey };
};

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

export const hasWallet = async () => {
  return await secureStorage.isWalletInitialized();
};

/**
 * Check if DID is registered - via backend API
 */
export const checkDIDRegistration = async (address) => {
  try {
    logger.info('🔍 Checking DID registration...');
    
    const response = await apiClient.get(`/check-registration/${address}`);
    
    if (response.data.registered) {
      logger.success('✅ DID is registered on blockchain');
      logger.info(`   Block: ${response.data.blockNumber}`);
    } else {
      logger.info('ℹ️ DID not registered on blockchain');
    }
    
    return response.data;
    
  } catch (error) {
    logger.error('Failed to check registration: ' + error.message);
    return { 
      registered: false, 
      error: error.message 
    };
  }
};

export default {
  createLocalDID,
  retryRegistration,
  getCurrentDID,
  getWalletInfo,
  signLocally,
  hasWallet,
  checkDIDRegistration,
};