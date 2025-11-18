// app/tabs/index.js
// SSI Wallet Dashboard - Matching Mock Design

import { useState, useEffect, useRef, useMemo } from 'react';
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
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
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
} from 'lucide-react-native';
import * as secureStorage from '../../services/secureStorage';
import * as didManager from '../../services/didManager';
import logger from '../../utils/logger';
import 'react-native-get-random-values';
import { useTheme } from '../../contexts/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function WalletDashboard() {
  const router = useRouter();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [refreshing, setRefreshing] = useState(false);
  const [didExpanded, setDidExpanded] = useState(false);
  const [hasWallet, setHasWallet] = useState(false);
  const [walletInfo, setWalletInfo] = useState(null);
  const [stats, setStats] = useState({ total: 0, shared: 0, pending: 0 });
  const [credentials, setCredentials] = useState([]);
  const [activity, setActivity] = useState([]);

  const loadData = async () => {
    try {
      // Check wallet
      const exists = await didManager.hasWallet();
      setHasWallet(exists);
      
      if (exists) {
        const info = await didManager.getWalletInfo();
        setWalletInfo(info);
        
        // Load credentials
        const stored = await secureStorage.getCredentials();
        const formattedCredentials = formatCredentials(stored);
        setCredentials(formattedCredentials);
        
        // Calculate stats
        const total = stored.length;
        const shared = 0; // TODO: Track shared count in storage
        const pending = 0; // TODO: Track pending offers
        setStats({ total, shared, pending });
        
        // Format activity from logger
        const logs = logger.getLogs();
        const formattedActivity = formatActivity(logs);
        setActivity(formattedActivity);
      } else {
        setCredentials([]);
        setStats({ total: 0, shared: 0, pending: 0 });
        setActivity([]);
      }
    } catch (err) {
      logger.error('Failed to load dashboard data');
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

  const formatActivity = (logs) => {
    if (!logs || !Array.isArray(logs)) return [];
    
    const activityMap = [];
    const now = Date.now();
    
    logs.slice(0, 10).forEach((log) => {
      let type = 'info';
      let title = 'Activity';
      let detail = log.message || '';
      
      // Map log types to activity types
      if (log.type === 'success') {
        if (detail.toLowerCase().includes('credential') && detail.toLowerCase().includes('received')) {
          type = 'received';
          title = 'Credential Received';
        } else if (detail.toLowerCase().includes('shared') || detail.toLowerCase().includes('presentation')) {
          type = 'shared';
          title = 'Credential Shared';
        } else if (detail.toLowerCase().includes('verified')) {
          type = 'verified';
          title = 'Credential Verified';
        } else {
          type = 'verified';
          title = 'Success';
        }
      } else if (log.type === 'error') {
        type = 'error';
        title = 'Error';
      } else {
        if (detail.toLowerCase().includes('credential')) {
          type = 'received';
          title = 'Credential Received';
        }
      }
      
      // Format time
      const logTime = log.timestamp || new Date().toLocaleTimeString();
      const timeAgo = formatTimeAgo(logTime);
      
      activityMap.push({
        id: log.id || `activity-${Date.now()}-${Math.random()}`,
        type,
        title,
        detail,
        time: timeAgo,
      });
    });
    
    return activityMap;
  };

  const formatTimeAgo = (timestamp) => {
    try {
      // If timestamp is already a string like "2 hours ago", return it
      if (typeof timestamp === 'string' && timestamp.includes('ago')) {
        return timestamp;
      }
      
      // Try to parse timestamp
      const time = new Date(timestamp);
      if (isNaN(time.getTime())) {
        return 'Recently';
      }
      
      const now = new Date();
      const diff = now - time;
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);
      const weeks = Math.floor(days / 7);
      
      if (minutes < 1) return 'Just now';
      if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
      if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
      if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
      if (weeks < 4) return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
      return time.toLocaleDateString();
    } catch {
      return 'Recently';
    }
  };

  useEffect(() => {
    loadData();
    
    // Refresh data every 30 seconds
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setTimeout(() => setRefreshing(false), 1500);
  };

  const handleCopyDID = async () => {
    if (walletInfo?.did) {
      try {
        await Clipboard.setStringAsync(walletInfo.did);
        Alert.alert('Copied!', 'DID copied to clipboard');
      } catch (err) {
        Alert.alert('Error', 'Failed to copy DID');
      }
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
      >
        <GradientHeader
          styles={styles}
          didExpanded={didExpanded}
          onToggleDID={() => setDidExpanded(!didExpanded)}
          onCopyDID={handleCopyDID}
          onNotificationPress={() => router.push('/notifications')}
          walletInfo={walletInfo}
        />

        <View style={styles.content}>
          {hasWallet && (
            <>
              <QuickStats stats={stats} styles={styles} />
              <QuickActions router={router} styles={styles} />
              {stats.pending > 0 && (
                <PendingAlert 
                  styles={styles}
                  count={stats.pending} 
                  onPress={() => router.push('/credential-offer')} 
                />
              )}
              <CredentialsSection
                styles={styles}
                credentials={credentials}
                onViewAll={() => router.push('/tabs/credentials')}
                router={router}
              />
              <ActivitySection
                styles={styles}
                activity={activity}
                onViewAll={() => router.push('/activity')}
              />
            </>
          )}
          {!hasWallet && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Create your identity to get started</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function GradientHeader({
  didExpanded,
  onToggleDID,
  onCopyDID,
  onNotificationPress,
  walletInfo,
  styles,
}) {
  return (
    <LinearGradient
      colors={['#06B6D4', '#8B5CF6']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.header}
    >
      <SafeAreaView edges={['top']}>
        <View style={styles.headerContent}>
          <View style={styles.headerTop}>
            <View style={styles.greetingSection}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>M</Text>
              </View>
              <View style={styles.greeting}>
                <Text style={styles.greetingSmall}>Welcome back,</Text>
                <Text style={styles.greetingName}>Maya</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.notificationButton} onPress={onNotificationPress}>
              <Bell color="#FFFFFF" size={24} />
              <View style={styles.notificationBadge} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.didCard}
            onPress={onToggleDID}
            activeOpacity={0.8}
          >
            <View style={styles.didCardContent}>
              <Text style={styles.didLabel}>Your DID</Text>
              <View style={styles.didRow}>
                <Text style={styles.didText} numberOfLines={1}>
                  {walletInfo?.did ? 
                    `${walletInfo.did.slice(0, 15)}...${walletInfo.did.slice(-6)}` :
                    'did:ethr:0xf3a8...c9d2'
                  }
                </Text>
                <TouchableOpacity onPress={onCopyDID} style={styles.copyButton}>
                  <Copy color="#FFFFFF" size={20} />
                </TouchableOpacity>
              </View>
              <View style={styles.didStatus}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>Active</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

function QuickStats({ stats, styles }) {
  return (
    <View style={styles.statsContainer}>
      <StatCard
        styles={styles}
        icon={<FileText color="#06B6D4" size={32} />}
        number={stats.total}
        label="Credentials"
      />
      <StatCard
        styles={styles}
        icon={<Share2 color="#8B5CF6" size={32} />}
        number={stats.shared}
        label="Times Shared"
      />
      <StatCard
        styles={styles}
        icon={<Clock color="#F59E0B" size={32} />}
        number={stats.pending}
        label="Pending"
        badge={stats.pending > 0}
      />
    </View>
  );
}

function StatCard({ icon, number, label, badge, styles }) {
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

function QuickActions({ router, styles }) {
  return (
    <View style={styles.quickActionsSection}>
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.actionsContainer}
      >
        <QuickActionButton
          styles={styles}
          icon={<Share2 color="#FFFFFF" size={32} />}
          label="Share Credential"
          gradient={['#06B6D4', '#0891B2']}
          onPress={() => router.push('/share')}
        />
        <QuickActionButton
          styles={styles}
          icon={<QrCode color="#FFFFFF" size={32} />}
          label="Scan QR"
          gradient={['#8B5CF6', '#7C3AED']}
          onPress={() => router.push('/tabs/scan')}
        />
        <QuickActionButton
          styles={styles}
          icon={<Download color="#06B6D4" size={32} />}
          label="Receive"
          outline
          onPress={() => router.push('/tabs/scan')}
        />
      </ScrollView>
    </View>
  );
}

function QuickActionButton({
  icon,
  label,
  gradient,
  outline,
  onPress,
  styles,
}) {
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

function PendingAlert({ count, onPress, styles }) {
  return (
    <TouchableOpacity style={styles.pendingAlert} onPress={onPress}>
      <AlertCircle color="#F59E0B" size={24} />
      <Text style={styles.pendingText}>
        You have {count} new credential{count > 1 ? 's' : ''} waiting
      </Text>
      <Text style={styles.pendingButton}>View</Text>
    </TouchableOpacity>
  );
}

function CredentialsSection({
  credentials,
  onViewAll,
  router,
  styles,
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>My Credentials</Text>
        <TouchableOpacity onPress={onViewAll}>
          <Text style={styles.viewAllLink}>View All</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.credentialsList}>
        {credentials.slice(0, 3).map((credential) => (
          <CredentialCard key={credential.id} credential={credential} router={router} styles={styles} />
        ))}
        {credentials.length === 0 && (
          <View style={styles.emptyState}>
            <FileText color="#64748B" size={48} />
            <Text style={styles.emptyText}>No credentials yet</Text>
            <Text style={styles.emptySubtext}>
              Your verified credentials will appear here
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

function CredentialCard({ credential, router, styles }) {
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
          <ChevronRight color="#9CA3AF" size={20} />
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

function ActivitySection({
  activity,
  onViewAll,
  styles,
}) {
  return (
    <View style={[styles.section, styles.activitySection]}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        <TouchableOpacity onPress={onViewAll}>
          <Text style={styles.viewAllLink}>View All</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.activityList}>
        {activity.slice(0, 5).map((item, index) => (
          <ActivityItem
            key={item.id}
            activity={item}
            isLast={index === activity.length - 1}
            styles={styles}
          />
        ))}
        {activity.length === 0 && (
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
  );
}

function ActivityItem({ activity, isLast, styles }) {
  const getIconAndColor = () => {
    switch (activity.type) {
      case 'received':
        return { icon: <Download size={20} color="#FFFFFF" />, color: '#10B981' };
      case 'shared':
        return { icon: <Share2 size={20} color="#FFFFFF" />, color: '#3B82F6' };
      case 'verified':
        return { icon: <CheckCircle2 size={20} color="#FFFFFF" />, color: '#8B5CF6' };
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

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
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
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
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
  notificationButton: {
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
    backgroundColor: theme.card,
    borderRadius: 16,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
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
    color: theme.text,
  },
  statLabel: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  quickActionsSection: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  actionsContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  actionButton: {
    width: 160,
    height: 88,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#06B6D4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
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
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  actionButtonOutline: {
    width: 160,
    height: 88,
    borderRadius: 16,
    backgroundColor: theme.card,
    borderWidth: 2,
    borderColor: theme.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionLabelOutline: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.primary,
    marginTop: 8,
  },
  pendingAlert: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: 'rgba(251, 146, 60, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(251, 146, 60, 0.5)',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pendingText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: theme.text,
  },
  pendingButton: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.primary,
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
    color: theme.primary,
  },
  credentialsList: {
    paddingHorizontal: 16,
    gap: 12,
  },
  credentialCard: {
    borderRadius: 16,
  },
  credentialCardContent: {
    flexDirection: 'row',
    borderRadius: 16,
    borderTopWidth: 4,
    backgroundColor: theme.surface,
    padding: 16,
    shadowColor: theme.shadow,
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
    backgroundColor: theme.surfaceSecondary,
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
    color: theme.text,
  },
  credentialSubtitle: {
    fontSize: 14,
    color: theme.textTertiary,
  },
  credentialInstitution: {
    fontSize: 12,
    color: theme.textTertiary,
  },
  credentialDate: {
    fontSize: 12,
    color: theme.textTertiary,
  },
  credentialRight: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
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
    color: theme.success,
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
    backgroundColor: theme.border,
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
    color: theme.text,
  },
  activityDetail: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  activityTime: {
    fontSize: 12,
    color: theme.textTertiary,
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 16,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textSecondary,
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.textTertiary,
    marginTop: 4,
    textAlign: 'center',
  },
});
