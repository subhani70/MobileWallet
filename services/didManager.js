// services/didManager.js - MNEMONIC-BASED DID CREATION
import { generateWalletFromMnemonic } from '../utils/crypto';
import { generateMnemonic, validateMnemonic } from '../utils/mnemonicUtils';
import { hashPIN } from '../utils/pinUtils';
import * as secureStorage from './secureStorage';
import apiClient from './api';
import logger from '../utils/logger';

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
    
    const { signData } = require('../utils/crypto');
    const message = `Register DID: ${did}`;
    const signature = await signData(privateKey, message);
    
    logger.info('🔐 Signed proof of ownership');
    logger.info('📤 Sending to backend...');
    
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
    
    // Wait for blockchain confirmation
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
 * STRICT: Create DID from BIP-39 Mnemonic - Must succeed on blockchain or fail completely
 * This creates a MetaMask-compatible wallet!
 */
export const createLocalDID = async () => {
  let mnemonic = null;
  let keysGenerated = false;
  
  try {
    // Step 1: Check backend connectivity first
    logger.info('🌐 Checking blockchain connectivity...');
    try {
      await apiClient.get('/health');
    } catch (error) {
      throw new Error('Blockchain network is not accessible. Please check your connection.');
    }
    
    // Step 2: Generate BIP-39 mnemonic (12 words)
    logger.info('🎲 Generating BIP-39 mnemonic phrase...');
    mnemonic = generateMnemonic();
    
    if (!validateMnemonic(mnemonic)) {
      throw new Error('Generated mnemonic is invalid');
    }
    
    logger.success('✅ Mnemonic generated: 12 words');
    logger.info('📝 First word: ' + mnemonic.split(' ')[0] + '...');
    
    // Step 3: Derive wallet from mnemonic (MetaMask compatible - m/44'/60'/0'/0/0)
    logger.info('🔑 Deriving cryptographic keys from mnemonic...');
    const walletData = await generateWalletFromMnemonic(mnemonic);
    keysGenerated = true;
    
    logger.success(`✅ Wallet derived!`);
    logger.info(`🆔 DID: ${walletData.did}`);
    logger.info(`📍 Address: ${walletData.address}`);
    
    // Step 4: Create a temporary PIN hash (you can skip this if not using PIN yet)
    // For now, we'll use a placeholder - users can set PIN later
    const tempPIN = '000000'; // Temporary placeholder
    const pinHash = await hashPIN(tempPIN);
    
    // Step 5: Save wallet with mnemonic
    logger.info('💾 Securing wallet...');
    await secureStorage.saveWalletFromMnemonic(
      walletData.privateKey,
      walletData.publicKey,
      walletData.address,
      walletData.did,
      mnemonic,
      pinHash
    );
    
    logger.success('✅ Wallet saved securely');
    
    // Step 6: Register on blockchain (MUST SUCCEED)
    logger.info('⛓️ Registering on blockchain...');
    const registrationResult = await registerDIDOnBlockchain(
      walletData.did,
      walletData.publicKey,
      walletData.address,
      walletData.privateKey
    );
    
    if (!registrationResult.success) {
      throw new Error('Blockchain registration failed. Transaction was not confirmed.');
    }
    
    logger.success('✅ DID fully registered and confirmed on blockchain!');
    logger.success(`📦 Block: ${registrationResult.blockNumber}`);
    logger.success(`🔗 TX Hash: ${registrationResult.txHash}`);
    
    return { 
      did: walletData.did, 
      address: walletData.address, 
      publicKey: walletData.publicKey,
      mnemonic: mnemonic, // Return mnemonic so user can back it up
      registered: true,
      txHash: registrationResult.txHash,
      blockNumber: registrationResult.blockNumber
    };
    
  } catch (error) {
    logger.error('❌ DID creation failed: ' + error.message);
    
    // Clean up if keys were generated
    if (keysGenerated) {
      logger.info('🧹 Cleaning up failed attempt...');
      await secureStorage.clearWallet();
    }
    
    // Re-throw with clear message
    throw new Error(error.message || 'Failed to create digital identity');
  }
};

/**
 * Restore wallet from existing mnemonic
 */
export const restoreFromMnemonic = async (mnemonic, pin) => {
  try {
    // Validate mnemonic
    if (!validateMnemonic(mnemonic)) {
      throw new Error('Invalid recovery phrase. Please check and try again.');
    }
    
    logger.info('🔄 Restoring wallet from mnemonic...');
    
    // Derive wallet
    const walletData = await generateWalletFromMnemonic(mnemonic);
    
    // Hash PIN
    const pinHash = await hashPIN(pin);
    
    // Save wallet
    await secureStorage.saveWalletFromMnemonic(
      walletData.privateKey,
      walletData.publicKey,
      walletData.address,
      walletData.did,
      mnemonic,
      pinHash
    );
    
    logger.success('✅ Wallet restored successfully');
    
    return {
      did: walletData.did,
      address: walletData.address,
      publicKey: walletData.publicKey,
    };
    
  } catch (error) {
    logger.error('Failed to restore wallet: ' + error.message);
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
  const mnemonic = await secureStorage.getMnemonic();
  return { did, address, publicKey, hasMnemonic: !!mnemonic };
};

export const getMnemonic = async () => {
  return await secureStorage.getMnemonic();
};

export const hasWallet = async () => {
  return await secureStorage.isWalletInitialized();
};

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
    return { registered: false, error: error.message };
  }
};

export default {
  createLocalDID,
  restoreFromMnemonic,
  getCurrentDID,
  getWalletInfo,
  getMnemonic,
  hasWallet,
  checkDIDRegistration,
};