// app/onboarding.js
import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ScrollView,
  TouchableOpacity,
  Animated,
  Easing,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Wallet,
  Shield,
  Lock,
  QrCode,
  Link as LinkIcon,
  Mail,
} from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const slides = [
  {
    id: 1,
    title: 'Your Digital Identity Wallet',
    subtitle:
      'Store all your verified credentials in one secure place. Access them anytime, anywhere.',
    badges: [
      { icon: '🔐', label: 'Secure' },
      { icon: '📱', label: 'Mobile' },
      { icon: '🌐', label: 'Blockchain' },
    ],
  },
  {
    id: 2,
    title: 'Blockchain Verified',
    subtitle:
      'Every credential is cryptographically signed and recorded on the blockchain. Tamper-proof and instantly verifiable.',
    features: [
      { icon: '🛡️', label: 'Tamper-Proof' },
      { icon: '⚡', label: 'Instant Verify' },
      { icon: '🌍', label: 'Globally Accepted' },
    ],
  },
  {
    id: 3,
    title: 'You Control What You Share',
    subtitle:
      "Choose exactly which information to reveal. Share with QR codes, links, or email. You're always in control.",
    sharing: true,
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollViewRef = useRef(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      const nextIndex = currentIndex + 1;
      scrollViewRef.current?.scrollTo({
        x: nextIndex * SCREEN_WIDTH,
        animated: true,
      });
      setCurrentIndex(nextIndex);
    } else {
      handleGetStarted();
    }
  };

  const handleSkip = () => {
    handleGetStarted();
  };

  const handleGetStarted = () => {
    router.push('/onboarding/did-creation');
  };

  const handleScroll = (event) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SCREEN_WIDTH);
    setCurrentIndex(index);
  };

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          {
            useNativeDriver: false,
            listener: handleScroll,
          }
        )}
        scrollEventThrottle={16}
        style={styles.scrollView}
      >
        <Screen1 />
        <Screen2 />
        <Screen3 />
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.pagination}>
          {slides.map((_, index) => {
            const inputRange = [
              (index - 1) * SCREEN_WIDTH,
              index * SCREEN_WIDTH,
              (index + 1) * SCREEN_WIDTH,
            ];

            const dotWidth = scrollX.interpolate({
              inputRange,
              outputRange: [8, 24, 8],
              extrapolate: 'clamp',
            });

            const opacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.3, 1, 0.3],
              extrapolate: 'clamp',
            });

            return (
              <Animated.View
                key={index}
                style={[
                  styles.dot,
                  {
                    width: dotWidth,
                    opacity,
                  },
                ]}
              />
            );
          })}
        </View>

        {currentIndex === slides.length - 1 ? (
          <>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleGetStarted}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#06B6D4', '#0891B2']}
                style={styles.gradientButton}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.primaryButtonText}>Get Started</Text>
              </LinearGradient>
            </TouchableOpacity>
            <Text style={styles.legalText}>
              By continuing, you agree to our{' '}
              <Text style={styles.legalLink}>Terms</Text> and{' '}
              <Text style={styles.legalLink}>Privacy Policy</Text>
            </Text>
          </>
        ) : (
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleSkip}
            >
              <Text style={styles.secondaryButtonText}>Skip</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleNext}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#06B6D4', '#0891B2']}
                style={styles.gradientButton}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.primaryButtonText}>Next</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

