// app/auth/sign-in.js
import { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Modal,
    Animated,
    Platform,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
    Shield,
    Lock,
    PlusCircle,
    Download,
    HelpCircle,
    Info,
    Key,
    FileText,
    QrCode,
    ChevronRight,
    X,
    Delete as DeleteIcon,
    Fingerprint,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as LocalAuthentication from 'expo-local-authentication';
import * as secureStorage from '../../services/secureStorage';
import { verifyPIN } from '../../utils/pinUtils';
import logger from '../../utils/logger';

// at the top with other imports
import { setUnlocked } from '../../utils/session';

// inside your onSuccessfulAuth function:
const onSuccessfulAuth = async (method = 'PIN') => {
    const ts = new Date().toLocaleString();
    await secureStorage.saveSecure('last_sign_in', ts);
    setUnlocked(true);   // <-- mark this session unlocked
    router.replace('/tabs');
};

const PIN_LENGTH = 6;
const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 30;

export default function SignInScreen() {
    const router = useRouter();
    const [walletExists, setWalletExists] = useState(false);
    const [biometricAvailable, setBiometricAvailable] = useState(false);
    const [biometricEnabled, setBiometricEnabled] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [showPINModal, setShowPINModal] = useState(false);
    const [lastSignIn, setLastSignIn] = useState(''); // e.g., Today at 9:30 AM

    const floatAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        init();
    }, []);

    const init = async () => {
        try {
            startFloatingAnimation();

            const exists = await secureStorage.isWalletInitialized();
            setWalletExists(exists);

            const enabled = await secureStorage.isBiometricEnabled();
            setBiometricEnabled(enabled);

            const hw = await LocalAuthentication.hasHardwareAsync();
            const enrolled = await LocalAuthentication.isEnrolledAsync();
            setBiometricAvailable(hw && enrolled);

            const ls = await secureStorage.getSecure('last_sign_in');
            if (ls) setLastSignIn(ls);
        } catch (e) {
            logger.error('Sign-in init failed: ' + e.message);
        }
    };

    const startFloatingAnimation = () => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(floatAnim, {
                    toValue: -8,
                    duration: 2000,
                    useNativeDriver: true,
                }),
                Animated.timing(floatAnim, {
                    toValue: 0,
                    duration: 2000,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    };

    // Actions
    const handlePINSignIn = async () => {
        if (!walletExists) {
            Alert.alert('No Wallet', 'Please create or import a wallet first.');
            return;
        }
        const pinHash = await secureStorage.getPINHash();
        if (!pinHash) {
            Alert.alert('Set PIN', 'No PIN found. Please set up your PIN first.');
            router.push('/onboarding/pin-setup');
            return;
        }
        setShowPINModal(true);
    };

    const handleRecoveryPhrase = () => {
        router.push('/onboarding/recovery-phrase-entry');
        
    };

    const handleCreateWallet = () => {
        router.push('/onboarding/onboarding');
    };

    const handleImportWallet = () => {
        setShowImportModal(true);
    };

    const handleImportMethod = (method) => {
        setShowImportModal(false);

        switch (method) {
            case 'phrase':
                router.push('/onboarding/recovery-phrase-entry');
                break;
            case 'file':
                Alert.alert('Import from File', 'Backup file import coming soon.');
                break;
            case 'qr':
                router.push('/tabs/scan');
                break;
        }
    };

    const handleBiometricSignIn = async () => {
        if (!walletExists) {
            Alert.alert('No Wallet', 'Please create or import a wallet first.');
            return;
        }
        if (!biometricAvailable || !biometricEnabled) {
            Alert.alert('Unavailable', 'Biometric is not available or not enabled on this device.');
            return;
        }
        try {
            const result = await LocalAuthentication.authenticateAsync({
                promptMessage: 'Authenticate to access wallet',
                fallbackLabel: 'Use PIN',
                cancelLabel: 'Cancel',
            });
            if (result.success) {
                await onSuccessfulAuth('Biometric');
            } else {
                Alert.alert('Authentication Failed', 'Please try again or use PIN.');
            }
        } catch (e) {
            Alert.alert('Error', e.message || 'Biometric auth failed.');
        }
    };

    const onSuccessfulAuth = async (method = 'PIN') => {
        const ts = new Date().toLocaleString();
        await secureStorage.saveSecure('last_sign_in', ts);
        setLastSignIn(ts);
        logger.success(`✅ Signed in via ${method}`);
        router.replace('/tabs');
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <LinearGradient
                    colors={['#06B6D4', '#8B5CF6']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.topSection}
                >
                    <Animated.View
                        style={[
                            styles.logoContainer,
                            { transform: [{ translateY: floatAnim }] },
                        ]}
                    >
                        <View style={styles.logoBackground}>
                            <Shield color="#FFFFFF" size={64} strokeWidth={2.5} />
                        </View>
                    </Animated.View>

                    <Text style={styles.appName}>CredentialWallet</Text>
                    <Text style={styles.tagline}>Your Identity. Your Control.</Text>
                </LinearGradient>

                <View style={styles.bottomSection}>
                    <View style={styles.welcomeSection}>
                        <Text style={styles.welcomeText}>Welcome back!</Text>
                        <Text style={styles.lastSignInText}>
                            {lastSignIn ? `Last sign in: ${lastSignIn}` : 'Sign in to continue'}
                        </Text>
                    </View>

                    <View style={styles.signInMethods}>
                        <TouchableOpacity
                            style={styles.pinButton}
                            onPress={handlePINSignIn}
                            activeOpacity={0.7}
                        >
                            <Lock color="#FFFFFF" size={24} />
                            <Text style={styles.pinText}>Sign In with PIN</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={handleRecoveryPhrase}
                            style={styles.recoveryLink}
                        >
                            <Text style={styles.recoveryLinkText}>
                                Sign In with Recovery Phrase
                            </Text>
                        </TouchableOpacity>

                        <View style={styles.divider}>
                            <View style={styles.dividerLine} />
                            <Text style={styles.dividerText}>or</Text>
                            <View style={styles.dividerLine} />
                        </View>
                    </View>

                    <View style={styles.newUserSection}>
                        <Text style={styles.newUserTitle}>
                            {walletExists ? 'Create Another Wallet?' : 'New to CredentialWallet?'}
                        </Text>

                        <TouchableOpacity
                            style={styles.createButton}
                            onPress={handleCreateWallet}
                            activeOpacity={0.8}
                        >
                            <LinearGradient
                                colors={['#8B5CF6', '#7C3AED']}
                                style={styles.createGradient}
                            >
                                <PlusCircle color="#FFFFFF" size={24} />
                                <Text style={styles.createText}>Create New Wallet</Text>
                            </LinearGradient>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.importButton}
                            onPress={handleImportWallet}
                        >
                            <Download color="#94A3B8" size={20} />
                            <Text style={styles.importText}>Import Existing Wallet</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.quickActions}>
                        <TouchableOpacity
                            style={styles.quickAction}
                            onPress={() => Alert.alert('Help', 'Help center would open here')}
                        >
                            <HelpCircle color="#64748B" size={16} />
                            <Text style={styles.quickActionText}>Help</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.quickAction}
                            onPress={() => Alert.alert('About', 'About page would open here')}
                        >
                            <Info color="#64748B" size={16} />
                            <Text style={styles.quickActionText}>About</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>

            {/* Import Modal */}
            <Modal
                visible={showImportModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowImportModal(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowImportModal(false)}
                >
                    <View style={styles.importModalSheet}>
                        <View style={styles.dragHandle} />

                        <Text style={styles.modalTitle}>Import Wallet</Text>
                        <Text style={styles.modalSubtitle}>Choose how to import your wallet</Text>

                        <View style={styles.importOptions}>
                            <TouchableOpacity
                                style={styles.importOption}
                                onPress={() => handleImportMethod('phrase')}
                            >
                                <View style={[styles.importIconContainer, { backgroundColor: '#F3E8FF' }]}>
                                    <Key color="#8B5CF6" size={32} />
                                </View>
                                <View style={styles.importOptionContent}>
                                    <Text style={styles.importOptionTitle}>12-Word Recovery Phrase</Text>
                                    <Text style={styles.importOptionDescription}>
                                        Restore from mnemonic
                                    </Text>
                                </View>
                                <ChevronRight color="#64748B" size={20} />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.importOption}
                                onPress={() => handleImportMethod('file')}
                            >
                                <View style={[styles.importIconContainer, { backgroundColor: '#DBEAFE' }]}>
                                    <FileText color="#3B82F6" size={32} />
                                </View>
                                <View style={styles.importOptionContent}>
                                    <Text style={styles.importOptionTitle}>Backup File</Text>
                                    <Text style={styles.importOptionDescription}>
                                        Import .wcbak file
                                    </Text>
                                </View>
                                <ChevronRight color="#64748B" size={20} />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.importOption}
                                onPress={() => handleImportMethod('qr')}
                            >
                                <View style={[styles.importIconContainer, { backgroundColor: '#D1FAE5' }]}>
                                    <QrCode color="#10B981" size={32} />
                                </View>
                                <View style={styles.importOptionContent}>
                                    <Text style={styles.importOptionTitle}>QR Code</Text>
                                    <Text style={styles.importOptionDescription}>
                                        Scan backup QR codes
                                    </Text>
                                </View>
                                <ChevronRight color="#64748B" size={20} />
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            style={styles.cancelButton}
                            onPress={() => setShowImportModal(false)}
                        >
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* PIN Sign-in Modal */}
            <PINModal
                visible={showPINModal}
                onClose={() => setShowPINModal(false)}
                onSuccess={() => onSuccessfulAuth('PIN')}
                biometricAvailable={biometricAvailable && biometricEnabled}
                onBiometric={handleBiometricSignIn}
            />
        </SafeAreaView>
    );
}

