// app/onboarding/pin-setup.js - SINGLE PAGE MASTERPIECE
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
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { X, AlertTriangle, Check, Shield, Lock, ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { hashPIN, checkPINStrength } from '../../utils/pinUtils';
import * as secureStorage from '../../services/secureStorage';
import logger from '../../utils/logger';

const PIN_LENGTH = 6;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Calculate responsive dimensions
const getResponsiveDimensions = () => {
  const baseHeight = 812; // iPhone X height as base
  const heightRatio = SCREEN_HEIGHT / baseHeight;
  const widthRatio = SCREEN_WIDTH / 375;

  // Categorize screen sizes
  const isSmall = SCREEN_HEIGHT < 700;
  const isTiny = SCREEN_HEIGHT < 600;
  const isLarge = SCREEN_HEIGHT > 850;

  // Dynamic sizing based on screen height
  return {
    headerHeight: isSmall ? 140 : isTiny ? 120 : 180,
    iconSize: isTiny ? 40 : isSmall ? 50 : 60,
    titleSize: isTiny ? 18 : isSmall ? 20 : 24,
    subtitleSize: isTiny ? 12 : isSmall ? 13 : 14,
    dotSize: isTiny ? 32 : isSmall ? 38 : 44,
    buttonSize: Math.min(
      (SCREEN_WIDTH - 100) / 3, // Max width-based size
      isTiny ? 55 : isSmall ? 62 : 72 // Height-based size
    ),
    buttonFontSize: isTiny ? 20 : isSmall ? 24 : 28,
    spacing: {
      xs: isTiny ? 4 : 8,
      sm: isTiny ? 8 : 12,
      md: isTiny ? 12 : 16,
      lg: isTiny ? 16 : 24,
    },
    showTips: !isTiny && !isSmall,
    showProgress: !isTiny,
    compact: isSmall || isTiny,
  };
};

export default function PINSetupScreen() {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState('create');
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [dimensions] = useState(getResponsiveDimensions());

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    // Entrance animation
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

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 'create' || step === 'confirm') {
        handleBackPress();
        return true;
      }
      return false;
    });

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
          }, 1500);
          return;
        }

        setTimeout(() => {
          setStep('confirm');
          setError('');
        }, 300);
      }
    } else if (step === 'confirm' && confirmPin.length < PIN_LENGTH) {
      const newConfirmPin = confirmPin + num;
      setConfirmPin(newConfirmPin);

      if (newConfirmPin.length === PIN_LENGTH) {
        if (newConfirmPin === pin) {
          if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
          setStep('success');
          successAnimation();
          savePIN(pin);
        } else {
          if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          }
          setError('PINs do not match');
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
      const pinHash = await hashPIN(pinToSave);
      await secureStorage.savePINHash(pinHash);

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
        style={[
          styles.pinDotsContainer,
          { transform: [{ translateX: shakeAnim }] }
        ]}
      >
        {Array.from({ length: PIN_LENGTH }).map((_, index) => (
          <View
            key={index}
            style={[
              styles.pinDot,
              {
                width: dimensions.dotSize,
                height: dimensions.dotSize,
                borderRadius: dimensions.dotSize / 2,
              },
              currentPin.length > index && styles.pinDotFilled,
              error && styles.pinDotError,
            ]}
          >
            {currentPin.length > index && (
              <Animated.View
                style={[
                  styles.pinDotInner,
                  {
                    width: dimensions.dotSize * 0.3,
                    height: dimensions.dotSize * 0.3,
                    borderRadius: dimensions.dotSize * 0.15,
                  }
                ]}
              />
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
                return <View key={colIndex} style={{ width: dimensions.buttonSize }} />;
              }

              if (item === 'delete') {
                return (
                  <TouchableOpacity
                    key={colIndex}
                    style={[
                      styles.numberButton,
                      {
                        width: dimensions.buttonSize,
                        height: dimensions.buttonSize,
                        borderRadius: dimensions.buttonSize / 2,
                      }
                    ]}
                    onPress={handleDelete}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.deleteText, { fontSize: dimensions.buttonFontSize }]}>⌫</Text>
                  </TouchableOpacity>
                );
              }

              return (
                <TouchableOpacity
                  key={colIndex}
                  style={[
                    styles.numberButton,
                    styles.numberButtonFilled,
                    {
                      width: dimensions.buttonSize,
                      height: dimensions.buttonSize,
                      borderRadius: dimensions.buttonSize / 2,
                    }
                  ]}
                  onPress={() => handleNumberPress(item)}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#1E293B', '#0F172A']}
                    style={[
                      styles.buttonGradient,
                      {
                        width: dimensions.buttonSize - 2,
                        height: dimensions.buttonSize - 2,
                        borderRadius: (dimensions.buttonSize - 2) / 2,
                      }
                    ]}
                  >
                    <Text style={[styles.numberText, { fontSize: dimensions.buttonFontSize }]}>
                      {item}
                    </Text>
                  </LinearGradient>
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
      <LinearGradient
        colors={['#0F172A', '#1E293B']}
        style={styles.successGradient}
      >
        <SafeAreaView style={styles.container}>
          <View style={styles.successContent}>
            <Animated.View style={{ transform: [{ scale: successScale }] }}>
              <LinearGradient
                colors={['#10B981', '#059669']}
                style={[styles.successIcon, {
                  width: dimensions.iconSize * 2,
                  height: dimensions.iconSize * 2,
                  borderRadius: dimensions.iconSize,
                }]}
              >
                <Check color="#FFFFFF" size={dimensions.iconSize} strokeWidth={3} />
              </LinearGradient>
            </Animated.View>

            <Text style={[styles.successTitle, { fontSize: dimensions.titleSize }]}>
              PIN Created Successfully!
            </Text>
            <Text style={[styles.successSubtitle, { fontSize: dimensions.subtitleSize }]}>
              Your wallet is now protected
            </Text>

            <View style={styles.successBadges}>
              <View style={styles.badge}>
                <Shield color="#10B981" size={16} />
                <Text style={styles.badgeText}>Secured</Text>
              </View>
              <View style={styles.badge}>
                <Lock color="#10B981" size={16} />
                <Text style={styles.badgeText}>Protected</Text>
              </View>
            </View>

            {isProcessing && (
              <Text style={styles.processingText}>Setting up your wallet...</Text>
            )}
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={['#0F172A', '#1E293B', '#0F172A']}
      style={styles.mainGradient}
    >
      <SafeAreaView style={styles.container}>
        <Animated.View
          style={[
            styles.fullContent,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          {/* Header Section */}
          <View style={[styles.header, { height: dimensions.headerHeight }]}>
            <TouchableOpacity onPress={handleBackPress} style={styles.closeButton}>
              <X color="#94A3B8" size={24} />
            </TouchableOpacity>

            <LinearGradient
              colors={['#667eea', '#764ba2']}
              style={[styles.iconContainer, {
                width: dimensions.iconSize,
                height: dimensions.iconSize,
                borderRadius: dimensions.iconSize / 2,
              }]}
            >
              <Lock color="#FFFFFF" size={dimensions.iconSize * 0.6} strokeWidth={2.5} />
            </LinearGradient>

            <Text style={[styles.title, { fontSize: dimensions.titleSize }]}>
              {step === 'create' ? 'Create PIN' : 'Confirm PIN'}
            </Text>

            {dimensions.showProgress && (
              <View style={styles.progressDots}>
                <View style={[styles.progressDot, styles.progressDotActive]} />
                <View style={[
                  styles.progressDot,
                  step === 'confirm' && styles.progressDotActive
                ]} />
              </View>
            )}
          </View>

          {/* PIN Display Section */}
          <View style={styles.pinSection}>
            <Text style={[styles.subtitle, { fontSize: dimensions.subtitleSize }]}>
              {step === 'create'
                ? 'Enter a 6-digit PIN to secure your wallet'
                : 'Re-enter your PIN to confirm'}
            </Text>

            {renderPinDots()}

            {error ? (
              <Animated.View style={[styles.errorBox, { transform: [{ translateX: shakeAnim }] }]}>
                <AlertTriangle color="#EF4444" size={14} />
                <Text style={styles.errorText}>{error}</Text>
              </Animated.View>
            ) : dimensions.showTips && step === 'create' ? (
              <View style={styles.tipBox}>
                <Text style={styles.tipText}>💡 Avoid simple patterns like 123456</Text>
              </View>
            ) : null}
          </View>

          {/* Number Pad Section */}
          <View style={styles.numberPadSection}>
            {renderNumberPad()}
          </View>
        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  mainGradient: {
    flex: 1,
  },
  successGradient: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  fullContent: {
    flex: 1,
    justifyContent: 'space-between',
  },

  // Header Styles
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 10,
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 20,
    padding: 8,
    zIndex: 10,
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  title: {
    fontWeight: 'bold',
    color: '#F1F5F9',
    marginBottom: 8,
  },
  progressDots: {
    flexDirection: 'row',
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#334155',
  },
  progressDotActive: {
    backgroundColor: '#667eea',
    width: 24,
  },

  // PIN Section
  pinSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  subtitle: {
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  pinDotsContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  pinDot: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinDotFilled: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  pinDotError: {
    borderColor: '#EF4444',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  pinDotInner: {
    backgroundColor: '#FFFFFF',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    fontWeight: '500',
  },
  tipBox: {
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  tipText: {
    fontSize: 12,
    color: '#94A3B8',
  },

  // Number Pad
  numberPadSection: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  numberPad: {
    gap: 10,
  },
  numberPadRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    gap: 15,
  },
  numberButton: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  numberButtonFilled: {
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  buttonGradient: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  numberText: {
    fontWeight: '600',
    color: '#F1F5F9',
  },
  deleteText: {
    color: '#94A3B8',
  },

  // Success Screen
  successContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  successIcon: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  successTitle: {
    fontWeight: 'bold',
    color: '#10B981',
    marginBottom: 8,
    textAlign: 'center',
  },
  successSubtitle: {
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 24,
  },
  successBadges: {
    flexDirection: 'row',
    gap: 16,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
  },
  processingText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 20,
  },
});