// utils/pinUtils.js
// PIN hashing and validation utilities

import * as Crypto from 'expo-crypto';

/**
 * Hash a PIN using SHA-256
 * @param {string} pin - 6-digit PIN
 * @returns {Promise<string>} Hashed PIN
 */
export const hashPIN = async (pin) => {
  try {
    if (!pin || pin.length !== 6) {
      throw new Error('PIN must be 6 digits');
    }
    
    // Add salt to make it more secure
    const salt = 'SSI_WALLET_SALT_2024';
    const data = `${salt}:${pin}`;
    
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      data
    );
    
    return hash;
  } catch (error) {
    console.error('Error hashing PIN:', error);
    throw error;
  }
};

/**
 * Verify PIN against stored hash
 * @param {string} pin - PIN to verify
 * @param {string} storedHash - Stored hash to compare against
 * @returns {Promise<boolean>} True if PIN matches
 */
export const verifyPIN = async (pin, storedHash) => {
  try {
    const hash = await hashPIN(pin);
    return hash === storedHash;
  } catch (error) {
    console.error('Error verifying PIN:', error);
    return false;
  }
};

/**
 * Validate PIN format (6 digits)
 * @param {string} pin - PIN to validate
 * @returns {boolean} True if valid format
 */
export const isValidPINFormat = (pin) => {
  if (!pin) return false;
  
  // Must be exactly 6 digits
  const regex = /^\d{6}$/;
  return regex.test(pin);
};

/**
 * Check if PIN is too simple (weak)
 * @param {string} pin - PIN to check
 * @returns {object} { isWeak: boolean, reason: string }
 */
export const checkPINStrength = (pin) => {
  if (!isValidPINFormat(pin)) {
    return { isWeak: true, reason: 'Invalid format' };
  }
  
  // Check for sequential numbers (123456, 654321)
  const isSequential = /012345|123456|234567|345678|456789|567890|987654|876543|765432|654321|543210|432109/.test(pin);
  if (isSequential) {
    return { isWeak: true, reason: 'Sequential numbers are not secure' };
  }
  
  // Check for repeated numbers (111111, 222222)
  const isRepeated = /^(\d)\1{5}$/.test(pin);
  if (isRepeated) {
    return { isWeak: true, reason: 'Repeated numbers are not secure' };
  }
  
  // Check for common PINs
  const commonPINs = ['123456', '000000', '111111', '123123', '654321', '121212'];
  if (commonPINs.includes(pin)) {
    return { isWeak: true, reason: 'This PIN is too common' };
  }
  
  return { isWeak: false, reason: null };
};

/**
 * Format PIN for display (hide with dots)
 * @param {string} pin - PIN to format
 * @param {number} length - Expected length
 * @returns {string} Formatted PIN (e.g., "●●●●●●")
 */
export const formatPINDisplay = (pin, length = 6) => {
  const filled = pin.length;
  const empty = Math.max(0, length - filled);
  
  return '●'.repeat(filled) + '○'.repeat(empty);
};

export default {
  hashPIN,
  verifyPIN,
  isValidPINFormat,
  checkPINStrength,
  formatPINDisplay,
};
















