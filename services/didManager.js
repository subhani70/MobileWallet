import { generateKeyPair, createDID, signData } from '../utils/crypto';
import * as secureStorage from './secureStorage';
import apiClient from './api';
import logger from '../utils/logger';
// ❌ REMOVE: import { ethers } from 'ethers';
import API_CONFIG from '../config/config';

/**
 * Register DID on blockchain via backend
 * Mobile signs proof of ownership, backend submits transaction
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
    
    logger.success(`⛓️ DID registered on blockchain!`);
    logger.success(`🔗 TX Hash: ${response.data.txHash}`);
    
    return {
      success: true,
      txHash: response.data.txHash,
      blockNumber: response.data.blockNumber
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

    await secureStorage.saveWalletKeys(privateKey, publicKey, address, did);

    try {
      await registerDIDOnBlockchain(did, publicKey, address, privateKey);
      logger.success('✅ DID registered on blockchain');
    } catch (error) {
      logger.warning('⚠️ DID created locally but blockchain registration failed');
      logger.warning('You can try registering again later');
    }

    logger.success('✅ DID created successfully');

    return { did, address, publicKey };
  } catch (error) {
    logger.error('Failed to create DID');
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
  getCurrentDID,
  getWalletInfo,
  signLocally,
  hasWallet,
  checkDIDRegistration,
};