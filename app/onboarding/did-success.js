// app/onboarding/did-success.js
import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { CheckCircle2, Copy } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import * as secureStorage from '../../services/secureStorage';

export default function DIDSuccessScreen() {
  const router = useRouter();
  const [didInfo, setDidInfo] = useState({ did: '', address: '' });
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const confettiAnims = useRef(
    Array.from({ length: 20 }, () => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      rotate: new Animated.Value(0),
      opacity: new Animated.Value(1),
    }))
  ).current;

  useEffect(() => {
    loadDIDInfo();
    startAnimations();
  }, []);

  const loadDIDInfo = async () => {
    try {
      const did = await secureStorage.getDID();
      const address = await secureStorage.getAddress();
      setDidInfo({ did, address });
    } catch (error) {
      console.error('Error loading DID info:', error);
    }
  };

  const startAnimations = () => {
    // Main animations
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();

    // Confetti animations
    confettiAnims.forEach((anim, index) => {
      const randomX = (Math.random() - 0.5) * 300;
      const randomRotate = Math.random() * 720;
      const delay = index * 50;

      Animated.parallel([
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim.x, {
            toValue: randomX,
            duration: 1000,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim.y, {
            toValue: 600,
            duration: 1000,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim.rotate, {
            toValue: randomRotate,
            duration: 1000,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.delay(delay + 500),
          Animated.timing(anim.opacity, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    });
  };

  const handleCopyDID = async () => {
    if (didInfo.did) {
      await Clipboard.setStringAsync(didInfo.did);
      Alert.alert('Copied!', 'DID copied to clipboard', [{ text: 'OK' }]);
    }
  };

  const handleContinue = () => {
    // For now, go to home. You can change this to biometric-setup later
    // router.replace('/tabs');
     router.push('/onboarding/biometric-setup');
  };

  // Format DID for display (show first and last parts)
  const formatDID = (did) => {
    if (!did) return 'Loading...';
    if (did.length > 40) {
      return `${did.substring(0, 20)}...${did.substring(did.length - 10)}`;
    }
    return did;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.confettiContainer}>
        {confettiAnims.map((anim, index) => {
          const rotation = anim.rotate.interpolate({
            inputRange: [0, 360],
            outputRange: ['0deg', '360deg'],
          });

          const colors = ['#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
          const color = colors[index % colors.length];

          return (
            <Animated.View
              key={index}
              style={[
                styles.confetti,
                {
                  backgroundColor: color,
                  transform: [
                    { translateX: anim.x },
                    { translateY: anim.y },
                    { rotate: rotation },
                  ],
                  opacity: anim.opacity,
                },
              ]}
            />
          );
        })}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.iconContainer,
            { transform: [{ scale: scaleAnim }] },
          ]}
        >
          <View style={styles.iconBackground}>
            <CheckCircle2 color="#FFFFFF" size={64} />
          </View>
        </Animated.View>

        <Animated.View style={{ opacity: fadeAnim }}>
          <Text style={styles.title}>Identity Created!</Text>
          <Text style={styles.subtitle}>
            Your decentralized identifier has been successfully registered on the
            blockchain.
          </Text>

          <View style={styles.didContainer}>
            <Text style={styles.didLabel}>Your DID</Text>
            <View style={styles.didBox}>
              <Text style={styles.didText} numberOfLines={1} ellipsizeMode="middle">
                {formatDID(didInfo.did)}
              </Text>
              <TouchableOpacity
                style={styles.copyButton}
                onPress={handleCopyDID}
              >
                <Copy color="#06B6D4" size={20} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Network</Text>
              <Text style={styles.infoValue}>Private Ethereum</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Status</Text>
              <View style={styles.statusBadge}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>Active</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Created</Text>
              <Text style={styles.infoValue}>
                {new Date().toLocaleDateString()}
              </Text>
            </View>
          </View>

          <View style={styles.featuresList}>
            <FeatureItem
              icon="🔐"
              title="Fully Secured"
              description="Your identity is protected by blockchain cryptography"
            />
            <FeatureItem
              icon="🌐"
              title="Globally Recognized"
              description="Use your DID across all compatible platforms"
            />
            <FeatureItem
              icon="👤"
              title="You're in Control"
              description="Only you can manage and share your credentials"
            />
          </View>

          <TouchableOpacity
            style={styles.continueButton}
            onPress={handleContinue}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#06B6D4', '#0891B2']}
              style={styles.gradientButton}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.continueButtonText}>Continue to Wallet</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

function FeatureItem({ icon, title, description }) {
  return (
    <View style={styles.featureItem}>
      <Text style={styles.featureIcon}>{icon}</Text>
      <View style={styles.featureContent}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDescription}>{description}</Text>
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
  scrollContent: {
    paddingHorizontal: 32,
    paddingTop: 40,
    paddingBottom: 40,
  },
  confettiContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 600,
    alignItems: 'center',
    justifyContent: 'flex-start',
    pointerEvents: 'none',
    zIndex: 10,
  },
  confetti: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  iconContainer: {
    alignItems: 'center',
    marginTop: 40,
  },
  iconBackground: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#F1F5F9',
    textAlign: 'center',
    marginTop: 32,
  },
  subtitle: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 24,
  },
  didContainer: {
    marginTop: 32,
  },
  didLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 8,
  },
  didBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  didText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#F1F5F9',
    fontFamily: 'monospace',
  },
  copyButton: {
    padding: 8,
  },
  infoCard: {
    marginTop: 24,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#94A3B8',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F1F5F9',
  },
  divider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
  },
  featuresList: {
    marginTop: 32,
    gap: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  featureIcon: {
    fontSize: 32,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F1F5F9',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: '#94A3B8',
    lineHeight: 20,
  },
  continueButton: {
    height: 56,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 40,
    shadowColor: '#06B6D4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  gradientButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  continueButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});