function Screen1() {
  const floatAnim1 = useRef(new Animated.Value(0)).current;
  const floatAnim2 = useRef(new Animated.Value(0)).current;
  const floatAnim3 = useRef(new Animated.Value(0)).current;
  const rotateAnim1 = useRef(new Animated.Value(0)).current;
  const rotateAnim2 = useRef(new Animated.Value(0)).current;
  const rotateAnim3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createFloatingAnimation = (animValue, delay) => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(animValue, {
            toValue: 1,
            duration: 2000,
            delay,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(animValue, {
            toValue: 0,
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
    };

    const createRotateAnimation = (animValue, delay) => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(animValue, {
            toValue: 1,
            duration: 2000,
            delay,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(animValue, {
            toValue: -1,
            duration: 4000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(animValue, {
            toValue: 0,
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
    };

    createFloatingAnimation(floatAnim1, 0).start();
    createFloatingAnimation(floatAnim2, 300).start();
    createFloatingAnimation(floatAnim3, 600).start();
    createRotateAnimation(rotateAnim1, 0).start();
    createRotateAnimation(rotateAnim2, 500).start();
    createRotateAnimation(rotateAnim3, 1000).start();
  }, []);

  const translateY1 = floatAnim1.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -15],
  });

  const translateY2 = floatAnim2.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -12],
  });

  const translateY3 = floatAnim3.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -10],
  });

  const rotate1 = rotateAnim1.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-10deg', '10deg'],
  });

  const rotate2 = rotateAnim2.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-8deg', '8deg'],
  });

  const rotate3 = rotateAnim3.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-5deg', '5deg'],
  });

  return (
    <View style={styles.slide}>
      <View style={styles.illustrationContainer}>
        <LinearGradient
          colors={['#1E293B', '#334155']}
          style={styles.illustrationGradient}
        >
          <View style={styles.phoneContainer}>
            <View style={styles.phone}>
              <Wallet color="#06B6D4" size={64} />
            </View>
            <Animated.View
              style={[
                styles.floatingCard,
                styles.card1,
                {
                  transform: [
                    { translateY: translateY1 },
                    { rotate: rotate1 },
                  ],
                },
              ]}
            >
              <View style={styles.cardIcon}>
                <Text style={styles.cardEmoji}>🎓</Text>
              </View>
              <Text style={styles.cardLabel}>Degree</Text>
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedText}>✓</Text>
              </View>
            </Animated.View>
            <Animated.View
              style={[
                styles.floatingCard,
                styles.card2,
                {
                  transform: [
                    { translateY: translateY2 },
                    { rotate: rotate2 },
                  ],
                },
              ]}
            >
              <View style={styles.cardIcon}>
                <Text style={styles.cardEmoji}>📜</Text>
              </View>
              <Text style={styles.cardLabel}>Certificate</Text>
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedText}>✓</Text>
              </View>
            </Animated.View>
            <Animated.View
              style={[
                styles.floatingCard,
                styles.card3,
                {
                  transform: [
                    { translateY: translateY3 },
                    { rotate: rotate3 },
                  ],
                },
              ]}
            >
              <View style={styles.cardIcon}>
                <Text style={styles.cardEmoji}>🆔</Text>
              </View>
              <Text style={styles.cardLabel}>ID Card</Text>
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedText}>✓</Text>
              </View>
            </Animated.View>
          </View>
        </LinearGradient>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Your Digital Identity Wallet</Text>
        <Text style={styles.subtitle}>
          Store all your verified credentials in one secure place. Access them
          anytime, anywhere.
        </Text>

        <View style={styles.badgesContainer}>
          <View style={styles.badge}>
            <Text style={styles.badgeIcon}>🔐</Text>
            <Text style={styles.badgeLabel}>Secure</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeIcon}>📱</Text>
            <Text style={styles.badgeLabel}>Mobile</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeIcon}>🌐</Text>
            <Text style={styles.badgeLabel}>Blockchain</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function Screen2() {
  const glowAnim = useRef(new Animated.Value(0)).current;
  const checkmarkScale = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 3000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 3000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.spring(checkmarkScale, {
      toValue: 1,
      tension: 50,
      friction: 7,
      delay: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.8],
  });

  return (
    <View style={styles.slide}>
      <View style={styles.illustrationContainer}>
        <LinearGradient
          colors={['#1E293B', '#334155']}
          style={styles.illustrationGradient}
        >
          <View style={styles.blockchainContainer}>
            <Animated.View
              style={[
                styles.credentialCard,
                { transform: [{ scale: pulseAnim }] },
              ]}
            >
              <Text style={styles.universityEmoji}>🏛️</Text>
              <Text style={styles.credentialTitle}>Bachelor of Science</Text>
              <Text style={styles.credentialName}>Computer Science</Text>
              <View style={styles.blockchainBadge}>
                <Text style={styles.blockchainText}>
                  Verified on Blockchain
                </Text>
              </View>
              <Animated.View
                style={[
                  styles.checkmarkContainer,
                  {
                    transform: [{ scale: checkmarkScale }],
                    opacity: glowOpacity,
                  },
                ]}
              >
                <Shield color="#10B981" size={48} />
              </Animated.View>
            </Animated.View>
          </View>
        </LinearGradient>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Blockchain Verified</Text>
        <Text style={styles.subtitle}>
          Every credential is cryptographically signed and recorded on the
          blockchain. Tamper-proof and instantly verifiable.
        </Text>

        <View style={styles.featuresContainer}>
          <View style={styles.feature}>
            <Text style={styles.featureIcon}>🛡️</Text>
            <Text style={styles.featureLabel}>Tamper-Proof</Text>
          </View>
          <View style={styles.feature}>
            <Text style={styles.featureIcon}>⚡</Text>
            <Text style={styles.featureLabel}>Instant Verify</Text>
          </View>
          <View style={styles.feature}>
            <Text style={styles.featureIcon}>🌍</Text>
            <Text style={styles.featureLabel}>Globally Accepted</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function Screen3() {
  const shieldGlow = useRef(new Animated.Value(0)).current;
  const arrowPulse = useRef(new Animated.Value(1)).current;
  const toggleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shieldGlow, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(shieldGlow, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(arrowPulse, {
          toValue: 1.2,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(arrowPulse, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(toggleAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.delay(500),
        Animated.timing(toggleAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.delay(500),
      ])
    ).start();
  }, []);

  const shieldScale = shieldGlow.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.1],
  });

  const fieldOpacity = toggleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.3],
  });

  return (
    <View style={styles.slide}>
      <View style={styles.illustrationContainer}>
        <LinearGradient
          colors={['#1E293B', '#334155']}
          style={styles.illustrationGradient}
        >
          <View style={styles.privacyContainer}>
            <Animated.View
              style={[
                styles.privacyShield,
                { transform: [{ scale: shieldScale }] },
              ]}
            >
              <Lock color="#8B5CF6" size={48} />
            </Animated.View>
            <View style={styles.credentialComparison}>
              <View style={styles.beforeCard}>
                <Text style={styles.comparisonLabel}>Full Details</Text>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldIcon}>👤</Text>
                  <Text style={styles.fieldText}>Name</Text>
                </View>
                <Animated.View
                  style={[styles.fieldRow, { opacity: fieldOpacity }]}
                >
                  <Text style={styles.fieldIcon}>📊</Text>
                  <Text style={styles.fieldText}>GPA</Text>
                </Animated.View>
                <Animated.View
                  style={[styles.fieldRow, { opacity: fieldOpacity }]}
                >
                  <Text style={styles.fieldIcon}>📅</Text>
                  <Text style={styles.fieldText}>Date</Text>
                </Animated.View>
              </View>
              <Animated.View
                style={[
                  styles.arrow,
                  { transform: [{ scale: arrowPulse }] },
                ]}
              >
                <Text style={styles.arrowText}>→</Text>
              </Animated.View>
              <View style={styles.afterCard}>
                <Text style={styles.comparisonLabel}>Minimal</Text>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldIcon}>👤</Text>
                  <Text style={styles.fieldText}>Name</Text>
                </View>
                <View style={[styles.fieldRow, styles.fieldDisabled]}>
                  <Text style={styles.fieldIcon}>📊</Text>
                  <Text style={styles.fieldTextDisabled}>Hidden</Text>
                </View>
                <View style={[styles.fieldRow, styles.fieldDisabled]}>
                  <Text style={styles.fieldIcon}>📅</Text>
                  <Text style={styles.fieldTextDisabled}>Hidden</Text>
                </View>
              </View>
            </View>
          </View>
        </LinearGradient>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>You Control What You Share</Text>
        <Text style={styles.subtitle}>
          Choose exactly which information to reveal. Share with QR codes,
          links, or email. You're always in control.
        </Text>

        <View style={styles.sharingContainer}>
          <View style={styles.sharingCard}>
            <QrCode color="#06B6D4" size={32} />
            <Text style={styles.sharingLabel}>QR Code</Text>
          </View>
          <View style={styles.sharingCard}>
            <LinkIcon color="#06B6D4" size={32} />
            <Text style={styles.sharingLabel}>Link</Text>
          </View>
          <View style={styles.sharingCard}>
            <Mail color="#06B6D4" size={32} />
            <Text style={styles.sharingLabel}>Email</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  skipButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    padding: 8,
  },
  skipText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#94A3B8',
  },
  scrollView: {
    flex: 1,
  },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
  },
  illustrationContainer: {
    height: '50%',
  },
  illustrationGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  phoneContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: SCREEN_WIDTH,
    height: '100%',
  },
  phone: {
    width: 120,
    height: 200,
    backgroundColor: '#0F172A',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#06B6D4',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  floatingCard: {
    position: 'absolute',
    width: 100,
    height: 80,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 8,
    shadowColor: '#06B6D4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  card1: {
    top: '30%',
    left: 20,
  },
  card2: {
    top: '25%',
    right: 20,
  },
  card3: {
    bottom: '25%',
    left: 40,
  },
  cardIcon: {
    alignItems: 'center',
  },
  cardEmoji: {
    fontSize: 32,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F1F5F9',
    textAlign: 'center',
    marginTop: 4,
  },
  verifiedBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifiedText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  blockchainContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: SCREEN_WIDTH,
    paddingHorizontal: 40,
  },
  credentialCard: {
    width: '100%',
    maxWidth: 280,
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#06B6D4',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  universityEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  credentialTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#F1F5F9',
    marginBottom: 4,
  },
  credentialName: {
    fontSize: 16,
    color: '#94A3B8',
    marginBottom: 12,
  },
  blockchainBadge: {
    backgroundColor: 'rgba(6, 182, 212, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  blockchainText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#06B6D4',
  },
  checkmarkContainer: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
  },
  privacyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: SCREEN_WIDTH,
    paddingHorizontal: 20,
  },
  privacyShield: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  credentialComparison: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  beforeCard: {
    width: 110,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#06B6D4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  afterCard: {
    width: 110,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#06B6D4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  arrow: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowText: {
    fontSize: 24,
    color: '#8B5CF6',
  },
  comparisonLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 8,
    textAlign: 'center',
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  fieldDisabled: {
    opacity: 0.4,
  },
  fieldIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  fieldText: {
    fontSize: 11,
    color: '#F1F5F9',
    fontWeight: '500',
  },
  fieldTextDisabled: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '500',
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#F1F5F9',
    textAlign: 'center',
    lineHeight: 34,
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 18,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 27,
  },
  badgesContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(6, 182, 212, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  badgeIcon: {
    fontSize: 14,
  },
  badgeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#06B6D4',
  },
  featuresContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 32,
  },
  feature: {
    alignItems: 'center',
  },
  featureIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  featureLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#CBD5E1',
  },
  sharingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 32,
  },
  sharingCard: {
    width: 80,
    height: 80,
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sharingLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#06B6D4',
    marginTop: 8,
  },
  footer: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    height: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#06B6D4',
    marginHorizontal: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1E293B',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#94A3B8',
  },
  primaryButton: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    overflow: 'hidden',
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
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  legalText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 12,
  },
  legalLink: {
    color: '#06B6D4',
    textDecorationLine: 'underline',
  },
});