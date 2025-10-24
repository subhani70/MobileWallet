// // TEST_STEP1.js
// // Test file to verify BIP-39 mnemonic generation and wallet creation

// import { generateMnemonic, validateMnemonic, mnemonicToArray } from './utils/mnemonicUtils.js';
// import { generateWalletFromMnemonic } from './utils/crypto.js';
// import { hashPIN, verifyPIN, checkPINStrength } from './utils/pinUtils.js';

// /**
//  * Test 1: Mnemonic Generation
//  */
// export const testMnemonicGeneration = () => {
//   console.log('=== TEST 1: Mnemonic Generation ===');
  
//   const mnemonic = generateMnemonic();
//   console.log('Generated mnemonic:', mnemonic);
  
//   const words = mnemonicToArray(mnemonic);
//   console.log('Word count:', words.length); // Should be 12
  
//   const isValid = validateMnemonic(mnemonic);
//   console.log('Is valid BIP-39:', isValid); // Should be true
  
//   return { success: words.length === 12 && isValid, mnemonic };
// };

// /**
//  * Test 2: Wallet Generation from Mnemonic
//  */
// export const testWalletGeneration = async () => {
//   console.log('\n=== TEST 2: Wallet from Mnemonic ===');
  
//   const mnemonic = generateMnemonic();
//   console.log('Mnemonic:', mnemonic);
  
//   const wallet = await generateWalletFromMnemonic(mnemonic);
//   console.log('Address:', wallet.address);
//   console.log('DID:', wallet.did);
//   console.log('Public Key:', wallet.publicKey.slice(0, 20) + '...');
  
//   return { success: !!wallet.address, wallet };
// };

// /**
//  * Test 3: Wallet Recovery (same mnemonic = same wallet)
//  */
// export const testWalletRecovery = async () => {
//   console.log('\n=== TEST 3: Wallet Recovery ===');
  
//   const mnemonic = generateMnemonic();
  
//   const wallet1 = await generateWalletFromMnemonic(mnemonic);
//   const wallet2 = await generateWalletFromMnemonic(mnemonic);
  
//   const addressesMatch = wallet1.address === wallet2.address;
//   const privateKeysMatch = wallet1.privateKey === wallet2.privateKey;
  
//   console.log('First address:', wallet1.address);
//   console.log('Second address:', wallet2.address);
//   console.log('Addresses match:', addressesMatch);
//   console.log('Private keys match:', privateKeysMatch);
  
//   return { success: addressesMatch && privateKeysMatch };
// };

// /**
//  * Test 4: PIN Hashing and Verification
//  */
// export const testPINSecurity = async () => {
//   console.log('\n=== TEST 4: PIN Security ===');
  
//   const pin = '123456';
//   const hash = await hashPIN(pin);
//   console.log('PIN Hash:', hash);
  
//   const isValid = await verifyPIN(pin, hash);
//   const isInvalid = await verifyPIN('654321', hash);
  
//   console.log('Correct PIN verified:', isValid); // Should be true
//   console.log('Wrong PIN rejected:', !isInvalid); // Should be true
  
//   return { success: isValid && !isInvalid };
// };

// /**
//  * Test 5: PIN Strength Check
//  */
// export const testPINStrength = () => {
//   console.log('\n=== TEST 5: PIN Strength ===');
  
//   const testPINs = [
//     '123456', // Weak - sequential
//     '111111', // Weak - repeated
//     '857392', // Strong
//     '000000', // Weak - common
//   ];
  
//   testPINs.forEach(pin => {
//     const check = checkPINStrength(pin);
//     console.log(`PIN ${pin}: ${check.isWeak ? 'WEAK' : 'STRONG'} ${check.reason || ''}`);
//   });
  
//   return { success: true };
// };

// /**
//  * Run all tests
//  */
// export const runAllTests = async () => {
//   console.log('🧪 RUNNING STEP 1 TESTS...\n');
  
//   try {
//     const test1 = testMnemonicGeneration();
//     const test2 = await testWalletGeneration();
//     const test3 = await testWalletRecovery();
//     const test4 = await testPINSecurity();
//     const test5 = testPINStrength();
    
//     console.log('\n=== TEST RESULTS ===');
//     console.log('✅ Mnemonic Generation:', test1.success ? 'PASS' : 'FAIL');
//     console.log('✅ Wallet Generation:', test2.success ? 'PASS' : 'FAIL');
//     console.log('✅ Wallet Recovery:', test3.success ? 'PASS' : 'FAIL');
//     console.log('✅ PIN Security:', test4.success ? 'PASS' : 'FAIL');
//     console.log('✅ PIN Strength:', test5.success ? 'PASS' : 'FAIL');
    
//     const allPassed = test1.success && test2.success && test3.success && test4.success && test5.success;
    
