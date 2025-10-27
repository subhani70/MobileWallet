// app/onboarding/biometric-setup.js - FULLY FUNCTIONAL
import { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Switch,
    TextInput,
    Modal,
    Animated,
    Platform,
    Alert,
    BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
    Shield, Zap, Lock, Info, Grid3x3, Key,
    ChevronDown, ChevronRight, Eye, EyeOff,
    Check, X, AlertTriangle
} from 'lucide-react-native';
import * as biometric from '../../services/biometric';
import * as secureStorage from '../../services/secureStorage';
import { hashPIN, checkPINStrength } from '../../utils/pinUtils';
import logger from '../../utils/logger';

export default function BiometricSetupScreen() {
    const router = useRouter();
    const [biometricEnabled, setBiometricEnabled] = useState(false);
    const [biometricAvailable, setBiometricAvailable] = useState(false);
    const [biometricType, setBiometricType] = useState('Face ID');
    const [backupMethod, setBackupMethod] = useState(null);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [showPinModal, setShowPinModal] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [autoLockTimeout, setAutoLockTimeout] = useState('5min');
    const [requireForSharing, setRequireForSharing] = useState(true);
    const [requireForViewing, setRequireForViewing] = useState(false);
    const [failedAttempts, setFailedAttempts] = useState('5');
    const [isProcessing, setIsProcessing] = useState(false);

    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        checkBiometricAvailability();
        startPulseAnimation();
    }, []);

    const checkBiometricAvailability = async () => {
        try {
            const canUse = await biometric.canUseBiometric();
            setBiometricAvailable(canUse);

            if (canUse) {
                const types = await biometric.getSupportedAuthTypes();
                if (types.length > 0) {
                    setBiometricType(types[0]); // Use first available (Face ID, Fingerprint, etc.)
                    logger.info(`✅ Biometric available: ${types[0]}`);
                }
            } else {
                logger.warning('⚠️ Biometric not available on this device');
            }
        } catch (error) {
            logger.error('Failed to check biometric: ' + error.message);
            setBiometricAvailable(false);
        }
    };

    const startPulseAnimation = () => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.2,
                    duration: 1000,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    };

    // const handleEnableBiometric = async () => {
    //     if (!backupMethod) {
    //         Alert.alert('Select Backup Method', 'Please select a backup authentication method first.');
    //         return;
    //     }

    //     if (biometricEnabled && biometricAvailable) {
    //         // Test biometric authentication
    //         const result = await biometric.authenticateWithBiometric('Authenticate to enable biometric login');

    //         if (!result.success) {
    //             Alert.alert('Authentication Failed', result.error || 'Could not authenticate with biometric.');
    //             return;
    //         }
    //     }

    //     if (backupMethod === 'pin') {
    //         setShowPinModal(true);
    //     } else if (backupMethod === 'password') {
    //         setShowPasswordModal(true);
    //     }
    // };

    // app/onboarding/biometric-setup.js
    // Update these functions:

    const handleEnableBiometric = async () => {
        if (!backupMethod) {
            Alert.alert('Select Backup Method', 'Please select a backup authentication method first.');
            return;
        }

        if (biometricEnabled && biometricAvailable) {
            // Test biometric authentication
            const result = await biometric.authenticateWithBiometric('Authenticate to enable biometric login');

            if (!result.success) {
                Alert.alert('Authentication Failed', result.error || 'Could not authenticate with biometric.');
                return;
            }
        }

        // Save biometric preference
        await secureStorage.setBiometricEnabled(biometricEnabled);

        // Save security settings
        await secureStorage.saveSecure('auto_lock_timeout', autoLockTimeout);
        await secureStorage.saveSecure('require_for_sharing', String(requireForSharing));
        await secureStorage.saveSecure('require_for_viewing', String(requireForViewing));
        await secureStorage.saveSecure('failed_attempts_limit', failedAttempts);

        // Navigate to PIN setup page
        if (backupMethod === 'pin') {
            router.push('/onboarding/pin-setup');
        } else if (backupMethod === 'password') {
            // For now, also use PIN setup (you can create password setup later)
            router.push('/onboarding/pin-setup');
        }
    };

    // Remove the PinSetupModal and PasswordSetupModal components completely

    const handleSkip = async () => {
        Alert.alert(
            'Skip Biometric Setup?',
            'You can enable this later in settings. Your wallet will be less secure without biometric authentication.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Skip',
                    onPress: async () => {
                        // Save that biometric was skipped
                        await secureStorage.setBiometricEnabled(false);
                        // Navigate to next step or home
                        router.replace('/tabs');
                    }
                }
            ]
        );
    };

    const handlePinComplete = async (pin) => {
        try {
            setIsProcessing(true);

            // Hash and save PIN
            const pinHash = await hashPIN(pin);
            await secureStorage.savePINHash(pinHash);

            // Save biometric settings
            await secureStorage.setBiometricEnabled(biometricEnabled);

            // Save security settings
            await secureStorage.saveSecure('auto_lock_timeout', autoLockTimeout);
            await secureStorage.saveSecure('require_for_sharing', String(requireForSharing));
            await secureStorage.saveSecure('require_for_viewing', String(requireForViewing));
            await secureStorage.saveSecure('failed_attempts_limit', failedAttempts);

            logger.success('✅ Security settings saved');

            setShowPinModal(false);
            setIsProcessing(false);

            // Navigate to next step or home
            router.replace('/tabs');

        } catch (error) {
            logger.error('Failed to save PIN: ' + error.message);
            Alert.alert('Error', 'Failed to save security settings. Please try again.');
            setIsProcessing(false);
        }
    };

    const handlePasswordComplete = async (password) => {
        try {
            setIsProcessing(true);

            // For now, hash password as PIN (you can implement proper password hashing)
            const passwordHash = await hashPIN(password);
            await secureStorage.savePINHash(passwordHash);

            // Save biometric settings
            await secureStorage.setBiometricEnabled(biometricEnabled);

            // Save security settings
            await secureStorage.saveSecure('auto_lock_timeout', autoLockTimeout);
            await secureStorage.saveSecure('require_for_sharing', String(requireForSharing));
            await secureStorage.saveSecure('require_for_viewing', String(requireForViewing));
            await secureStorage.saveSecure('failed_attempts_limit', failedAttempts);

            logger.success('✅ Security settings saved');

            setShowPasswordModal(false);
            setIsProcessing(false);

            // Navigate to next step or home
            router.replace('/tabs');

        } catch (error) {
            logger.error('Failed to save password: ' + error.message);
            Alert.alert('Error', 'Failed to save security settings. Please try again.');
            setIsProcessing(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <LinearGradient
                    colors={['#8B5CF6', '#3B82F6']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.header}
                >
                    <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
                        <Text style={styles.skipText}>Skip</Text>
                    </TouchableOpacity>

                    <Text style={styles.stepIndicator}>Step 4 of 5</Text>

                    <Animated.View
                        style={[
                            styles.illustrationContainer,
                            { transform: [{ scale: pulseAnim }] },
                        ]}
                    >
                        <View style={styles.glowEffect}>
                            <Shield color="#FFFFFF" size={80} strokeWidth={2} />
                        </View>
                    </Animated.View>
                </LinearGradient>

                <View style={styles.content}>
                    <Text style={styles.title}>Secure Your Wallet</Text>
                    <Text style={styles.subtitle}>
                        Add an extra layer of security with biometric authentication
                    </Text>

                    <View style={styles.biometricCard}>
                        <View style={styles.biometricIconContainer}>
                            <LinearGradient
                                colors={['#06B6D4', '#0891B2']}
                                style={styles.iconGradient}
                            >
                                <Shield color="#FFFFFF" size={32} />
                            </LinearGradient>
                        </View>
                        <View style={styles.biometricContent}>
                            <Text style={styles.cardTitle}>{biometricType}</Text>
                            <Text style={styles.cardDescription}>
                                {biometricAvailable
                                    ? `Unlock with your ${biometricType.toLowerCase()}`
                                    : 'Not available on this device'}
                            </Text>
                        </View>
                        <Switch
                            value={biometricEnabled}
                            onValueChange={setBiometricEnabled}
                            trackColor={{ false: '#475569', true: '#06B6D4' }}
                            thumbColor="#FFFFFF"
                            disabled={!biometricAvailable}
                        />
                    </View>

                    {!biometricAvailable && (
                        <View style={styles.warningBanner}>
                            <AlertTriangle color="#F59E0B" size={20} />
                            <Text style={styles.warningText}>
                                Biometric authentication is not set up on this device. You can still use PIN or password.
                            </Text>
                        </View>
                    )}

                    <View style={styles.benefitsSection}>
                        <Text style={styles.sectionTitle}>
                            Why Enable Biometric Security?
                        </Text>

                        <BenefitItem
                            icon={<Zap color="#8B5CF6" size={24} />}
                            title="Fast & Convenient"
                            description="Access your wallet in under a second"
                            isLast={false}
                        />
                        <BenefitItem
                            icon={<Shield color="#10B981" size={24} />}
                            title="Highly Secure"
                            description="Your biometric data never leaves your device"
                            isLast={false}
                        />
                        <BenefitItem
                            icon={<Lock color="#3B82F6" size={24} />}
                            title="Privacy Protected"
                            description="No one can access your wallet without authentication"
                            isLast={true}
                        />
                    </View>

                    <View style={styles.backupSection}>
                        <Text style={styles.sectionTitle}>Backup Authentication</Text>

                        <View style={styles.infoBanner}>
                            <Info color="#3B82F6" size={16} />
                            <Text style={styles.infoBannerText}>
                                Set up a backup method in case biometric fails
                            </Text>
                        </View>

                        <TouchableOpacity
                            style={[
                                styles.backupCard,
                                backupMethod === 'pin' && styles.backupCardSelected,
                            ]}
                            onPress={() => setBackupMethod('pin')}
                        >
                            <View style={styles.backupIconContainer}>
                                <Grid3x3 color="#06B6D4" size={32} />
                            </View>
                            <View style={styles.backupContent}>
                                <Text style={styles.cardTitle}>6-Digit PIN</Text>
                                <Text style={styles.cardDescription}>Simple numeric code</Text>
                            </View>
                            <View style={styles.radioButton}>
                                {backupMethod === 'pin' && (
                                    <View style={styles.radioButtonInner} />
                                )}
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.backupCard,
                                backupMethod === 'password' && styles.backupCardSelected,
                            ]}
                            onPress={() => setBackupMethod('password')}
                        >
                            <View style={styles.backupIconContainer}>
                                <Key color="#06B6D4" size={32} />
                            </View>
                            <View style={styles.backupContent}>
                                <Text style={styles.cardTitle}>Password</Text>
                                <Text style={styles.cardDescription}>
                                    Alphanumeric password
                                </Text>
                            </View>
                            <View style={styles.radioButton}>
                                {backupMethod === 'password' && (
                                    <View style={styles.radioButtonInner} />
                                )}
                            </View>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.advancedSection}>
                        <TouchableOpacity
                            style={styles.advancedTrigger}
                            onPress={() => setShowAdvanced(!showAdvanced)}
                        >
                            <Text style={styles.advancedTriggerText}>Advanced Options</Text>
                            {showAdvanced ? (
                                <ChevronDown color="#06B6D4" size={20} />
                            ) : (
                                <ChevronRight color="#06B6D4" size={20} />
                            )}
                        </TouchableOpacity>

                        {showAdvanced && (
                            <View style={styles.advancedContent}>
                                <View style={styles.advancedOptionRow}>
                                    <View style={styles.optionInfo}>
                                        <Text style={styles.optionLabel}>
                                            Require for sharing credentials
                                        </Text>
                                    </View>
                                    <Switch
                                        value={requireForSharing}
                                        onValueChange={setRequireForSharing}
                                        trackColor={{ false: '#475569', true: '#06B6D4' }}
                                        thumbColor="#FFFFFF"
                                    />
                                </View>

                                <View style={styles.advancedOptionRow}>
                                    <View style={styles.optionInfo}>
                                        <Text style={styles.optionLabel}>
                                            Require for viewing credential details
                                        </Text>
                                    </View>
                                    <Switch
                                        value={requireForViewing}
                                        onValueChange={setRequireForViewing}
                                        trackColor={{ false: '#475569', true: '#06B6D4' }}
                                        thumbColor="#FFFFFF"
                                    />
                                </View>
                            </View>
                        )}
                    </View>
                </View>
            </ScrollView>

            <View style={styles.bottomSection}>
                {!biometricEnabled && (
                    <View style={styles.warningBar}>
                        <AlertTriangle color="#F59E0B" size={16} />
                        <Text style={styles.warningBarText}>
                            Your wallet will be less secure without biometric authentication
                        </Text>
                    </View>
                )}

                <TouchableOpacity
                    style={[
                        styles.primaryButton,
                        !backupMethod && styles.buttonDisabled
                    ]}
                    onPress={handleEnableBiometric}
                    disabled={!backupMethod || isProcessing}
                >
                    <LinearGradient
                        colors={
                            backupMethod
                                ? ['#06B6D4', '#0891B2']
                                : ['#94A3B8', '#94A3B8']
                        }
                        style={styles.buttonGradient}
                    >
                        <Shield color="#FFFFFF" size={20} />
                        <Text style={styles.buttonText}>
                            {isProcessing ? 'Saving...' : 'Continue'}
                        </Text>
                    </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity style={styles.secondaryButton} onPress={handleSkip}>
                    <Text style={styles.secondaryButtonText}>I'll Do This Later</Text>
                </TouchableOpacity>
            </View>

            <PinSetupModal
                visible={showPinModal}
                onClose={(pin) => {
                    if (pin) {
                        handlePinComplete(pin);
                    } else {
                        setShowPinModal(false);
                    }
                }}
            />

            <PasswordSetupModal
                visible={showPasswordModal}
                onClose={(password) => {
                    if (password) {
                        handlePasswordComplete(password);
                    } else {
                        setShowPasswordModal(false);
                    }
                }}
            />
        </SafeAreaView>
    );
}

