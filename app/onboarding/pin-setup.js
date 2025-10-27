// app/onboarding/pin-setup.js - POLISHED & BEAUTIFUL
import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  Alert,
  BackHandler,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { X, AlertTriangle, Check, Shield, Lock } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { hashPIN, checkPINStrength } from '../../utils/pinUtils';
import * as secureStorage from '../../services/secureStorage';
import logger from '../../utils/logger';

const PIN_LENGTH = 6;

export default function PINSetupScreen() {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState('create'); // 'create' | 'confirm' | 'success'
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Prevent back navigation during PIN creation
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 'create' || step === 'confirm') {
        handleBackPress();
        return true;
      }
      return false;
    });

    // Start pulse animation for header
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();

    return () => backHandler.remove();
  }, [step]);

  const handleBackPress = () => {
    Alert.alert(
      'Cancel PIN Setup?',
      'You need to set up a PIN to secure your wallet.',
      [
        { text: 'Continue Setup', style: 'cancel' },
        { text: 'Go Back', onPress: () => router.back() }
      ]
    );
  };

  const triggerHaptic = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const shakeAnimation = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const successAnimation = () => {
    Animated.spring(successScale, {
      toValue: 1,
      tension: 50,
      friction: 7,
      useNativeDriver: true,
    }).start();
  };

  const handleNumberPress = (num) => {
    triggerHaptic();

    if (step === 'create' && pin.length < PIN_LENGTH) {
      const newPin = pin + num;
      setPin(newPin);
      setError('');

      if (newPin.length === PIN_LENGTH) {
        // Check PIN strength
        const strength = checkPINStrength(newPin);
        if (strength.isWeak) {
          setError(strength.reason);
          if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          }
          shakeAnimation();
          setTimeout(() => {
            setPin('');
            setError('');
          }, 2000);
          return;
        }
        
        // PIN is strong, move to confirm
        setTimeout(() => setStep('confirm'), 500);
      }
    } else if (step === 'confirm' && confirmPin.length < PIN_LENGTH) {
      const newConfirmPin = confirmPin + num;
      setConfirmPin(newConfirmPin);

      if (newConfirmPin.length === PIN_LENGTH) {
        if (newConfirmPin === pin) {
          // PINs match!
          if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
          setStep('success');
          successAnimation();
          savePIN(pin);
        } else {
          // PINs don't match
          if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          }
          setError('PINs do not match. Please try again.');
          shakeAnimation();
          setTimeout(() => {
            setConfirmPin('');
            setError('');
          }, 1500);
        }
      }
    }
  };

  const handleDelete = () => {
    triggerHaptic();
    
    if (step === 'create') {
      setPin(pin.slice(0, -1));
      setError('');
    } else if (step === 'confirm') {
      setConfirmPin(confirmPin.slice(0, -1));
      setError('');
    }
  };

  const savePIN = async (pinToSave) => {
    try {
      setIsProcessing(true);
      logger.info('🔐 Saving PIN...');

      // Hash and save PIN
      const pinHash = await hashPIN(pinToSave);
      await secureStorage.savePINHash(pinHash);

      logger.success('✅ PIN saved securely');

      // Navigate to recovery phrase backup after 1.5 seconds
      setTimeout(() => {
        router.replace('/onboarding/recovery-phrase-backup');
      }, 1500);

    } catch (error) {
      logger.error('Failed to save PIN: ' + error.message);
      Alert.alert('Error', 'Failed to save PIN. Please try again.');
      setStep('create');
      setPin('');
      setConfirmPin('');
      setIsProcessing(false);
    }
  };

  const renderPinDots = () => {
    const currentPin = step === 'create' ? pin : confirmPin;
    
    return (
      <Animated.View
        style={[styles.pinDotsContainer, { transform: [{ translateX: shakeAnim }] }]}
      >
        {Array.from({ length: PIN_LENGTH }).map((_, index) => (
          <View
            key={index}
            style={[
              styles.pinDot,
              currentPin.length > index ? styles.pinDotFilled : styles.pinDotEmpty,
              error && styles.pinDotError,
            ]}
          >
            {currentPin.length > index && (
              <View style={styles.pinDotInner} />
            )}
          </View>
        ))}
      </Animated.View>
    );
  };

  const renderNumberPad = () => {
    const numbers = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      ['', '0', 'delete'],
    ];

    return (
      <View style={styles.numberPad}>
        {numbers.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.numberPadRow}>
            {row.map((item, colIndex) => {
              if (item === '') {
                return <View key={colIndex} style={styles.numberButton} />;
              }

              if (item === 'delete') {
                return (
                  <TouchableOpacity
                    key={colIndex}
                    style={[styles.numberButton, styles.deleteButton]}
                    onPress={handleDelete}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.deleteText}>⌫</Text>
                  </TouchableOpacity>
                );
              }

              return (
                <TouchableOpacity
                  key={colIndex}
                  style={[styles.numberButton, styles.numberButtonFilled]}
                  onPress={() => handleNumberPress(item)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.numberText}>{item}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    );
  };

  if (step === 'success') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.successContainer}>
          <Animated.View style={{ transform: [{ scale: successScale }] }}>
            <LinearGradient
              colors={['#10B981', '#059669']}
              style={styles.successIconContainer}
            >
              <Check color="#FFFFFF" size={60} strokeWidth={3} />
            </LinearGradient>
          </Animated.View>
          <Text style={styles.successTitle}>PIN Created!</Text>
          <Text style={styles.successSubtitle}>
            {isProcessing ? 'Securing your wallet...' : 'Your wallet is now protected'}
          </Text>
          
          <View style={styles.successFeatures}>
            <View style={styles.successFeature}>
              <Shield color="#10B981" size={20} />
              <Text style={styles.successFeatureText}>Wallet Secured</Text>
            </View>
            <View style={styles.successFeature}>
              <Lock color="#10B981" size={20} />
              <Text style={styles.successFeatureText}>PIN Protected</Text>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <TouchableOpacity 
            onPress={handleBackPress} 
            style={styles.closeButton}
          >
            <X color="#FFFFFF" size={24} />
          </TouchableOpacity>

          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <View style={styles.headerIconContainer}>
              <Lock color="#FFFFFF" size={48} strokeWidth={2.5} />
            </View>
          </Animated.View>
          <Text style={styles.headerTitle}>Secure Your Wallet</Text>
        </LinearGradient>

        {/* Progress Steps */}
        <View style={styles.progressContainer}>
          <View style={styles.progressSteps}>
            <View style={[styles.progressStep, styles.progressStepActive]}>
              <Text style={styles.progressStepText}>1</Text>
            </View>
            <View style={styles.progressLine} />
            <View style={[styles.progressStep, step === 'confirm' && styles.progressStepActive]}>
              <Text style={[styles.progressStepText, step !== 'confirm' && styles.progressStepTextInactive]}>2</Text>
            </View>
          </View>
          <View style={styles.progressLabels}>
            <Text style={styles.progressLabel}>Create PIN</Text>
            <Text style={[styles.progressLabel, step !== 'confirm' && styles.progressLabelInactive]}>
              Confirm PIN
            </Text>
          </View>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.title}>
            {step === 'create' ? 'Create Your 6-Digit PIN' : 'Confirm Your PIN'}
          </Text>
          <Text style={styles.subtitle}>
            {step === 'create' 
              ? 'Choose a PIN that\'s easy to remember but hard to guess' 
              : 'Enter your PIN again to confirm'}
          </Text>

          {renderPinDots()}

          {error && (
            <View style={styles.errorContainer}>
              <AlertTriangle color="#EF4444" size={18} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {step === 'create' && !error && (
            <View style={styles.tipsCard}>
              <Text style={styles.tipsTitle}>💡 PIN Security Tips</Text>
              <View style={styles.tipsList}>
                <View style={styles.tipRow}>
                  <Check color="#10B981" size={14} />
                  <Text style={styles.tipText}>Use a unique PIN (not birthday or phone)</Text>
                </View>
                <View style={styles.tipRow}>
                  <X color="#EF4444" size={14} />
                  <Text style={styles.tipText}>Avoid: 123456, 111111, 000000</Text>
                </View>
                <View style={styles.tipRow}>
                  <X color="#EF4444" size={14} />
                  <Text style={styles.tipText}>Don't use repeated or sequential numbers</Text>
                </View>
              </View>
            </View>
          )}

          {step === 'confirm' && !error && (
            <View style={styles.infoCard}>
              <Shield color="#667eea" size={20} />
              <Text style={styles.infoText}>
                Re-enter your PIN to make sure you remember it
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Number Pad */}
      <View style={styles.numberPadContainer}>
        {renderNumberPad()}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    paddingTop: 20,
    paddingBottom: 30,
    alignItems: 'center',
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 20,
    right: 16,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  headerIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  progressContainer: {
    paddingHorizontal: 60,
    paddingVertical: 20,
    backgroundColor: '#1a1a2e',
  },
  progressSteps: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  progressStep: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#475569',
  },
  progressStepActive: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  progressStepText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  progressStepTextInactive: {
    color: '#64748B',
  },
  progressLine: {
    width: 60,
    height: 2,
    backgroundColor: '#334155',
    marginHorizontal: 8,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressLabel: {
    fontSize: 12,
    color: '#667eea',
    fontWeight: '600',
  },
  progressLabelInactive: {
    color: '#64748B',
  },
  content: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#F1F5F9',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 20,
    paddingHorizontal: 10,
  },
  pinDotsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  pinDot: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinDotEmpty: {
    borderWidth: 2,
    borderColor: '#334155',
    backgroundColor: 'transparent',
  },
  pinDotFilled: {
    backgroundColor: '#667eea',
    borderWidth: 2,
    borderColor: '#667eea',
  },
  pinDotError: {
    borderColor: '#EF4444',
  },
  pinDotInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EF4444',
    maxWidth: '90%',
  },
  errorText: {
    fontSize: 13,
    color: '#991B1B',
    fontWeight: '500',
    flex: 1,
  },
  tipsCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    width: '100%',
    borderWidth: 1,
    borderColor: '#334155',
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F1F5F9',
    marginBottom: 12,
  },
  tipsList: {
    gap: 8,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  tipText: {
    fontSize: 12,
    color: '#94A3B8',
    flex: 1,
    lineHeight: 18,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(102, 126, 234, 0.3)',
    borderRadius: 10,
    padding: 14,
    marginTop: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#94A3B8',
    flex: 1,
    lineHeight: 18,
  },
  numberPadContainer: {
    paddingBottom: Platform.OS === 'ios' ? 8 : 16,
  },
  numberPad: {
    paddingHorizontal: 30,
  },
  numberPadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  numberButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
  },
  numberButtonFilled: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  deleteButton: {
    backgroundColor: 'transparent',
  },
  numberText: {
    fontSize: 26,
    fontWeight: '600',
    color: '#F1F5F9',
  },
  deleteText: {
    fontSize: 28,
    color: '#94A3B8',
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  successIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#10B981',
    marginBottom: 12,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 32,
  },
  successFeatures: {
    flexDirection: 'row',
    gap: 20,
  },
  successFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1E293B',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  successFeatureText: {
    fontSize: 13,
    color: '#10B981',
    fontWeight: '600',
  },
});