function PINModal({ visible, onClose, onSuccess, biometricAvailable, onBiometric }) {
    const [pin, setPin] = useState('');
    const [attempts, setAttempts] = useState(0);
    const [isLocked, setIsLocked] = useState(false);
    const [lockoutTimer, setLockoutTimer] = useState(0);
    const [error, setError] = useState('');
    const shakeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (lockoutTimer > 0) {
            const t = setTimeout(() => setLockoutTimer((s) => s - 1), 1000);
            return () => clearTimeout(t);
        } else if (lockoutTimer === 0 && isLocked) {
            setIsLocked(false);
            setAttempts(0);
            setError('');
        }
    }, [lockoutTimer, isLocked]);

    useEffect(() => {
        if (!visible) resetState();
    }, [visible]);

    const resetState = () => {
        setPin('');
        setAttempts(0);
        setIsLocked(false);
        setLockoutTimer(0);
        setError('');
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

    const handleNumberPress = async (num) => {
        if (isLocked) return;
        triggerHaptic();

        if (pin.length < PIN_LENGTH) {
            const newPin = pin + num;
            setPin(newPin);
            setError('');

            if (newPin.length === PIN_LENGTH) {
                setTimeout(() => verifyPin(newPin), 120);
            }
        }
    };

    const handleDelete = () => {
        if (isLocked) return;
        triggerHaptic();
        setPin((p) => p.slice(0, -1));
        setError('');
    };

    const verifyPin = async (pinToVerify) => {
        try {
            const pinHash = await secureStorage.getPINHash();

            if (!pinHash) {
                Alert.alert('No PIN Found', 'Please set up your PIN first.', [
                    { text: 'OK', onPress: () => onClose() },
                ]);
                return;
            }

            const ok = await verifyPIN(pinToVerify, pinHash);
            if (ok) {
                if (Platform.OS !== 'web') {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }
                onClose();
                onSuccess();
            } else {
                const newAttempts = attempts + 1;
                setAttempts(newAttempts);

                if (Platform.OS !== 'web') {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                }

                shakeAnimation();
                setPin('');

                if (newAttempts >= MAX_ATTEMPTS) {
                    setIsLocked(true);
                    setLockoutTimer(LOCKOUT_SECONDS);
                    setError(`Too many failed attempts. Try again in ${LOCKOUT_SECONDS}s.`);
                } else {
                    const remaining = MAX_ATTEMPTS - newAttempts;
                    setError(`Incorrect PIN. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`);
                }
            }
        } catch (e) {
            logger.error('PIN verify error: ' + e.message);
            Alert.alert('Error', 'Failed to verify PIN. Please try again.');
        }
    };

    const renderPinDots = () => {
        return (
            <Animated.View style={[styles.pinDotsContainer, { transform: [{ translateX: shakeAnim }] }]}>
                {Array.from({ length: PIN_LENGTH }).map((_, idx) => (
                    <View
                        key={idx}
                        style={[
                            styles.pinDot,
                            pin.length > idx ? styles.pinDotFilled : styles.pinDotEmpty,
                            error && styles.pinDotError,
                        ]}
                    >
                        {pin.length > idx && <View style={styles.pinDotInner} />}
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
                {numbers.map((row, r) => (
                    <View key={r} style={styles.numberPadRow}>
                        {row.map((item, c) => {
                            if (item === '') return <View key={c} style={styles.numberButton} />;
                            if (item === 'delete') {
                                return (
                                    <TouchableOpacity key={c} style={[styles.numberButton]} onPress={handleDelete} activeOpacity={0.6}>
                                        <DeleteIcon color="#94A3B8" size={28} />
                                    </TouchableOpacity>
                                );
                            }
                            return (
                                <TouchableOpacity
                                    key={c}
                                    style={[styles.numberButton, styles.numberButtonFilled]}
                                    onPress={() => handleNumberPress(item)}
                                    activeOpacity={0.6}
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

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
            <SafeAreaView style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                        <X color="#E2E8F0" size={24} />
                    </TouchableOpacity>
                </View>

                <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>Enter PIN</Text>
                    <Text style={styles.modalSubtitle}>
                        {isLocked ? `Try again in ${lockoutTimer}s` : 'Enter your 6-digit PIN'}
                    </Text>

                    {renderPinDots()}

                    {!!error && <Text style={styles.errorText}>{error}</Text>}

                    {biometricAvailable && !isLocked && (
                        <TouchableOpacity style={styles.biometricInline} onPress={onBiometric}>
                            <Fingerprint color="#06B6D4" size={22} />
                            <Text style={styles.biometricInlineText}>Use Biometric</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {renderNumberPad()}

                <View style={styles.modalFooter}>
                    <TouchableOpacity
                        onPress={() => {
                            onClose();
                            Alert.alert(
                                'Forgot PIN?',
                                'You can recover your wallet using your 12-word recovery phrase.',
                                [
                                    { text: 'Cancel', style: 'cancel' },
                                    { text: 'Use Recovery Phrase', onPress: () => router.push('/onboarding/recovery-phrase-entry') },
                                ]
                            );
                        }}
                    >
                        <Text style={styles.forgotPinText}>Forgot PIN?</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0F172A' },
    scrollView: { flex: 1 },
    scrollContent: { flexGrow: 1 },
    topSection: { height: '50%', justifyContent: 'center', alignItems: 'center', paddingTop: 40 },
    logoContainer: { marginBottom: 24 },
    logoBackground: {
        width: 120,
        height: 120,
        borderRadius: 30,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#FFFFFF',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 24,
        elevation: 10,
    },
    appName: { fontSize: 32, fontWeight: 'bold', color: '#FFFFFF', letterSpacing: -0.5, marginBottom: 8 },
    tagline: { fontSize: 16, color: 'rgba(255, 255, 255, 0.8)' },
    bottomSection: {
        flex: 1, backgroundColor: '#0F172A', borderTopLeftRadius: 32, borderTopRightRadius: 32,
        paddingHorizontal: 32, paddingTop: 32, paddingBottom: 24, marginTop: -32,
    },
    welcomeSection: { marginBottom: 24 },
    welcomeText: { fontSize: 24, fontWeight: 'bold', color: '#F1F5F9', marginBottom: 8 },
    lastSignInText: { fontSize: 14, color: '#94A3B8' },
    signInMethods: { marginBottom: 24 },
    pinButton: {
        height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
        backgroundColor: '#1E293B', borderWidth: 2, borderColor: '#334155', borderRadius: 12, marginBottom: 16,
    },
    pinText: { fontSize: 16, fontWeight: '600', color: '#F1F5F9' },
    recoveryLink: { alignItems: 'center', paddingVertical: 12 },
    recoveryLinkText: { fontSize: 15, fontWeight: '500', color: '#06B6D4' },
    divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 32 },
    dividerLine: { flex: 1, height: 1, backgroundColor: '#334155' },
    dividerText: { fontSize: 14, color: '#64748B', paddingHorizontal: 16 },
    newUserSection: { marginBottom: 32 },
    newUserTitle: { fontSize: 16, fontWeight: '600', color: '#F1F5F9', marginBottom: 16, textAlign: 'center' },
    createButton: {
        height: 56, borderRadius: 12, overflow: 'hidden', marginBottom: 16,
        shadowColor: '#8B5CF6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4,
    },
    createGradient: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
    createText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
    importButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12 },
    importText: { fontSize: 14, fontWeight: '500', color: '#94A3B8' },
    quickActions: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 16, borderTopWidth: 1, borderTopColor: '#334155' },
    quickAction: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 16 },
    quickActionText: { fontSize: 14, color: '#64748B' },

    // Import Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.75)', justifyContent: 'flex-end' },
    importModalSheet: {
        backgroundColor: '#1E293B', borderTopLeftRadius: 24, borderTopRightRadius: 24,
        paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 40 : 24, paddingHorizontal: 24,
    },
    dragHandle: { width: 40, height: 4, backgroundColor: '#334155', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 24, fontWeight: 'bold', color: '#F1F5F9', textAlign: 'center', marginBottom: 8 },
    modalSubtitle: { fontSize: 14, color: '#94A3B8', textAlign: 'center', marginBottom: 24 },
    importOptions: { gap: 12, marginBottom: 24 },
    importOption: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#0F172A', borderWidth: 1,
        borderColor: '#334155', borderRadius: 12, padding: 16, gap: 16,
    },
    importIconContainer: { width: 56, height: 56, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    importOptionContent: { flex: 1 },
    importOptionTitle: { fontSize: 16, fontWeight: '600', color: '#F1F5F9', marginBottom: 4 },
    importOptionDescription: { fontSize: 14, color: '#94A3B8' },
    cancelButton: {
        height: 52, justifyContent: 'center', alignItems: 'center', borderWidth: 2,
        borderColor: '#334155', borderRadius: 12,
    },
    cancelButtonText: { fontSize: 16, fontWeight: '600', color: '#94A3B8' },

    // PIN Modal
    modalContainer: { flex: 1, backgroundColor: '#0F172A' },
    modalHeader: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, paddingVertical: 12 },
    closeBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
    modalContent: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
    modalTitle: { fontSize: 28, fontWeight: 'bold', color: '#F1F5F9', marginBottom: 8 },
    modalSubtitle: { fontSize: 16, color: '#94A3B8', marginBottom: 24 },
    pinDotsContainer: { flexDirection: 'row', gap: 12, marginBottom: 16 },
    pinDot: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
    pinDotEmpty: { borderWidth: 2, borderColor: '#334155', backgroundColor: 'transparent' },
    pinDotFilled: { backgroundColor: '#06B6D4', borderWidth: 2, borderColor: '#06B6D4' },
    pinDotError: { borderColor: '#EF4444' },
    pinDotInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#FFFFFF' },
    errorText: { fontSize: 14, color: '#EF4444', textAlign: 'center', marginTop: 8 },
    biometricInline: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
    biometricInlineText: { fontSize: 16, fontWeight: '500', color: '#06B6D4' },
    numberPad: { paddingHorizontal: 32, paddingBottom: 16 },
    numberPadRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    numberButton: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center' },
    numberButtonFilled: { backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155' },
    numberText: { fontSize: 28, fontWeight: '600', color: '#F1F5F9' },
    forgotPinText: { fontSize: 14, color: '#94A3B8', textAlign: 'center' },
    modalFooter: { alignItems: 'center', paddingBottom: 24, paddingTop: 8 },
});