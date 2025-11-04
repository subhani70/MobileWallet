// app/tabs/credentials.js
// Credentials Screen - Matching Mock Design

import { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import {
  FolderOpen,
  Plus,
  CheckCircle2,
  ChevronRight,
  FileText,
  Download,
  RefreshCw,
  Share2,
} from 'lucide-react-native';
import * as secureStorage from '../../services/secureStorage';
import logger from '../../utils/logger';
import * as didManager from '../../services/didManager';

export default function CredentialsScreen() {
  const router = useRouter();
  const [credentials, setCredentials] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [walletInfo, setWalletInfo] = useState(null);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Reload data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      logger.info('Credentials screen focused - loading data...');
      loadData();
      animateIn();
      
      return () => {
        fadeAnim.setValue(0);
        slideAnim.setValue(30);
      };
    }, [])
  );

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

  const loadData = async () => {
    try {
      await Promise.all([loadWallet(), loadCredentials()]);
    } catch (error) {
      logger.error('Error loading data:', error);
    }
  };

  const loadWallet = async () => {
    try {
      const hasWallet = await didManager.hasWallet();
      if (hasWallet) {
        const info = await didManager.getWalletInfo();
        setWalletInfo(info);
        logger.info('Wallet loaded:', info?.did?.slice(0, 20) + '...');
      } else {
        setWalletInfo(null);
        logger.info('No wallet found');
      }
    } catch (error) {
      logger.error('Failed to load wallet info:', error);
      setWalletInfo(null);
    }
  };

  const loadCredentials = async () => {
    try {
      setIsLoading(true);
      
      const stored = await secureStorage.getCredentials();
      
      if (stored && Array.isArray(stored)) {
        const formatted = formatCredentials(stored);
        setCredentials(formatted);
        logger.info(`Loaded ${stored.length} credential(s)`);
      } else {
        setCredentials([]);
        logger.info('No credentials found in storage');
      }
    } catch (error) {
      logger.error('Failed to load credentials:', error);
      setCredentials([]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCredentials = (creds) => {
    if (!creds || !Array.isArray(creds)) return [];
    
    const colors = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EC4899', '#06B6D4'];
    const logos = ['🎓', '📜', '🪪', '💼', '🏆', '📄'];
    
    return creds.map((cred, index) => {
      const data = cred.data || {};
      const dataKeys = Object.keys(data);
      const firstKey = dataKeys[0];
      
      // Extract title and subtitle from credential data
      let title = 'Verifiable Credential';
      let subtitle = 'Credential';
      let institution = cred.issuer ? `${cred.issuer.slice(0, 20)}...` : 'Unknown Issuer';
      
      // Try to extract meaningful data
      if (firstKey) {
        const keyStr = firstKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        title = keyStr;
        subtitle = String(data[firstKey] || '').slice(0, 30);
      }
      
      // Try to get institution from issuer
      if (cred.issuer) {
        institution = cred.issuer.length > 20 ? `${cred.issuer.slice(0, 20)}...` : cred.issuer;
      }
      
      // Format date
      const date = cred.addedAt 
        ? new Date(cred.addedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        : 'Unknown';
      
      return {
        id: cred.id || `cred-${index}`,
        title,
        subtitle,
        institution,
        date,
        verified: true,
        color: colors[index % colors.length],
        logo: logos[index % logos.length],
        rawCredential: cred, // Keep reference for navigation
      };
    });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    logger.info('Manual refresh triggered');
    await loadData();
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleImport = () => {
    if (!walletInfo?.did) {
      router.push('/');
      return;
    }
    router.push('/tabs/scan');
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <Animated.View 
        style={[
          styles.headerContent,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        <View>
          <Text style={styles.headerTitle}>My Credentials</Text>
          <Text style={styles.headerSubtitle}>
            {credentials.length} {credentials.length === 1 ? 'credential' : 'credentials'} stored
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.headerButton} 
            onPress={onRefresh}
          >
            <RefreshCw color="#94A3B8" size={20} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.headerButton} 
            onPress={handleImport}
          >
            <Plus color="#FFFFFF" size={24} />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );

  const renderEmptyState = () => (
    <Animated.View 
      style={[
        styles.emptyContainer,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }
      ]}
    >
      <View style={styles.emptyIconContainer}>
        <FolderOpen color="#64748B" size={100} strokeWidth={1.5} />
      </View>
      <Text style={styles.emptyTitle}>No Credentials Yet</Text>
      <Text style={styles.emptySubtitle}>
        {walletInfo?.did 
          ? "Your verified credentials will appear here when you receive them"
          : "Create your identity first to start receiving credentials"
        }
      </Text>
      
      <TouchableOpacity 
        style={styles.primaryButton}
        onPress={() => walletInfo?.did ? handleImport() : router.push('/')}
      >
        <Text style={styles.primaryButtonText}>
          {walletInfo?.did ? 'Import Credential' : 'Create Identity'}
        </Text>
      </TouchableOpacity>
      
      {walletInfo?.did && (
        <TouchableOpacity 
          style={styles.secondaryButton}
          onPress={() => router.push('/tabs/scan')}
        >
          <Download color="#06B6D4" size={20} />
          <Text style={styles.secondaryButtonText}>Scan QR Code</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {renderHeader()}
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#06B6D4"
          />
        }
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <RefreshCw color="#06B6D4" size={32} />
            <Text style={styles.loadingText}>Loading credentials...</Text>
          </View>
        ) : credentials.length === 0 ? (
          renderEmptyState()
        ) : (
          <View style={styles.credentialsList}>
            {credentials.map((credential) => (
              <CredentialCard 
                key={credential.id} 
                credential={credential} 
                router={router}
                fadeAnim={fadeAnim}
              />
            ))}
          </View>
        )}
        
        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

function CredentialCard({ credential, router, fadeAnim }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={{ opacity: fadeAnim }}>
      <TouchableOpacity
        style={styles.credentialCard}
        activeOpacity={0.9}
        onPress={() => router.push({
          pathname: '/credential-detail',
          params: { id: credential.rawCredential?.id || credential.id }
        })}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <Animated.View
          style={[
            styles.credentialCardContent,
            { borderTopColor: credential.color, transform: [{ scale: scaleAnim }] },
          ]}
        >
          <View style={styles.institutionLogo}>
            <Text style={styles.logoEmoji}>{credential.logo}</Text>
          </View>
          <View style={styles.credentialInfo}>
            <Text style={styles.credentialTitle}>{credential.title}</Text>
            <Text style={styles.credentialSubtitle}>{credential.subtitle}</Text>
            <Text style={styles.credentialInstitution}>{credential.institution}</Text>
            <Text style={styles.credentialDate}>{credential.date}</Text>
          </View>
          <View style={styles.credentialRight}>
            {credential.verified && (
              <View style={styles.verifiedBadge}>
                <CheckCircle2 color="#10B981" size={12} />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.shareButton}
              onPress={(e) => {
                e.stopPropagation();
                router.push({
                  pathname: '/share-credential',
                  params: { credentialId: credential.rawCredential?.id || credential.id }
                });
              }}
            >
              <Share2 color="#06B6D4" size={18} />
            </TouchableOpacity>
            <ChevronRight color="#9CA3AF" size={20} />
          </View>
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#F1F5F9',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  credentialsList: {
    gap: 12,
    paddingTop: 8,
  },
  credentialCard: {
    borderRadius: 16,
  },
  credentialCardContent: {
    flexDirection: 'row',
    borderRadius: 16,
    borderTopWidth: 4,
    backgroundColor: '#1E293B',
    padding: 16,
    shadowColor: '#06B6D4',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 2,
    gap: 12,
  },
  institutionLogo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoEmoji: {
    fontSize: 28,
  },
  credentialInfo: {
    flex: 1,
    gap: 4,
  },
  credentialTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F1F5F9',
  },
  credentialSubtitle: {
    fontSize: 14,
    color: '#64748B',
  },
  credentialInstitution: {
    fontSize: 12,
    color: '#64748B',
  },
  credentialDate: {
    fontSize: 12,
    color: '#64748B',
  },
  credentialRight: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
  },
  shareButton: {
    padding: 4,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 8,
  },
  verifiedText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#10B981',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#64748B',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyIconContainer: {
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F1F5F9',
    marginBottom: 12,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  primaryButton: {
    backgroundColor: '#06B6D4',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 14,
    marginBottom: 16,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#06B6D4',
    backgroundColor: 'transparent',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#06B6D4',
  },
  bottomPadding: {
    height: 100,
  },
});