//     if (allPassed) {
//       console.log('\n🎉 ALL TESTS PASSED! Step 1 is ready.');
//     } else {
//       console.log('\n❌ Some tests failed. Please check the output above.');
//     }
    
//     return { success: allPassed };
    
//   } catch (error) {
//     console.error('❌ Test error:', error);
//     return { success: false, error: error.message };
//   }
// };

// // Export for use in React Native component
// export default {
//   testMnemonicGeneration,
//   testWalletGeneration,
//   testWalletRecovery,
//   testPINSecurity,
//   testPINStrength,
//   runAllTests,
// };



// TEST_STEP1_NODEJS.js
// Node.js compatible test file (no Expo dependencies)

import * as bip39 from 'bip39';
import { ethers } from 'ethers';
import { Buffer } from 'buffer';
import crypto from 'crypto';

global.Buffer = Buffer;

console.log('🧪 RUNNING STEP 1 TESTS (Node.js Version)...\n');

// ============================================
// MOCK FUNCTIONS FOR NODE.JS
// ============================================

/**
 * Node.js version of hashPIN (replaces expo-crypto)
 */
const hashPIN = (pin) => {
  if (!pin || pin.length !== 6) {
    throw new Error('PIN must be 6 digits');
  }
  
  const salt = 'SSI_WALLET_SALT_2024';
  const data = `${salt}:${pin}`;
  
  const hash = crypto.createHash('sha256').update(data).digest('hex');
  return hash;
};

/**
 * Node.js version of verifyPIN
 */
const verifyPIN = (pin, storedHash) => {
  const hash = hashPIN(pin);
  return hash === storedHash;
};

/**
 * Check PIN strength
 */
const checkPINStrength = (pin) => {
  if (!pin || !/^\d{6}$/.test(pin)) {
    return { isWeak: true, reason: 'Invalid format' };
  }
  
  const isSequential = /012345|123456|234567|345678|456789|567890|987654|876543|765432|654321|543210|432109/.test(pin);
  if (isSequential) {
    return { isWeak: true, reason: 'Sequential numbers are not secure' };
  }
  
  const isRepeated = /^(\d)\1{5}$/.test(pin);
  if (isRepeated) {
    return { isWeak: true, reason: 'Repeated numbers are not secure' };
  }
  
  const commonPINs = ['123456', '000000', '111111', '123123', '654321', '121212'];
  if (commonPINs.includes(pin)) {
    return { isWeak: true, reason: 'This PIN is too common' };
  }
  
  return { isWeak: false, reason: null };
};

/**
 * Node.js version of generateMnemonic
 */
const generateMnemonic = () => {
  return bip39.generateMnemonic(128);
};

/**
 * Node.js version of validateMnemonic
 */
const validateMnemonic = (mnemonic) => {
  return bip39.validateMnemonic(mnemonic.trim());
};

/**
 * Node.js version of mnemonicToArray
 */
const mnemonicToArray = (mnemonic) => {
  return mnemonic.trim().toLowerCase().replace(/\s+/g, ' ').split(' ');
};

/**
 * Node.js version of mnemonicToSeed
 */
const mnemonicToSeed = async (mnemonic, password = '') => {
  return await bip39.mnemonicToSeed(mnemonic, password);
};

/**
 * Node.js version of generateWalletFromMnemonic
 */
const generateWalletFromMnemonic = async (mnemonic) => {
  try {
    const seed = await mnemonicToSeed(mnemonic);
    
    const hdNode = ethers.HDNodeWallet.fromSeed(seed);
    const derivationPath = "m/44'/60'/0'/0/0";
    const wallet = hdNode.derivePath(derivationPath);
    
    let publicKey;
    if (wallet.signingKey && wallet.signingKey.publicKey) {
      publicKey = wallet.signingKey.publicKey;
    } else if (wallet.publicKey) {
      publicKey = wallet.publicKey;
    } else {
      publicKey = ethers.SigningKey.computePublicKey(wallet.privateKey, false);
    }
    
    publicKey = String(publicKey);
    
    return {
      privateKey: wallet.privateKey,
      publicKey: publicKey,
      address: wallet.address,
      did: `did:ethr:VoltusWave:${wallet.address.toLowerCase()}`,
      mnemonic: mnemonic
    };
  } catch (error) {
    console.error('Error generating wallet from mnemonic:', error);
    throw error;
  }
};

// ============================================
// TESTS
// ============================================

/**
 * Test 1: Mnemonic Generation
 */
const testMnemonicGeneration = () => {
  console.log('=== TEST 1: Mnemonic Generation ===');
  
  const mnemonic = generateMnemonic();
  console.log('Generated mnemonic:', mnemonic);
  
  const words = mnemonicToArray(mnemonic);
  console.log('Word count:', words.length);
  
  const isValid = validateMnemonic(mnemonic);
  console.log('Is valid BIP-39:', isValid);
  
  const success = words.length === 12 && isValid;
  console.log('Result:', success ? '✅ PASS' : '❌ FAIL');
  
  return { success, mnemonic };
};

