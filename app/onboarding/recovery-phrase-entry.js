// app/onboarding/recovery-phrase-entry.js
import { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ScrollView,
    Alert,
    Keyboard,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { X, Clipboard as ClipboardIcon, AlertTriangle } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';

import * as didManager from '../../services/didManager';
import * as secureStorage from '../../services/secureStorage';
import {
    validateMnemonic,
    formatMnemonic,
    getWordlist,
    getWordSuggestions,
} from '../../utils/mnemonicUtils';
import { hashPIN, checkPINStrength } from '../../utils/pinUtils';
import logger from '../../utils/logger';
// If you use a session guard to protect /tabs, uncomment:
// import { setUnlocked } from '../../utils/session';

const WORD_COUNT = 12;

export default function RecoveryPhraseEntryScreen() {
    const router = useRouter();
    const [words, setWords] = useState(Array(WORD_COUNT).fill(''));
    const [error, setError] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const [focusedIndex, setFocusedIndex] = useState(null);
    const [suggestions, setSuggestions] = useState([]);
    const [showPinModal, setShowPinModal] = useState(false);
    const inputRefs = useRef([]);

    useEffect(() => {
        // Prime the wordlist
        getWordlist();
    }, []);

    const handleWordChange = (index, text) => {
        const value = text.toLowerCase().trim();
        const next = [...words];
        next[index] = value;
        setWords(next);
        setError('');

        if (value && value.length >= 1) {
            const opts = getWordSuggestions(value) || [];
            setSuggestions(opts);
        } else {
            setSuggestions([]);
        }

        // If user types space at end, advance focus
        if (text.endsWith(' ') && value) {
            if (index < WORD_COUNT - 1) {
                inputRefs.current[index + 1]?.focus();
            } else {
                Keyboard.dismiss();
            }
        }
    };

    const handleSuggestionPress = (word) => {
        if (focusedIndex === null) return;
        const next = [...words];
        next[focusedIndex] = word;
        setWords(next);
        setSuggestions([]);

        if (focusedIndex < WORD_COUNT - 1) {
            inputRefs.current[focusedIndex + 1]?.focus();
        } else {
            Keyboard.dismiss();
        }
    };

    const handlePasteAll = async () => {
        try {
            const text = await Clipboard.getStringAsync();
            if (!text) {
                Alert.alert('Clipboard is empty');
                return;
            }
            const formatted = formatMnemonic(text);
            const arr = formatted.split(' ').filter(Boolean);
            if (arr.length !== WORD_COUNT) {
                Alert.alert('Invalid phrase', `Expected ${WORD_COUNT} words, got ${arr.length}`);
                return;
            }
            setWords(arr);
            setSuggestions([]);
            setError('');
            Keyboard.dismiss();
        } catch (err) {
            Alert.alert('Error', 'Failed to read from clipboard');
        }
    };

    const validateFields = () => {
        const wordlist = getWordlist();
        // Validate each word
        for (let i = 0; i < words.length; i++) {
            const w = words[i];
            if (!w) {
                setError(`Please enter word ${i + 1}`);
                return false;
            }
            if (!wordlist.includes(w)) {
                setError(`Word ${i + 1} ("${w}") is not a valid BIP-39 word`);
                return false;
            }
        }
        // Validate full mnemonic checksum
        const phrase = words.join(' ');
        if (!validateMnemonic(phrase)) {
            setError('Invalid recovery phrase. Please check your words and try again.');
            return false;
        }
        return true;
    };

    const handleVerifyAndSignIn = async () => {
        Keyboard.dismiss();
        if (!validateFields()) return;

        // Ask user to create a 6-digit PIN before restoring
        setShowPinModal(true);
    };

    const handlePinComplete = async (pin) => {
        try {
            setIsVerifying(true);
            const phrase = words.join(' ');

            // Restore wallet from mnemonic (this stores keys, address, did, mnemonic, pin hash)
            await didManager.restoreFromMnemonic(phrase, pin);

            await secureStorage.saveSecure('recovery_phrase_verified', 'true');
            const ts = new Date().toLocaleString();
            await secureStorage.saveSecure('last_sign_in', ts);

            // If you have a tabs guard with session memory, uncomment:
            // setUnlocked(true);

            logger.success('✅ Wallet restored successfully');
            setIsVerifying(false);
            setShowPinModal(false);

            router.replace('/tabs');
        } catch (e) {
            setIsVerifying(false);
            setShowPinModal(false);
            logger.error('Restore failed: ' + e.message);
            Alert.alert('Restore Failed', e.message || 'Unable to restore wallet. Please try again.');
        }
    };

    const isFormValid = words.every((w) => w && w.trim().length > 0);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
                    <X color="#E2E8F0" size={24} />
                </TouchableOpacity>
                <Text style={styles.progressText}>Recover Wallet</Text>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.testBanner}>
                    <Text style={styles.testBannerText}>🔑 Test phrase: abandon (x11) about</Text>
                </View>

                <View style={styles.titleSection}>
                    <Text style={styles.title}>Enter Recovery Phrase</Text>
                    <Text style={styles.subtitle}>
                        Enter your 12-word recovery phrase in order
                    </Text>
                </View>

                <TouchableOpacity style={styles.pasteButton} onPress={handlePasteAll}>
                    <ClipboardIcon color="#06B6D4" size={20} />
                    <Text style={styles.pasteButtonText}>Paste All Words</Text>
                </TouchableOpacity>

                <View style={styles.wordsGrid}>
                    {words.map((word, index) => (
                        <View key={index} style={styles.wordInputContainer}>
                            <Text style={styles.wordNumber}>{index + 1}.</Text>
                            <TextInput
                                ref={(ref) => (inputRefs.current[index] = ref)}
                                style={styles.wordInput}
                                value={word}
                                onFocus={() => {
                                    setFocusedIndex(index);
                                    if (word && word.length >= 1) {
                                        setSuggestions(getWordSuggestions(word) || []);
                                    } else {
                                        setSuggestions([]);
                                    }
                                }}
                                onBlur={() => {
                                    setTimeout(() => {
                                        setSuggestions([]);
                                        setFocusedIndex(null);
                                    }, 100);
                                }}
                                onChangeText={(text) => handleWordChange(index, text)}
                                placeholder="word"
                                placeholderTextColor="#64748B"
                                autoCapitalize="none"
                                autoCorrect={false}
                                returnKeyType={index === WORD_COUNT - 1 ? 'done' : 'next'}
                                onSubmitEditing={() => {
                                    if (index < WORD_COUNT - 1) {
                                        inputRefs.current[index + 1]?.focus();
                                    } else {
                                        Keyboard.dismiss();
                                    }
                                }}
                                blurOnSubmit={index === WORD_COUNT - 1}
                            />
                        </View>
                    ))}
                </View>

                {focusedIndex !== null && suggestions.length > 0 && (
                    <View style={styles.suggestionsContainer}>
                        <Text style={styles.suggestionsLabel}>Suggestions</Text>
                        <View style={styles.suggestionsRow}>
                            {suggestions.map((s, idx) => (
                                <TouchableOpacity
                                    key={`${s}-${idx}`}
                                    style={styles.suggestionPill}
                                    onPress={() => handleSuggestionPress(s)}
                                >
                                    <Text style={styles.suggestionText}>{s}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}

                {error && (
                    <View style={styles.errorContainer}>
                        <AlertTriangle color="#EF4444" size={20} />
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                )}

                <View style={styles.infoBox}>
                    <AlertTriangle color="#F59E0B" size={20} />
                    <Text style={styles.infoText}>
                        Make sure you enter all 12 words in the correct order. Recovery phrases are
                        case-insensitive.
                    </Text>
                </View>
            </ScrollView>

            <View style={styles.bottomActions}>
                <TouchableOpacity
                    style={[
                        styles.verifyButton,
                        (!isFormValid || isVerifying) && styles.verifyButtonDisabled,
                    ]}
                    onPress={handleVerifyAndSignIn}
                    disabled={!isFormValid || isVerifying}
                >
                    <Text style={styles.verifyButtonText}>
                        {isVerifying ? 'Restoring...' : 'Verify and Restore'}
                    </Text>
                </TouchableOpacity>
            </View>

            <PINCreateModal
                visible={showPinModal}
                onClose={() => setShowPinModal(false)}
                onComplete={handlePinComplete}
            />
        </SafeAreaView>
    );
}

function PINCreateModal({ visible, onClose, onComplete }) {
    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [step, setStep] = useState('create'); // 'create' | 'confirm'
    const [error, setError] = useState('');

    const handleNumberPress = (n) => {
        if (step === 'create') {
            if (pin.length < 6) {
                const next = pin + n;
                setPin(next);
                setError('');
                if (next.length === 6) {
                    const strength = checkPINStrength(next);
                    if (strength.isWeak) {
                        setError(strength.reason);
                        setTimeout(() => {
                            setPin('');
                            setError('');
                        }, 1200);
                        return;
                    }
                    setTimeout(() => setStep('confirm'), 250);
                }
            }
        } else {
            if (confirmPin.length < 6) {
                const next = confirmPin + n;
                setConfirmPin(next);
                setError('');
                if (next.length === 6) {
                    if (next !== pin) {
                        setError('PINs do not match');
                        setTimeout(() => {
                            setConfirmPin('');
                            setError('');
                        }, 1000);
                    } else {
                        onComplete(pin);
                        handleClose();
                    }
                }
            }
        }
    };

    const handleDelete = () => {
        if (step === 'create') {
            setPin(pin.slice(0, -1));
            setError('');
        } else {
            setConfirmPin(confirmPin.slice(0, -1));
            setError('');
        }
    };

    const handleClose = () => {
        setPin('');
        setConfirmPin('');
        setStep('create');
        setError('');
        onClose();
    };

    if (!visible) return null;

    return (
        <View style={styles.modalOverlayFull}>
            <View style={styles.pinModal}>
                <View style={styles.pinHeader}>
                    <Text style={styles.pinTitle}>
                        {step === 'create' ? 'Create 6-Digit PIN' : 'Confirm Your PIN'}
                    </Text>
                    <TouchableOpacity onPress={handleClose} style={styles.pinCloseBtn}>
                        <X color="#E2E8F0" size={20} />
                    </TouchableOpacity>
                </View>

                <Text style={styles.pinSubtitle}>
                    {step === 'create'
                        ? 'Choose a PIN to secure your wallet'
                        : 'Re-enter your PIN to confirm'}
                </Text>

                <View style={styles.pinDotsRow}>
                    {Array.from({ length: 6 }).map((_, i) => {
                        const filled = step === 'create' ? i < pin.length : i < confirmPin.length;
                        return (
                            <View key={i} style={[styles.pinDot, filled && styles.pinDotFilled]} />
                        );
                    })}
                </View>

                {!!error && (
                    <View style={styles.pinErrorBox}>
                        <AlertTriangle color="#EF4444" size={16} />
                        <Text style={styles.pinErrorText}>{error}</Text>
                    </View>
                )}

                <View style={styles.keypad}>
                    {[
                        ['1', '2', '3'],
                        ['4', '5', '6'],
                        ['7', '8', '9'],
                        ['', '0', 'del'],
                    ].map((row, r) => (
                        <View key={r} style={styles.keypadRow}>
                            {row.map((cell, c) => {
                                if (cell === '') return <View key={c} style={styles.key} />;
                                if (cell === 'del') {
                                    return (
                                        <TouchableOpacity key={c} style={styles.key} onPress={handleDelete}>
                                            <Text style={styles.keyDel}>⌫</Text>
                                        </TouchableOpacity>
                                    );
                                }
                                return (
                                    <TouchableOpacity key={c} style={styles.key} onPress={() => handleNumberPress(cell)}>
                                        <Text style={styles.keyText}>{cell}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    ))}
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0F172A' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 12,
    },
    closeButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
    progressText: { fontSize: 14, fontWeight: '500', color: '#94A3B8' },

    scrollView: { flex: 1 },
    scrollContent: { paddingHorizontal: 24, paddingBottom: 24 },

    testBanner: {
        backgroundColor: '#22C55E', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 16,
        marginBottom: 16, alignItems: 'center',
    },
    testBannerText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },

    titleSection: { marginBottom: 24 },
    title: { fontSize: 28, fontWeight: 'bold', color: '#F1F5F9', marginBottom: 8 },
    subtitle: { fontSize: 16, color: '#94A3B8', lineHeight: 24 },

    pasteButton: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        height: 48, backgroundColor: '#1E293B', borderWidth: 2, borderColor: '#06B6D4',
        borderRadius: 12, marginBottom: 24,
    },
    pasteButtonText: { fontSize: 16, fontWeight: '600', color: '#06B6D4' },

    wordsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
    wordInputContainer: {
        width: '47%', flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B',
        borderWidth: 1, borderColor: '#334155', borderRadius: 12, paddingHorizontal: 12, height: 56,
    },
    wordNumber: { fontSize: 14, fontWeight: '600', color: '#64748B', marginRight: 8, minWidth: 24 },
    wordInput: { flex: 1, fontSize: 16, color: '#F1F5F9', padding: 0 },

    suggestionsContainer: { marginTop: 8 },
    suggestionsLabel: { fontSize: 12, color: '#94A3B8', marginBottom: 6 },
    suggestionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    suggestionPill: {
        paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12,
        backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155',
    },
    suggestionText: { color: '#E2E8F0', fontSize: 13, fontWeight: '500' },

    errorContainer: {
        flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderWidth: 1, borderColor: '#EF4444', borderRadius: 12, padding: 16, marginBottom: 24,
    },
    errorText: { flex: 1, fontSize: 14, color: '#EF4444', lineHeight: 20 },

    infoBox: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: 'rgba(245, 158, 11, 0.1)',
        borderWidth: 1, borderColor: '#F59E0B', borderRadius: 12, padding: 16,
    },
    infoText: { flex: 1, fontSize: 14, color: '#F59E0B', lineHeight: 20 },

    bottomActions: {
        paddingHorizontal: 24, paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#334155',
    },
    verifyButton: {
        height: 56, backgroundColor: '#06B6D4', borderRadius: 12, justifyContent: 'center', alignItems: 'center',
        shadowColor: '#06B6D4', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4,
    },
    verifyButtonDisabled: { backgroundColor: '#334155', shadowOpacity: 0 },
    verifyButtonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },

    // PIN Modal
    modalOverlayFull: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    pinModal: {
        width: '100%', maxWidth: 420, backgroundColor: '#0F172A', borderRadius: 16,
        borderWidth: 1, borderColor: '#334155', padding: 16,
    },
    pinHeader: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#334155',
    },
    pinTitle: { fontSize: 18, fontWeight: 'bold', color: '#F1F5F9' },
    pinCloseBtn: { position: 'absolute', right: 4, top: 0, padding: 8 },
    pinSubtitle: { fontSize: 13, color: '#94A3B8', textAlign: 'center', marginTop: 12 },
    pinDotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginVertical: 18 },
    pinDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#334155' },
    pinDotFilled: { backgroundColor: '#06B6D4', borderColor: '#06B6D4' },
    pinErrorBox: {
        flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'center',
        backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: '#EF4444',
        borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
    },
    pinErrorText: { fontSize: 12, color: '#EF4444' },
    keypad: { marginTop: 8 },
    keypadRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    key: {
        width: 90, height: 52, borderRadius: 12, backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155',
        justifyContent: 'center', alignItems: 'center',
    },
    keyText: { fontSize: 18, color: '#F1F5F9', fontWeight: '600' },
    keyDel: { fontSize: 20, color: '#94A3B8' },
});