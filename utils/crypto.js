// utils/crypto.js
// Cryptographic utilities for key generation and encryption

import * as Crypto from 'expo-crypto';
import { ethers } from 'ethers';
import { Buffer } from 'buffer';

/**
 * Custom random bytes generator for React Native
 * This replaces ethers' built-in randomBytes which doesn't work in React Native
 */
global.Buffer = Buffer;
const getRandomBytes = async (length) => {
  const randomBytes = await Crypto.getRandomBytesAsync(length);
  return randomBytes;
};

/**
 * Generate a new Ethereum key pair locally on device
 * Using Expo Crypto for React Native compatibility
 */

// export const generateKeyPair = async () => {
//   try {
//     // Generate 32 random bytes using Expo Crypto (React Native compatible)
//     const randomBytes = await Crypto.getRandomBytesAsync(32);

//     // Convert to hex string for private key
//     const privateKeyHex = '0x' + Buffer.from(randomBytes).toString('hex');

//     // Create wallet from private key (works in React Native)
//     const wallet = new ethers.Wallet(privateKeyHex);

//     // Return all values as strings for secure storage
//     return {
//       privateKey: wallet.privateKey,
//       publicKey: wallet.publicKey,
//       address: wallet.address,
//       did: `did:ethr:${wallet.address.toLowerCase()}`
//     };
//   } catch (error) {
//     console.error('Error generating key pair:', error);
//     throw error;
//   }
// };

export const generateKeyPair = async () => {
  try {
    const randomBytes = await Crypto.getRandomBytesAsync(32);
    const privateKeyHex = '0x' + Buffer.from(randomBytes).toString('hex');
    const wallet = new ethers.Wallet(privateKeyHex);

    // Get public key - ethers v6 uses signingKey
    let publicKey;
    if (wallet.signingKey && wallet.signingKey.publicKey) {
      publicKey = wallet.signingKey.publicKey;
    } else if (wallet.publicKey) {
      publicKey = wallet.publicKey;
    } else {
      // Fallback: compute from private key
      publicKey = ethers.SigningKey.computePublicKey(privateKeyHex, false);
    }

    // Ensure it's a string
    publicKey = String(publicKey);

    return {
      privateKey: wallet.privateKey,
      publicKey: publicKey,
      address: wallet.address,
      // did: `did:ethr:${wallet.address.toLowerCase()}`
      did: `did:ethr:VoltusWave:${wallet.address.toLowerCase()}`
    };
  } catch (error) {
    console.error('Error generating key pair:', error);
    throw error;
  }
};

/**
 * Create DID from Ethereum address
 * Format: did:ethr:<Network>:<address>
 */
export const createDID = (address) => {
  return `did:ethr:VoltusWave:${address.toLowerCase()}`; // Add 'development:'
};

/**
 * Sign data with private key
 */
export const signData = async (privateKey, data) => {
  try {
    const wallet = new ethers.Wallet(privateKey);
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);

    // For ethers v6
    const dataBytes = ethers.toUtf8Bytes(dataString);
    const signature = await wallet.signMessage(dataBytes);

    return signature;
  } catch (error) {
    console.error('Error signing data:', error);
    throw error;
  }
};

/**
 * Verify signature
 */
export const verifySignature = async (data, signature, address) => {
  try {
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    const dataBytes = ethers.toUtf8Bytes(dataString);

    const recoveredAddress = ethers.verifyMessage(dataBytes, signature);

    return recoveredAddress.toLowerCase() === address.toLowerCase();
  } catch (error) {
    console.error('Error verifying signature:', error);
    return false;
  }
};

/**
 * Generate random bytes for encryption
 */
export const generateRandomBytes = async (length = 32) => {
  return await Crypto.getRandomBytesAsync(length);
};

/**
 * Hash data using SHA-256
 */
export const hashData = async (data) => {
  const dataString = typeof data === 'string' ? data : JSON.stringify(data);
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    dataString
  );
  return digest;
};

/**
 * Derive address from private key
 */
export const getAddressFromPrivateKey = (privateKey) => {
  try {
    const wallet = new ethers.Wallet(privateKey);
    return wallet.address;
  } catch (error) {
    console.error('Error deriving address:', error);
    throw error;
  }
};

/**
 * Create a deterministic wallet from seed
 * Useful for wallet recovery
 */
export const createWalletFromSeed = async (seed) => {
  try {
    // Hash the seed to get consistent entropy
    const seedHash = await hashData(seed);
    const wallet = new ethers.Wallet('0x' + seedHash);

    return {
      privateKey: wallet.privateKey,
      publicKey: wallet.publicKey,
      address: wallet.address,
      did: `did:ethr:${wallet.address.toLowerCase()}`
    };
  } catch (error) {
    console.error('Error creating wallet from seed:', error);
    throw error;
  }
};

/**
 * Generate a mnemonic phrase for wallet recovery
 * Note: This won't work with ethers.Wallet.createRandom() in React Native
 * So we create our own implementation
 */
export const generateMnemonic = async () => {
  try {
    // Generate entropy for mnemonic (128 bits = 12 words)
    const entropy = await Crypto.getRandomBytesAsync(16);
    const entropyHex = Buffer.from(entropy).toString('hex');

    // Create wallet from entropy
    const mnemonic = ethers.Mnemonic.entropyToPhrase(entropyHex);

    return mnemonic;
  } catch (error) {
    console.error('Error generating mnemonic:', error);
    // Fallback: return a simple recovery phrase
    return null;
  }
};

/**
 * Restore wallet from mnemonic phrase
 */
export const restoreFromMnemonic = (mnemonic) => {
  try {
    const wallet = ethers.Wallet.fromPhrase(mnemonic);
    return {
      privateKey: wallet.privateKey,
      publicKey: wallet.publicKey,
      address: wallet.address,
      did: `did:ethr:${wallet.address.toLowerCase()}`
    };
  } catch (error) {
    console.error('Error restoring from mnemonic:', error);
    throw error;
  }
};

/**
 * Alternative simple key generation using only Expo Crypto
 * This is the most reliable method for React Native
 */
export const generateSimpleKeyPair = async () => {
  try {
    // Generate 32 random bytes
    const privateKeyBytes = await Crypto.getRandomBytesAsync(32);

    // Convert to hex string
    const privateKeyHex = '0x' + Array.from(privateKeyBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Create wallet
    const wallet = new ethers.Wallet(privateKeyHex);

    return {
      privateKey: privateKeyHex,
      address: wallet.address,
      // did: `did:ethr:${wallet.address.toLowerCase()}`
      did: `did:ethr:VoltusWave:${wallet.address.toLowerCase()}`
    };
  } catch (error) {
    console.error('Error in simple key generation:', error);
    throw error;
  }
};