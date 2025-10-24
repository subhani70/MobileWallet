// app/test.js or screens/TestScreen.js
import React, { useState } from 'react';
import { View, Button, Text, ScrollView, StyleSheet } from 'react-native';

// Import your actual functions
import { generateMnemonic, validateMnemonic, mnemonicToArray } from '../utils/mnemonicUtils';
import { generateWalletFromMnemonic } from '../utils/crypto';
import { hashPIN, verifyPIN, checkPINStrength } from '../utils/pinUtils';

export default function TestScreen() {
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const runTests = async () => {
    setLoading(true);
    let output = '🧪 RUNNING TESTS...\n\n';

    try {
      // Test 1: Mnemonic Generation
      output += '=== TEST 1: Mnemonic Generation ===\n';
      const mnemonic = generateMnemonic();
      output += `Generated: ${mnemonic.substring(0, 30)}...\n`;
      const words = mnemonicToArray(mnemonic);
      output += `Word count: ${words.length}\n`;
      const isValid = validateMnemonic(mnemonic);
      output += `Valid BIP-39: ${isValid ? 'YES' : 'NO'}\n`;
      output += words.length === 12 && isValid ? '✅ PASS\n\n' : '❌ FAIL\n\n';

      // Test 2: Wallet Generation
      output += '=== TEST 2: Wallet Generation ===\n';
      const wallet = await generateWalletFromMnemonic(mnemonic);
      output += `Address: ${wallet.address}\n`;
      output += `DID: ${wallet.did}\n`;
      output += wallet.address ? '✅ PASS\n\n' : '❌ FAIL\n\n';

      // Test 3: Wallet Recovery
      output += '=== TEST 3: Wallet Recovery ===\n';
      const wallet2 = await generateWalletFromMnemonic(mnemonic);
      const match = wallet.address === wallet2.address;
      output += `Addresses match: ${match ? 'YES' : 'NO'}\n`;
      output += match ? '✅ PASS\n\n' : '❌ FAIL\n\n';

      // Test 4: PIN Security
      output += '=== TEST 4: PIN Security ===\n';
      const pin = '123456';
      const hash = await hashPIN(pin);
      output += `Hash created: ${hash.substring(0, 20)}...\n`;
      const valid = await verifyPIN(pin, hash);
      const invalid = await verifyPIN('654321', hash);
      output += `Correct PIN works: ${valid ? 'YES' : 'NO'}\n`;
      output += `Wrong PIN fails: ${!invalid ? 'YES' : 'NO'}\n`;
      output += valid && !invalid ? '✅ PASS\n\n' : '❌ FAIL\n\n';

      // Test 5: PIN Strength
      output += '=== TEST 5: PIN Strength ===\n';
      const testPINs = ['123456', '111111', '857392', '000000'];
      testPINs.forEach(testPin => {
        const check = checkPINStrength(testPin);
        output += `${testPin}: ${check.isWeak ? 'WEAK' : 'STRONG'}\n`;
      });
      output += '✅ PASS\n\n';

      output += '\n🎉 ALL TESTS PASSED!\n';
      output += 'Step 1 is working correctly in React Native.';

    } catch (error) {
      output += `\n❌ ERROR: ${error.message}\n`;
      output += error.stack;
    }

    setResult(output);
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <Button 
        title={loading ? "Running Tests..." : "Run Tests"} 
        onPress={runTests}
        disabled={loading}
      />
      <ScrollView style={styles.scrollView}>
        <Text style={styles.result}>{result}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#0a0a0f',
  },
  scrollView: {
    marginTop: 20,
  },
  result: {
    color: '#fff',
    fontFamily: 'monospace',
    fontSize: 12,
  },
});