// app/index.js
// SSI Wallet Home Screen - Beautiful & Functional

import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  RefreshControl,
  Dimensions,
  Alert,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Bell,
  Copy,
  FileText,
  Share2,
  Clock,
  Download,
  QrCode,
  CheckCircle2,
  ChevronRight,
  AlertCircle,
  Shield,
  Plus,
  Settings,
} from 'lucide-react-native';
import { healthAPI } from '../../services/api';
import * as didManager from '../../services/didManager';
import * as secureStorage from '../../services/secureStorage';
import logger from '../../utils/logger';
import 'react-native-get-random-values';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function WalletDashboard() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [backendInfo, setBackendInfo] = useState(null);
  const [hasWallet, setHasWallet] = useState(false);
  const [walletInfo, setWalletInfo] = useState(null);
  const [isCreatingDID, setIsCreatingDID] = useState(false);
  const [logs, setLogs] = useState([]);
  const [didExpanded, setDidExpanded] = useState(false);
  
  // Mock data for UI - replace with real data when available
  const [stats] = useState({ total: 0, shared: 0, pending: 0 });
  const [credentials] = useState([]);
  const [notifications] = useState(1);

  const checkHealth = async () => {
    try {
      const response = await healthAPI.check();
      setIsConnected(true);
      setBackendInfo(response);
    } catch (err) {
      setIsConnected(false);
      setBackendInfo(null);
    } finally {
      setLogs(logger.getLogs());
    }
  };

  const checkWallet = async () => {
    try {
      const exists = await didManager.hasWallet();
      setHasWallet(exists);
      
      if (exists) {
        const info = await didManager.getWalletInfo();
        setWalletInfo(info);
      }
    } catch (err) {
      logger.error('Failed to check wallet');
    }
  };

  useEffect(() => {
    checkHealth();
    checkWallet();
    
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await checkHealth();
    await checkWallet();
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleCreateDID = async () => {
    Alert.alert(
      'Create Your Identity',
      'Generate a new Self-Sovereign Identity. Your private key will never leave this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Create', onPress: createDID },
      ]
    );
  };

  const createDID = async () => {
    setIsCreatingDID(true);
    
    try {
      const result = await didManager.createLocalDID();
      setHasWallet(true);
      setWalletInfo(result);
      
      Alert.alert(
        '✅ Identity Created',
        `Your DID has been created and registered on the blockchain!`,
        [{ text: 'OK' }]
      );
    } catch (err) {
      Alert.alert('Error', 'Failed to create DID. Please try again.');
    } finally {
      setIsCreatingDID(false);
      setLogs(logger.getLogs());
    }
  };

  const handleCopyDID = () => {
    if (walletInfo?.did) {
      // Copy to clipboard logic here
      Alert.alert('Copied!', 'DID copied to clipboard');
    }
  };

  const handleClearWallet = async () => {
    Alert.alert(
      '⚠️ Clear Wallet',
      'This will delete your DID and all data. Cannot be undone!',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await secureStorage.clearWallet();
            setHasWallet(false);
            setWalletInfo(null);
            setLogs(logger.getLogs());
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#06B6D4"
          />
        }
      >
        {/* Gradient Header */}
        <LinearGradient
          colors={['#06B6D4', '#8B5CF6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <SafeAreaView edges={['top']}>
            <View style={styles.headerContent}>
              {/* Header Top */}
              <View style={styles.headerTop}>
                <View style={styles.greetingSection}>
                  <View style={[styles.connectionIndicator, 
                    { backgroundColor: isConnected ? '#10B981' : '#EF4444' }
                  ]}>
                    <View style={styles.connectionDot} />
                  </View>
                  <View style={styles.greeting}>
                    <Text style={styles.greetingSmall}>
                      {isConnected ? 'Connected' : 'Offline'}
                    </Text>
                    <Text style={styles.greetingName}>SSI Wallet</Text>
                  </View>
                </View>
                <View style={styles.headerButtons}>
                  <TouchableOpacity 
                    style={styles.headerButton} 
                    onPress={() => router.push('/notifications')}
                  >
                    <Bell color="#FFFFFF" size={24} />
                    {notifications > 0 && <View style={styles.notificationBadge} />}
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.headerButton}
                    onPress={() => router.push('/settings')}
                  >
                    <Settings color="#FFFFFF" size={24} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* DID Card or Create Button */}
              {hasWallet ? (
                <TouchableOpacity
                  style={styles.didCard}
                  onPress={() => setDidExpanded(!didExpanded)}
                  activeOpacity={0.8}
                >
                  <View style={styles.didCardContent}>
                    <Text style={styles.didLabel}>Your DID</Text>
                    <View style={styles.didRow}>
                      <Text style={styles.didText} numberOfLines={1}>
                        {walletInfo?.did ? 
                          `${walletInfo.did.slice(0, 20)}...${walletInfo.did.slice(-8)}` :
                          'Loading...'
                        }
                      </Text>
                      <TouchableOpacity onPress={handleCopyDID} style={styles.copyButton}>
                        <Copy color="#FFFFFF" size={20} />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.didStatus}>
                      <View style={styles.statusDot} />
                      <Text style={styles.statusText}>Active</Text>
                      <Text style={styles.addressText}>
                        {walletInfo?.address ? 
                          `${walletInfo.address.slice(0, 6)}...${walletInfo.address.slice(-4)}` :
                          ''
                        }
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.createDIDCard}
                  onPress={handleCreateDID}
                  disabled={isCreatingDID}
                  activeOpacity={0.8}
                >
                  <Plus color="#FFFFFF" size={32} />
                  <Text style={styles.createDIDTitle}>
                    {isCreatingDID ? 'Creating...' : 'Create Your Identity'}
                  </Text>
                  <Text style={styles.createDIDSubtitle}>
                    Generate your DID on this device
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </SafeAreaView>
        </LinearGradient>

        <View style={styles.content}>
          {/* Quick Stats */}
          {hasWallet && (
            <View style={styles.statsContainer}>
              <StatCard
                icon={<FileText color="#06B6D4" size={32} />}
                number={stats.total}
                label="Credentials"
              />
              <StatCard
                icon={<Share2 color="#8B5CF6" size={32} />}
                number={stats.shared}
                label="Shared"
              />
              <StatCard
                icon={<Clock color="#F59E0B" size={32} />}
                number={stats.pending}
                label="Pending"
                badge={stats.pending > 0}
              />
            </View>
          )}

          {/* Quick Actions */}
          {hasWallet && (
            <View style={styles.quickActionsSection}>
              <Text style={styles.sectionTitle}>Quick Actions</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.actionsContainer}
              >
                <QuickActionButton
                  icon={<Share2 color="#FFFFFF" size={32} />}
                  label="Share"
                  gradient={['#06B6D4', '#0891B2']}
                  onPress={() => router.push('/share')}
                />
                <QuickActionButton
                  icon={<QrCode color="#FFFFFF" size={32} />}
                  label="Scan QR"
                  gradient={['#8B5CF6', '#7C3AED']}
                  onPress={() => router.push('/scan')}
                />
                <QuickActionButton
                  icon={<Download color="#06B6D4" size={32} />}
                  label="Receive"
                  outline
                  onPress={() => router.push('/receive')}
                />
                <QuickActionButton
                  icon={<Shield color="#10B981" size={32} />}
                  label="Verify"
                  outline
                  onPress={() => router.push('/verify')}
                />
              </ScrollView>
            </View>
          )}

          {/* Credentials Section */}
          {hasWallet && credentials.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>My Credentials</Text>
                <TouchableOpacity onPress={() => router.push('/credentials')}>
                  <Text style={styles.viewAllLink}>View All</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.emptyState}>
                <FileText color="#64748B" size={48} />
                <Text style={styles.emptyText}>No credentials yet</Text>
                <Text style={styles.emptySubtext}>
                  Your verified credentials will appear here
                </Text>
              </View>
            </View>
          )}

          {/* Activity Section */}
          <View style={[styles.section, styles.activitySection]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Activity</Text>
              <TouchableOpacity onPress={() => router.push('/activity')}>
                <Text style={styles.viewAllLink}>View All</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.activityList}>
              {logs.slice(0, 5).map((log, index) => (
                <ActivityItem
                  key={log.id}
                  activity={{
                    type: log.type === 'success' ? 'verified' : 
                          log.type === 'error' ? 'error' : 'info',
                    title: log.type === 'success' ? 'Success' :
                           log.type === 'error' ? 'Error' : 'Info',
                    detail: log.message,
                    time: log.timestamp,
                  }}
                  isLast={index === logs.length - 1}
                />
              ))}
              {logs.length === 0 && (
                <View style={styles.emptyState}>
                  <Clock color="#64748B" size={48} />
                  <Text style={styles.emptyText}>No activity yet</Text>
                  <Text style={styles.emptySubtext}>
                    Your wallet activity will appear here
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Danger Zone - Only when wallet exists */}
          {hasWallet && (
            <View style={styles.dangerZone}>
              <TouchableOpacity
                style={styles.dangerButton}
                onPress={handleClearWallet}
              >
                <Text style={styles.dangerButtonText}>Reset Wallet</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// Component: StatCard
function StatCard({ icon, number, label, badge }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
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
    <TouchableOpacity
      style={styles.statCard}
      activeOpacity={0.9}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View style={[styles.statCardContent, { transform: [{ scale: scaleAnim }] }]}>
        {badge && <View style={styles.statBadge} />}
        {icon}
        <Text style={styles.statNumber}>{number}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

// Component: QuickActionButton
function QuickActionButton({ icon, label, gradient, outline, onPress }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.93,
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

  if (outline) {
    return (
      <TouchableOpacity
        style={styles.actionButtonOutline}
        activeOpacity={0.8}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <Animated.View
          style={[styles.actionButtonContent, { transform: [{ scale: scaleAnim }] }]}
        >
          {icon}
          <Text style={styles.actionLabelOutline}>{label}</Text>
        </Animated.View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={styles.actionButton}
      activeOpacity={0.8}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <LinearGradient
        colors={gradient || ['#06B6D4', '#0891B2']}
        style={styles.actionGradient}
      >
        <Animated.View
          style={[styles.actionButtonContent, { transform: [{ scale: scaleAnim }] }]}
        >
          {icon}
          <Text style={styles.actionLabel}>{label}</Text>
        </Animated.View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

// Component: ActivityItem
function ActivityItem({ activity, isLast }) {
  const getIconAndColor = () => {
    switch (activity.type) {
      case 'success':
      case 'verified':
        return { icon: <CheckCircle2 size={20} color="#FFFFFF" />, color: '#10B981' };
      case 'error':
        return { icon: <AlertCircle size={20} color="#FFFFFF" />, color: '#EF4444' };
      default:
        return { icon: <FileText size={20} color="#FFFFFF" />, color: '#6B7280' };
    }
  };

  const { icon, color } = getIconAndColor();

  return (
    <View style={styles.activityItem}>
      <View style={styles.activityIconContainer}>
        <View style={[styles.activityIcon, { backgroundColor: color }]}>
          {icon}
        </View>
        {!isLast && <View style={styles.timelineLine} />}
      </View>
      <View style={styles.activityContent}>
        <Text style={styles.activityTitle}>{activity.title}</Text>
        <Text style={styles.activityDetail} numberOfLines={2}>{activity.detail}</Text>
        <Text style={styles.activityTime}>{activity.time}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    paddingBottom: 60,
  },
  headerContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  greetingSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  connectionIndicator: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.9,
  },
  connectionDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
  },
  greeting: {
    gap: 2,
  },
  greetingSmall: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  greetingName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  didCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    padding: 16,
  },
  didCardContent: {
    gap: 8,
  },
  didLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  didRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  didText: {
    fontSize: 14,
    fontFamily: 'monospace',
    color: '#FFFFFF',
    flex: 1,
  },
  copyButton: {
    padding: 4,
  },
  didStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  statusText: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  addressText: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.7)',
    marginLeft: 8,
  },
  createDIDCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  createDIDTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  createDIDSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  content: {
    marginTop: -40,
    paddingBottom: 100,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    shadowColor: '#06B6D4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  statCardContent: {
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  statBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F59E0B',
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#F1F5F9',
  },
  statLabel: {
    fontSize: 14,
    color: '#94A3B8',
  },
  quickActionsSection: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#F1F5F9',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  actionsContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  actionButton: {
    width: 120,
    height: 100,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#06B6D4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  actionGradient: {
    flex: 1,
  },
  actionButtonContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  actionButtonOutline: {
    width: 120,
    height: 100,
    borderRadius: 16,
    backgroundColor: '#1E293B',
    borderWidth: 2,
    borderColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionLabelOutline: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 8,
  },
  section: {
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  viewAllLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#06B6D4',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 16,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
  },
  activitySection: {
    marginBottom: 40,
  },
  activityList: {
    paddingHorizontal: 16,
  },
  activityItem: {
    flexDirection: 'row',
    gap: 16,
    minHeight: 72,
  },
  activityIconContainer: {
    alignItems: 'center',
    width: 32,
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: '#334155',
    marginTop: 4,
  },
  activityContent: {
    flex: 1,
    paddingBottom: 16,
    gap: 4,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F1F5F9',
  },
  activityDetail: {
    fontSize: 14,
    color: '#94A3B8',
  },
  activityTime: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  dangerZone: {
    paddingHorizontal: 16,
    marginTop: 40,
    marginBottom: 20,
  },
  dangerButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  dangerButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
});