function BenefitItem({ icon, title, description, isLast }) {
    return (
        <View style={[styles.benefitItem, !isLast && styles.benefitItemBorder]}>
            <View style={styles.benefitIcon}>{icon}</View>
            <View style={styles.benefitContent}>
                <Text style={styles.benefitTitle}>{title}</Text>
                <Text style={styles.benefitDescription}>{description}</Text>
            </View>
        </View>
    );
}

function PinSetupModal({ visible, onClose }) {
    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [step, setStep] = useState('create');
    const [error, setError] = useState('');

    const handleNumberPress = (num) => {
        if (step === 'create' && pin.length < 6) {
            const newPin = pin + num;
            setPin(newPin);

            // Check PIN strength
            if (newPin.length === 6) {
                const strength = checkPINStrength(newPin);
                if (strength.isWeak) {
                    setError(strength.reason);
                    setTimeout(() => {
                        setPin('');
                        setError('');
                    }, 2000);
                    return;
                }
                setTimeout(() => setStep('confirm'), 500);
            }
        } else if (step === 'confirm' && confirmPin.length < 6) {
            const newConfirmPin = confirmPin + num;
            setConfirmPin(newConfirmPin);
            if (newConfirmPin.length === 6) {
                if (newConfirmPin === pin) {
                    setStep('success');
                    setTimeout(() => onClose(pin), 1500);
                } else {
                    setError('PINs do not match');
                    setTimeout(() => {
                        setConfirmPin('');
                        setError('');
                    }, 1500);
                }
            }
        }
    };

    const handleDelete = () => {
        if (step === 'create') {
            setPin(pin.slice(0, -1));
            setError('');
        } else if (step === 'confirm') {
            setConfirmPin(confirmPin.slice(0, -1));
            setError('');
        }
    };

    const handleClose = () => {
        setPin('');
        setConfirmPin('');
        setStep('create');
        setError('');
        onClose(null);
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
            <SafeAreaView style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>
                        {step === 'create' && 'Create 6-Digit PIN'}
                        {step === 'confirm' && 'Confirm Your PIN'}
                        {step === 'success' && 'PIN Created Successfully!'}
                    </Text>
                    <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
                        <X color="#F1F5F9" size={24} />
                    </TouchableOpacity>
                </View>

                {step === 'success' ? (
                    <View style={styles.successContainer}>
                        <View style={styles.successIcon}>
                            <Check color="#10B981" size={80} />
                        </View>
                        <Text style={styles.successText}>PIN Created Successfully!</Text>
                    </View>
                ) : (
                    <>
                        <View style={styles.pinDisplay}>
                            {[0, 1, 2, 3, 4, 5].map((index) => {
                                const currentPin = step === 'create' ? pin : confirmPin;
                                const filled = index < currentPin.length;
                                return (
                                    <View
                                        key={index}
                                        style={[styles.pinCircle, filled && styles.pinCircleFilled]}
                                    >
                                        {filled && (
                                            <Text style={styles.pinNumber}>{currentPin[index]}</Text>
                                        )}
                                    </View>
                                );
                            })}
                        </View>

                        {error && (
                            <View style={styles.errorContainer}>
                                <AlertTriangle color="#EF4444" size={16} />
                                <Text style={styles.errorText}>{error}</Text>
                            </View>
                        )}

                        <View style={styles.numberPad}>
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, 'delete'].map((num, index) => {
                                if (num === '') {
                                    return <View key={index} style={styles.numberButton} />;
                                }
                                return (
                                    <TouchableOpacity
                                        key={index}
                                        style={styles.numberButton}
                                        onPress={() => {
                                            if (num === 'delete') {
                                                handleDelete();
                                            } else {
                                                handleNumberPress(String(num));
                                            }
                                        }}
                                    >
                                        {num === 'delete' ? (
                                            <Text style={styles.deleteText}>⌫</Text>
                                        ) : (
                                            <Text style={styles.numberText}>{num}</Text>
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </>
                )}
            </SafeAreaView>
        </Modal>
    );
}

function PasswordSetupModal({ visible, onClose }) {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const requirements = [
        { text: 'At least 8 characters', met: password.length >= 8 },
        { text: 'Contains uppercase letter', met: /[A-Z]/.test(password) },
        { text: 'Contains lowercase letter', met: /[a-z]/.test(password) },
        { text: 'Contains number', met: /[0-9]/.test(password) },
        { text: 'Contains special character', met: /[!@#$%^&*]/.test(password) },
    ];

    const allRequirementsMet = requirements.every((req) => req.met);
    const passwordsMatch = password === confirmPassword && password.length > 0;

    const getPasswordStrength = () => {
        const metCount = requirements.filter((req) => req.met).length;
        if (metCount <= 2) return { label: 'Weak', color: '#EF4444' };
        if (metCount === 3) return { label: 'Fair', color: '#F59E0B' };
        if (metCount === 4) return { label: 'Good', color: '#FBBF24' };
        return { label: 'Strong', color: '#10B981' };
    };

    const strength = getPasswordStrength();

    const handleCreate = () => {
        if (allRequirementsMet && passwordsMatch) {
            onClose(password);
        }
    };

    const handleClose = () => {
        setPassword('');
        setConfirmPassword('');
        onClose(null);
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
            <SafeAreaView style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Create Password</Text>
                    <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
                        <X color="#F1F5F9" size={24} />
                    </TouchableOpacity>
                </View>

                <ScrollView style={styles.passwordForm}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Password</Text>
                        <View style={styles.passwordInputContainer}>
                            <TextInput
                                style={styles.passwordInput}
                                placeholder="Minimum 8 characters"
                                placeholderTextColor="#64748B"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry={!showPassword}
                                autoCapitalize="none"
                            />
                            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                {showPassword ? (
                                    <EyeOff color="#94A3B8" size={20} />
                                ) : (
                                    <Eye color="#94A3B8" size={20} />
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.strengthMeter}>
                        <View
                            style={[
                                styles.strengthBar,
                                {
                                    width: `${(requirements.filter((r) => r.met).length / 5) * 100}%`,
                                    backgroundColor: strength.color,
                                },
                            ]}
                        />
                    </View>
                    <Text style={[styles.strengthText, { color: strength.color }]}>
                        Password strength: {strength.label}
                    </Text>

                    <View style={styles.requirementsList}>
                        {requirements.map((req, index) => (
                            <View key={index} style={styles.requirementItem}>
                                {req.met ? (
                                    <Check color="#10B981" size={16} />
                                ) : (
                                    <X color="#64748B" size={16} />
                                )}
                                <Text
                                    style={[
                                        styles.requirementText,
                                        req.met && styles.requirementTextMet,
                                    ]}
                                >
                                    {req.text}
                                </Text>
                            </View>
                        ))}
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Confirm Password</Text>
                        <View style={styles.passwordInputContainer}>
                            <TextInput
                                style={styles.passwordInput}
                                placeholder="Re-enter password"
                                placeholderTextColor="#64748B"
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                                secureTextEntry={!showConfirm}
                                autoCapitalize="none"
                            />
                            <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)}>
                                {showConfirm ? (
                                    <EyeOff color="#94A3B8" size={20} />
                                ) : (
                                    <Eye color="#94A3B8" size={20} />
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>

                    {confirmPassword.length > 0 && !passwordsMatch && (
                        <View style={styles.errorContainer}>
                            <AlertTriangle color="#EF4444" size={16} />
                            <Text style={styles.errorText}>Passwords do not match</Text>
                        </View>
                    )}
                </ScrollView>

                <View style={styles.modalFooter}>
                    <TouchableOpacity
                        style={[
                            styles.createButton,
                            (!allRequirementsMet || !passwordsMatch) && styles.buttonDisabled,
                        ]}
                        onPress={handleCreate}
                        disabled={!allRequirementsMet || !passwordsMatch}
                    >
                        <LinearGradient
                            colors={
                                allRequirementsMet && passwordsMatch
                                    ? ['#06B6D4', '#0891B2']
                                    : ['#94A3B8', '#94A3B8']
                            }
                            style={styles.buttonGradient}
                        >
                            <Text style={styles.buttonText}>Create Password</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </Modal>
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
        paddingBottom: 200,
    },
    header: {
        height: 200,
        alignItems: 'center',
        paddingTop: 16,
    },
    skipButton: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 16 : 8,
        right: 16,
        zIndex: 10,
    },
    skipText: {
        fontSize: 16,
        fontWeight: '500',
        color: 'rgba(255, 255, 255, 0.8)',
    },
    stepIndicator: {
        fontSize: 14,
        fontWeight: '500',
        color: 'rgba(255, 255, 255, 0.7)',
        marginBottom: 24,
    },
    illustrationContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    glowEffect: {
        shadowColor: '#FFFFFF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 10,
    },
    content: {
        padding: 16,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#F1F5F9',
        textAlign: 'center',
        marginBottom: 12,
    },
    subtitle: {
        fontSize: 18,
        color: '#94A3B8',
        textAlign: 'center',
        lineHeight: 27,
        maxWidth: 320,
        alignSelf: 'center',
        marginBottom: 24,
    },
    biometricCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1E293B',
        borderRadius: 16,
        borderWidth: 2,
        borderColor: '#334155',
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 4,
    },
    biometricIconContainer: {
        marginRight: 12,
    },
    iconGradient: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
    },
    biometricContent: {
        flex: 1,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#F1F5F9',
        marginBottom: 4,
    },
    cardDescription: {
        fontSize: 14,
        color: '#94A3B8',
    },
    warningBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#FEF3C7',
        borderRadius: 12,
        padding: 12,
        marginBottom: 16,
    },
    warningText: {
        flex: 1,
        fontSize: 13,
        color: '#92400E',
    },
    benefitsSection: {
        marginTop: 24,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#F1F5F9',
        marginBottom: 16,
    },
    benefitItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingVertical: 12,
        gap: 12,
    },
    benefitItemBorder: {
        borderBottomWidth: 1,
        borderBottomColor: '#334155',
    },
    benefitIcon: {
        marginTop: 2,
    },
    benefitContent: {
        flex: 1,
    },
    benefitTitle: {
        fontSize: 15,
        fontWeight: '500',
        color: '#F1F5F9',
        marginBottom: 4,
    },
    benefitDescription: {
        fontSize: 13,
        color: '#94A3B8',
        lineHeight: 18,
    },
    backupSection: {
        marginTop: 24,
    },
    infoBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#1E293B',
        borderWidth: 1,
        borderColor: '#334155',
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
    },
    infoBannerText: {
        flex: 1,
        fontSize: 14,
        color: '#94A3B8',
    },
    backupCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1E293B',
        borderRadius: 16,
        borderWidth: 2,
        borderColor: '#334155',
        padding: 16,
        marginBottom: 12,
    },
    backupCardSelected: {
        borderColor: '#06B6D4',
        backgroundColor: 'rgba(6, 182, 212, 0.05)',
    },
    backupIconContainer: {
        width: 48,
        height: 48,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    backupContent: {
        flex: 1,
    },
    radioButton: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#06B6D4',
        justifyContent: 'center',
        alignItems: 'center',
    },
    radioButtonInner: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#06B6D4',
    },
    advancedSection: {
        marginTop: 16,
    },
    advancedTrigger: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
    },
    advancedTriggerText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#06B6D4',
    },
    advancedContent: {
        backgroundColor: '#1E293B',
        borderRadius: 12,
        padding: 16,
        marginTop: 8,
        gap: 16,
    },
    advancedOption: {
        gap: 8,
    },
    advancedOptionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    optionLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: '#F1F5F9',
    },
    optionInfo: {
        flex: 1,
    },
    dropdown: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#0F172A',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#334155',
        padding: 12,
    },
    dropdownText: {
        fontSize: 14,
        color: '#E2E8F0',
    },
    bottomSection: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#1E293B',
        borderTopWidth: 1,
        borderTopColor: '#334155',
        padding: 16,
        paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    },
    warningBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#FEF3C7',
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
    },
    warningBarText: {
        flex: 1,
        fontSize: 13,
        fontWeight: '500',
        color: '#92400E',
    },
    primaryButton: {
        height: 52,
        borderRadius: 12,
        overflow: 'hidden',
        shadowColor: '#06B6D4',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 6,
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    buttonGradient: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    buttonText: {
        fontSize: 17,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    secondaryButton: {
        paddingVertical: 12,
        marginTop: 12,
    },
    secondaryButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#64748B',
        textAlign: 'center',
    },
    modalContainer: {
        flex: 1,
        backgroundColor: '#0F172A',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#334155',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#F1F5F9',
    },
    closeButton: {
        position: 'absolute',
        right: 16,
        top: 16,
    },
    successContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    successIcon: {
        marginBottom: 16,
    },
    successText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#10B981',
    },
    pinDisplay: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
        marginVertical: 48,
    },
    pinCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        borderWidth: 2,
        borderColor: '#475569',
        justifyContent: 'center',
        alignItems: 'center',
    },
    pinCircleFilled: {
        backgroundColor: '#06B6D4',
        borderColor: '#06B6D4',
    },
    pinNumber: {
        fontSize: 24,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginBottom: 16,
    },
    errorText: {
        fontSize: 14,
        color: '#EF4444',
    },
    numberPad: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        padding: 16,
    },
    numberButton: {
        width: 72,
        height: 72,
        margin: 12,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 36,
        backgroundColor: '#1E293B',
    },
    numberText: {
        fontSize: 28,
        fontWeight: '600',
        color: '#F1F5F9',
    },
    deleteText: {
        fontSize: 32,
        color: '#F1F5F9',
    },
    passwordForm: {
        flex: 1,
        padding: 16,
    },
    inputGroup: {
        marginBottom: 24,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: '#F1F5F9',
        marginBottom: 8,
    },
    passwordInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1E293B',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#334155',
        paddingHorizontal: 16,
    },
    passwordInput: {
        flex: 1,
        height: 48,
        fontSize: 16,
        color: '#F1F5F9',
    },
    strengthMeter: {
        height: 4,
        backgroundColor: '#334155',
        borderRadius: 2,
        marginBottom: 8,
        overflow: 'hidden',
    },
    strengthBar: {
        height: '100%',
    },
    strengthText: {
        fontSize: 12,
        fontWeight: '500',
        marginBottom: 16,
    },
    requirementsList: {
        gap: 8,
        marginBottom: 24,
    },
    requirementItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    requirementText: {
        fontSize: 14,
        color: '#64748B',
    },
    requirementTextMet: {
        color: '#10B981',
    },
    modalFooter: {
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#334155',
    },
    createButton: {
        height: 52,
        borderRadius: 12,
        overflow: 'hidden',
    },
});