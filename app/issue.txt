// app/issue.js
// Issue Test Credentials to Your DID

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as didManager from '../services/didManager';
import logger from '../utils/logger';
import * as vcService from '../services/vcService';

export default function IssueCredentialScreen() {
  const [walletInfo, setWalletInfo] = useState(null);
  const [isIssuing, setIsIssuing] = useState(false);
  
  const [credentialType, setCredentialType] = useState('');
  const [claimKey, setClaimKey] = useState('');
  const [claimValue, setClaimValue] = useState('');
  const [additionalClaims, setAdditionalClaims] = useState([]);

  useEffect(() => {
    loadWallet();
  }, []);

  const loadWallet = async () => {
    const info = await didManager.getWalletInfo();
    setWalletInfo(info);
  };

  const addClaim = () => {
    if (claimKey && claimValue) {
      setAdditionalClaims([...additionalClaims, { key: claimKey, value: claimValue }]);
      setClaimKey('');
      setClaimValue('');
    }
  };

  const removeClaim = (index) => {
    setAdditionalClaims(additionalClaims.filter((_, i) => i !== index));
  };

  const issueCredential = async () => {
    if (!walletInfo?.did) {
      Alert.alert('Error', 'No DID found. Create your identity first.');
      return;
    }

    if (additionalClaims.length === 0) {
      Alert.alert('Error', 'Add at least one claim to the credential.');
      return;
    }

    setIsIssuing(true);

    try {
      const claims = {};
      additionalClaims.forEach(claim => {
        claims[claim.key] = claim.value;
      });

      if (credentialType) {
        claims.credentialType = credentialType;
      }

      const credential = await vcService.issueCredentialLocally(claims);
      
      logger.success('Credential issued and stored locally');

      Alert.alert(
        'Success',
        'Credential added to your wallet!\n\nGo to Wallet tab to see it.',
        [{ text: 'OK', onPress: () => resetForm() }]
      );

    } catch (error) {
      logger.error(`Failed to issue credential: ${error.message}`);
      Alert.alert('Error', `${error.message}`);
    } finally {
      setIsIssuing(false);
    }
  };

  const resetForm = () => {
    setCredentialType('');
    setAdditionalClaims([]);
  };

  const loadTemplate = (template) => {
    setAdditionalClaims([]);
    switch (template) {
      case 'degree':
        setCredentialType('University Degree');
        setAdditionalClaims([
          { key: 'name', value: 'John Doe' },
          { key: 'degree', value: 'Bachelor of Science' },
          { key: 'university', value: 'MIT' },
          { key: 'year', value: '2024' },
        ]);
        break;
      case 'id':
        setCredentialType('Government ID');
        setAdditionalClaims([
          { key: 'name', value: 'John Doe' },
          { key: 'idNumber', value: 'ID123456789' },
          { key: 'country', value: 'USA' },
          { key: 'expiryDate', value: '2030-12-31' },
        ]);
        break;
      case 'license':
        setCredentialType('Driver License');
        setAdditionalClaims([
          { key: 'name', value: 'John Doe' },
          { key: 'licenseNumber', value: 'DL987654321' },
          { key: 'class', value: 'Class B' },
          { key: 'issuedDate', value: '2024-01-01' },
        ]);
        break;
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Issue Credential</Text>
          <Text style={styles.headerSubtitle}>Create a test credential for your wallet</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Templates</Text>
          <View style={styles.templatesGrid}>
            <TouchableOpacity
              style={styles.templateCard}
              onPress={() => loadTemplate('degree')}
            >
              <Text style={styles.templateIcon}>🎓</Text>
              <Text style={styles.templateText}>Degree</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.templateCard}
              onPress={() => loadTemplate('id')}
            >
              <Text style={styles.templateIcon}>🪪</Text>
              <Text style={styles.templateText}>ID Card</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.templateCard}
              onPress={() => loadTemplate('license')}
            >
              <Text style={styles.templateIcon}>🚗</Text>
              <Text style={styles.templateText}>License</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Credential Type (Optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., University Degree"
            placeholderTextColor="#666"
            value={credentialType}
            onChangeText={setCredentialType}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Claims</Text>
          <View style={styles.addClaimRow}>
            <TextInput
              style={[styles.input, styles.claimKeyInput]}
              placeholder="Key (e.g., name)"
              placeholderTextColor="#666"
              value={claimKey}
              onChangeText={setClaimKey}
            />
            <TextInput
              style={[styles.input, styles.claimValueInput]}
              placeholder="Value"
              placeholderTextColor="#666"
              value={claimValue}
              onChangeText={setClaimValue}
            />
          </View>
          <TouchableOpacity style={styles.addButton} onPress={addClaim}>
            <Text style={styles.addButtonText}>+ Add Claim</Text>
          </TouchableOpacity>
        </View>

        {additionalClaims.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Current Claims</Text>
            {additionalClaims.map((claim, index) => (
              <View key={index} style={styles.claimItem}>
                <View style={styles.claimContent}>
                  <Text style={styles.claimItemKey}>{claim.key}</Text>
                  <Text style={styles.claimItemValue}>{claim.value}</Text>
                </View>
                <TouchableOpacity onPress={() => removeClaim(index)}>
                  <Text style={styles.removeButton}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={[styles.issueButton, { opacity: isIssuing ? 0.5 : 1 }]}
          onPress={issueCredential}
          disabled={isIssuing}
        >
          <LinearGradient
            colors={['#667eea', '#764ba2']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.issueButtonGradient}
          >
            <Text style={styles.issueButtonText}>
              {isIssuing ? 'Issuing...' : '📜 Issue Credential'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#888',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  templatesGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  templateCard: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  templateIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  templateText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
  },
  label: {
    fontSize: 14,
    color: '#aaa',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#2a2a3e',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
  },
  addClaimRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  claimKeyInput: {
    flex: 1,
  },
  claimValueInput: {
    flex: 2,
  },
  addButton: {
    backgroundColor: '#2a2a3e',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  claimItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  claimContent: {
    flex: 1,
  },
  claimItemKey: {
    fontSize: 13,
    color: '#888',
    marginBottom: 4,
  },
  claimItemValue: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '500',
  },
  removeButton: {
    fontSize: 20,
    color: '#ef4444',
    paddingHorizontal: 8,
  },
  issueButton: {
    marginHorizontal: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  issueButtonGradient: {
    padding: 18,
    alignItems: 'center',
  },
  issueButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
});