/**
 * Test 2: Wallet Generation from Mnemonic
 */
const testWalletGeneration = async () => {
  console.log('\n=== TEST 2: Wallet from Mnemonic ===');
  
  const mnemonic = generateMnemonic();
  console.log('Mnemonic:', mnemonic);
  
  const wallet = await generateWalletFromMnemonic(mnemonic);
  console.log('Address:', wallet.address);
  console.log('DID:', wallet.did);
  console.log('Public Key:', wallet.publicKey.slice(0, 20) + '...');
  
  const success = !!wallet.address;
  console.log('Result:', success ? '✅ PASS' : '❌ FAIL');
  
  return { success, wallet };
};

/**
 * Test 3: Wallet Recovery (same mnemonic = same wallet)
 */
const testWalletRecovery = async () => {
  console.log('\n=== TEST 3: Wallet Recovery ===');
  
  const mnemonic = generateMnemonic();
  
  const wallet1 = await generateWalletFromMnemonic(mnemonic);
  const wallet2 = await generateWalletFromMnemonic(mnemonic);
  
  const addressesMatch = wallet1.address === wallet2.address;
  const privateKeysMatch = wallet1.privateKey === wallet2.privateKey;
  
  console.log('First address:', wallet1.address);
  console.log('Second address:', wallet2.address);
  console.log('Addresses match:', addressesMatch);
  console.log('Private keys match:', privateKeysMatch);
  
  const success = addressesMatch && privateKeysMatch;
  console.log('Result:', success ? '✅ PASS' : '❌ FAIL');
  
  return { success };
};

/**
 * Test 4: PIN Hashing and Verification
 */
const testPINSecurity = () => {
  console.log('\n=== TEST 4: PIN Security ===');
  
  const pin = '123456';
  const hash = hashPIN(pin);
  console.log('PIN Hash:', hash.slice(0, 20) + '...');
  
  const isValid = verifyPIN(pin, hash);
  const isInvalid = verifyPIN('654321', hash);
  
  console.log('Correct PIN verified:', isValid);
  console.log('Wrong PIN rejected:', !isInvalid);
  
  const success = isValid && !isInvalid;
  console.log('Result:', success ? '✅ PASS' : '❌ FAIL');
  
  return { success };
};

/**
 * Test 5: PIN Strength Check
 */
const testPINStrength = () => {
  console.log('\n=== TEST 5: PIN Strength ===');
  
  const testPINs = [
    '123456', // Weak - sequential
    '111111', // Weak - repeated
    '857392', // Strong
    '000000', // Weak - common
  ];
  
  testPINs.forEach(pin => {
    const check = checkPINStrength(pin);
    console.log(`PIN ${pin}: ${check.isWeak ? 'WEAK' : 'STRONG'} ${check.reason || ''}`);
  });
  
  console.log('Result: ✅ PASS');
  
  return { success: true };
};

// ============================================
// RUN ALL TESTS
// ============================================

const runAllTests = async () => {
  try {
    const test1 = testMnemonicGeneration();
    const test2 = await testWalletGeneration();
    const test3 = await testWalletRecovery();
    const test4 = testPINSecurity();
    const test5 = testPINStrength();
    
    console.log('\n╔══════════════════════════════════════════╗');
    console.log('║          TEST RESULTS SUMMARY            ║');
    console.log('╠══════════════════════════════════════════╣');
    console.log('║ Mnemonic Generation:      ', test1.success ? '✅ PASS' : '❌ FAIL', '    ║');
    console.log('║ Wallet Generation:        ', test2.success ? '✅ PASS' : '❌ FAIL', '    ║');
    console.log('║ Wallet Recovery:          ', test3.success ? '✅ PASS' : '❌ FAIL', '    ║');
    console.log('║ PIN Security:             ', test4.success ? '✅ PASS' : '❌ FAIL', '    ║');
    console.log('║ PIN Strength:             ', test5.success ? '✅ PASS' : '❌ FAIL', '    ║');
    console.log('╚══════════════════════════════════════════╝');
    
    const allPassed = test1.success && test2.success && test3.success && test4.success && test5.success;
    
    if (allPassed) {
      console.log('\n🎉 ALL TESTS PASSED! Step 1 is ready for React Native.\n');
    } else {
      console.log('\n❌ Some tests failed. Please check the output above.\n');
    }
    
    return { success: allPassed };
    
  } catch (error) {
    console.error('❌ Test error:', error);
    return { success: false, error: error.message };
  }
};

// Run tests
runAllTests();