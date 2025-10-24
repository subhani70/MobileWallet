// utils/mnemonicUtils.js
// BIP-39 Mnemonic utilities for wallet creation and recovery

import * as bip39 from 'bip39';
import { Buffer } from 'buffer';

global.Buffer = Buffer;

/**
 * Generate a new 12-word BIP-39 mnemonic phrase
 * @returns {string} 12-word mnemonic phrase
 */
export const generateMnemonic = () => {
  try {
    // Generate 128 bits of entropy = 12 words
    const mnemonic = bip39.generateMnemonic(128);
    return mnemonic;
  } catch (error) {
    console.error('Error generating mnemonic:', error);
    throw new Error('Failed to generate mnemonic');
  }
};

/**
 * Validate if a mnemonic phrase is valid according to BIP-39
 * @param {string} mnemonic - The mnemonic phrase to validate
 * @returns {boolean} True if valid, false otherwise
 */
export const validateMnemonic = (mnemonic) => {
  try {
    return bip39.validateMnemonic(mnemonic.trim());
  } catch (error) {
    console.error('Error validating mnemonic:', error);
    return false;
  }
};

/**
 * Convert mnemonic to seed (used for key derivation)
 * @param {string} mnemonic - The mnemonic phrase
 * @param {string} password - Optional password for additional security
 * @returns {Promise<Buffer>} The seed buffer
 */
export const mnemonicToSeed = async (mnemonic, password = '') => {
  try {
    const seed = await bip39.mnemonicToSeed(mnemonic, password);
    return seed;
  } catch (error) {
    console.error('Error converting mnemonic to seed:', error);
    throw new Error('Failed to convert mnemonic to seed');
  }
};

/**
 * Convert mnemonic to entropy
 * @param {string} mnemonic - The mnemonic phrase
 * @returns {string} Hex string of entropy
 */
export const mnemonicToEntropy = (mnemonic) => {
  try {
    return bip39.mnemonicToEntropy(mnemonic);
  } catch (error) {
    console.error('Error converting mnemonic to entropy:', error);
    throw new Error('Failed to convert mnemonic to entropy');
  }
};

/**
 * Convert entropy to mnemonic
 * @param {string} entropy - Hex string of entropy
 * @returns {string} Mnemonic phrase
 */
export const entropyToMnemonic = (entropy) => {
  try {
    return bip39.entropyToMnemonic(entropy);
  } catch (error) {
    console.error('Error converting entropy to mnemonic:', error);
    throw new Error('Failed to convert entropy to mnemonic');
  }
};

/**
 * Get the BIP-39 wordlist
 * @returns {string[]} Array of 2048 words
 */
export const getWordlist = () => {
  return bip39.wordlists.english;
};

/**
 * Check if a word exists in the BIP-39 wordlist
 * @param {string} word - Word to check
 * @returns {boolean} True if word exists
 */
export const isValidWord = (word) => {
  const wordlist = getWordlist();
  return wordlist.includes(word.toLowerCase());
};

/**
 * Get word suggestions based on partial input
 * @param {string} partial - Partial word input
 * @returns {string[]} Array of matching words
 */
export const getWordSuggestions = (partial) => {
  if (!partial || partial.length === 0) return [];
  
  const wordlist = getWordlist();
  const lowerPartial = partial.toLowerCase();
  
  return wordlist
    .filter(word => word.startsWith(lowerPartial))
    .slice(0, 5); // Return max 5 suggestions
};

/**
 * Format mnemonic phrase (trim, lowercase, single spaces)
 * @param {string} mnemonic - Raw mnemonic input
 * @returns {string} Formatted mnemonic
 */
export const formatMnemonic = (mnemonic) => {
  return mnemonic
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' '); // Replace multiple spaces with single space
};

/**
 * Split mnemonic into array of words
 * @param {string} mnemonic - Mnemonic phrase
 * @returns {string[]} Array of words
 */
export const mnemonicToArray = (mnemonic) => {
  return formatMnemonic(mnemonic).split(' ');
};

/**
 * Check if mnemonic has correct word count
 * @param {string} mnemonic - Mnemonic phrase
 * @returns {boolean} True if 12 words
 */
export const hasCorrectWordCount = (mnemonic) => {
  const words = mnemonicToArray(mnemonic);
  return words.length === 12;
};

/**
 * Get random word indices for verification (used in verification screen)
 * @param {number} count - Number of random indices to get
 * @returns {number[]} Array of random indices (0-11)
 */
export const getRandomIndices = (count = 3) => {
  const indices = [];
  while (indices.length < count) {
    const random = Math.floor(Math.random() * 12);
    if (!indices.includes(random)) {
      indices.push(random);
    }
  }
  return indices.sort((a, b) => a - b);
};

export default {
  generateMnemonic,
  validateMnemonic,
  mnemonicToSeed,
  mnemonicToEntropy,
  entropyToMnemonic,
  getWordlist,
  isValidWord,
  getWordSuggestions,
  formatMnemonic,
  mnemonicToArray,
  hasCorrectWordCount,
  getRandomIndices,
};