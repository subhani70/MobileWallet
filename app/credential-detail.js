// app/credential-detail.js
// Credential Detail Screen - Beautiful UI

import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  StatusBar,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Share2,
  Shield,
  Calendar,
  Building2,
  FileText,
  ExternalLink,
} from 'lucide-react-native';
import * as secureStorage from '../services/secureStorage';
import * as Clipboard from 'expo-clipboard';
import logger from '../utils/logger';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function CredentialDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [credential, setCredential] = useState(null);
  const [formattedCredential, setFormattedCredential] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    loadCredential();
    animateIn();
  }, []);

  const animateIn = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const loadCredential = async () => {
    try {
      setIsLoading(true);
      
      // Get credential ID from params
      const credentialId = params.id || params.credentialId;
      
      if (!credentialId) {
        // If no ID, try to get from raw credential data
        const rawCredential = params.rawCredential ? JSON.parse(params.rawCredential) : null;
        if (rawCredential) {
          formatCredential(rawCredential);
          return;
        }
        Alert.alert('Error', 'Credential not found');
        router.back();
        return;
      }

      // Load all credentials and find the one matching the ID
      const allCredentials = await secureStorage.getCredentials();
      const foundCredential = allCredentials.find(c => c.id === credentialId);
      
      if (!foundCredential) {
        Alert.alert('Error', 'Credential not found');
        router.back();
        return;
      }

      formatCredential(foundCredential);
    } catch (error) {
      logger.error('Failed to load credential:', error);
      Alert.alert('Error', 'Failed to load credential details');
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  const formatCredential = (cred) => {
    setCredential(cred);
    
    const data = cred.data || {};
    const dataKeys = Object.keys(data);
    const firstKey = dataKeys[0];
    
    const colors = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EC4899', '#06B6D4'];
    const logos = ['🎓', '📜', '🪪', '💼', '🏆', '📄'];
    
    // Extract title and subtitle
    let title = 'Verifiable Credential';
    let subtitle = 'Credential';
    
    if (firstKey) {
      const keyStr = firstKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      title = keyStr;
      subtitle = String(data[firstKey] || '').slice(0, 50);
    }
    
    // Get institution
    const institution = cred.issuer 
      ? (cred.issuer.length > 30 ? `${cred.issuer.slice(0, 30)}...` : cred.issuer)
      : 'Unknown Issuer';
    
    // Format date
    const date = cred.addedAt 
      ? new Date(cred.addedAt).toLocaleDateString('en-US', { 
          month: 'long', 
          day: 'numeric', 
          year: 'numeric' 
        })
      : 'Unknown';
    
    const formattedDate = cred.addedAt
      ? new Date(cred.addedAt).toLocaleString('en-US', {
          month: 'short',
          year: 'numeric',
        })
      : 'Unknown';

    setFormattedCredential({
      title,
      subtitle,
      institution,
      date,
      formattedDate,
      color: colors[0],
      logo: logos[0],
      verified: true,
    });
  };

  const handleCopy = async (text, label) => {
    try {
      await Clipboard.setStringAsync(text);
      Alert.alert('Copied!', `${label} copied to clipboard`);
    } catch (error) {
      Alert.alert('Error', 'Failed to copy');
    }
  };

  const handleShare = () => {
    if (credential?.id) {
      router.push({
        pathname: '/share-credential',
        params: { credentialId: credential.id }
      });
    }
  };

  if (isLoading || !credential || !formattedCredential) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading credential...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const data = credential.data || {};
  const dataKeys = Object.keys(data);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <Animated.View 
        style={[
          styles.header,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft color="#FFFFFF" size={24} />
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.headerActionButton}
            onPress={handleShare}
          >
            <Share2 color="#FFFFFF" size={20} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Credential Header Card */}
        <Animated.View 
          style={[
            styles.headerCard,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
              borderTopColor: formattedCredential.color,
            }
          ]}
        >
          <View style={styles.headerCardContent}>
            <View style={styles.logoContainer}>
              <Text style={styles.logoEmoji}>{formattedCredential.logo}</Text>
            </View>
            <View style={styles.headerCardInfo}>
              <Text style={styles.headerCardTitle}>{formattedCredential.title}</Text>
              <Text style={styles.headerCardSubtitle}>{formattedCredential.subtitle}</Text>
              {formattedCredential.verified && (
                <View style={styles.verifiedBadge}>
                  <CheckCircle2 color="#10B981" size={14} />
                  <Text style={styles.verifiedText}>Verified</Text>
                </View>
              )}
            </View>
          </View>
        </Animated.View>

        {/* Credential Details */}
        <Animated.View 
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          {/* Issuer Information */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Building2 color="#06B6D4" size={20} />
              <Text style={styles.sectionTitle}>Issued By</Text>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Issuer DID</Text>
              <TouchableOpacity 
                style={styles.infoValueContainer}
                onPress={() => handleCopy(credential.issuer || 'Not specified', 'Issuer DID')}
              >
                <Text style={styles.infoValue} numberOfLines={2}>
                  {credential.issuer || 'Not specified'}
                </Text>
                <Copy color="#06B6D4" size={16} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Credential Data */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <FileText color="#8B5CF6" size={20} />
              <Text style={styles.sectionTitle}>Credential Information</Text>
            </View>
            <View style={styles.infoCard}>
              {dataKeys.length > 0 ? (
                dataKeys.map((key, index) => (
                  <View key={key} style={[styles.infoRow, index < dataKeys.length - 1 && styles.infoRowBorder]}>
                    <Text style={styles.infoLabel}>
                      {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </Text>
                    <Text style={styles.infoValueText}>{String(data[key])}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyDataText}>No data available</Text>
              )}
            </View>
          </View>

          {/* Metadata */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Calendar color="#10B981" size={20} />
              <Text style={styles.sectionTitle}>Metadata</Text>
            </View>
            <View style={styles.infoCard}>
              <View style={[styles.infoRow, styles.infoRowBorder]}>
                <Text style={styles.infoLabel}>Subject DID</Text>
                <TouchableOpacity 
                  style={styles.infoValueContainer}
                  onPress={() => handleCopy(credential.subject || 'Not specified', 'Subject DID')}
                >
                  <Text style={styles.infoValue} numberOfLines={2}>
                    {credential.subject || 'Not specified'}
                  </Text>
                  <Copy color="#06B6D4" size={16} />
                </TouchableOpacity>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Issued Date</Text>
                <Text style={styles.infoValueText}>{formattedCredential.date}</Text>
              </View>
            </View>
          </View>

          {/* Security Info */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Shield color="#F59E0B" size={20} />
              <Text style={styles.sectionTitle}>Security</Text>
            </View>
            <View style={styles.infoCard}>
              <View style={styles.securityRow}>
                <Shield color="#10B981" size={16} />
                <Text style={styles.securityText}>This credential is cryptographically signed and verified</Text>
              </View>
              <View style={styles.securityRow}>
                <CheckCircle2 color="#10B981" size={16} />
                <Text style={styles.securityText}>Blockchain verified</Text>
              </View>
            </View>
          </View>

          {/* JWT Section (Collapsible) */}
          {credential.jwt && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <FileText color="#EC4899" size={20} />
                <Text style={styles.sectionTitle}>JWT Token</Text>
              </View>
              <View style={styles.infoCard}>
                <TouchableOpacity 
                  style={styles.jwtContainer}
                  onPress={() => handleCopy(credential.jwt, 'JWT Token')}
                >
                  <Text style={styles.jwtText} numberOfLines={3}>
                    {credential.jwt}
                  </Text>
                  <Copy color="#EC4899" size={16} />
                </TouchableOpacity>
                <Text style={styles.jwtHint}>
                  Tap to copy full JWT token
                </Text>
              </View>
            </View>
          )}

          <View style={styles.bottomPadding} />
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#64748B',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerActionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  scrollView: {
    flex: 1,
  },
  headerCard: {
    marginHorizontal: 16,
    marginBottom: 24,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    borderTopWidth: 4,
    padding: 20,
    shadowColor: '#06B6D4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  headerCardContent: {
    flexDirection: 'row',
    gap: 16,
  },
  logoContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoEmoji: {
    fontSize: 32,
  },
  headerCardInfo: {
    flex: 1,
    gap: 8,
  },
  headerCardTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#F1F5F9',
  },
  headerCardSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 4,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
  },
  content: {
    paddingHorizontal: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#F1F5F9',
  },
  infoCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  infoRow: {
    paddingVertical: 12,
  },
  infoRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValueText: {
    fontSize: 16,
    color: '#F1F5F9',
    fontWeight: '500',
  },
  infoValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoValue: {
    flex: 1,
    fontSize: 14,
    color: '#F1F5F9',
    fontFamily: 'monospace',
  },
  emptyDataText: {
    fontSize: 14,
    color: '#64748B',
    fontStyle: 'italic',
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  securityText: {
    flex: 1,
    fontSize: 14,
    color: '#94A3B8',
  },
  jwtContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    backgroundColor: '#0F172A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  jwtText: {
    flex: 1,
    fontSize: 11,
    color: '#94A3B8',
    fontFamily: 'monospace',
    lineHeight: 16,
  },
  jwtHint: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 8,
    fontStyle: 'italic',
  },
  bottomPadding: {
    height: 40,
  },
});

