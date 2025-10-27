// app/did-creation.js - FULLY FUNCTIONAL DID CREATION
// app/onboarding/did-creation.js - FIXED IMPORTS
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
import {
    Key,
    CheckCircle2,
    Circle,
    Loader2,
    ChevronDown,
    Info,
    AlertTriangle,
} from 'lucide-react-native';

// FIXED IMPORTS - Need to go up two levels from app/onboarding/
import * as didManager from '../../services/didManager';
import * as secureStorage from '../../services/secureStorage';
import logger from '../../utils/logger';



const STEPS = [
    { text: 'Connecting to blockchain network', duration: 1000 },
    { text: 'Generating cryptographic keys', duration: 2000 },
    { text: 'Creating DID document', duration: 2000 },
    { text: 'Registering on blockchain', duration: 3000 },
    { text: 'Finalizing your identity', duration: 1000 },
];

export default function DIDCreationScreen() {
    const router = useRouter();
    const [currentStep, setCurrentStep] = useState(0);
    const [progress, setProgress] = useState(0);
    const [didInfoExpanded, setDidInfoExpanded] = useState(false);
    const [techInfoExpanded, setTechInfoExpanded] = useState(false);
    const [error, setError] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [createdDID, setCreatedDID] = useState(null);

    const progressAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        createDID();
    }, []);

    const createDID = async () => {
        try {
            setError(false);
            setErrorMessage('');

            // Step 1: Connecting to blockchain
            setCurrentStep(0);
            animateProgress(20);
            await new Promise(resolve => setTimeout(resolve, STEPS[0].duration));

            // Step 2: Generating keys
            setCurrentStep(1);
            animateProgress(40);
            await new Promise(resolve => setTimeout(resolve, 500));

            // Actually create the DID here
            logger.info('🔑 Creating DID...');
            const result = await didManager.createLocalDID();

            if (!result || !result.did) {
                throw new Error('Failed to create DID');
            }

            setCreatedDID(result.did);
            logger.success(`✅ DID Created: ${result.did}`);

            // Step 3: Creating DID document
            setCurrentStep(2);
            animateProgress(60);
            await new Promise(resolve => setTimeout(resolve, STEPS[2].duration));

            // Step 4: Registering on blockchain
            setCurrentStep(3);
            animateProgress(80);

            if (result.registered) {
                logger.success('✅ DID registered on blockchain');
            } else {
                logger.warning('⚠️ DID created locally but blockchain registration pending');
            }

            await new Promise(resolve => setTimeout(resolve, STEPS[3].duration));

            // Step 5: Finalizing
            setCurrentStep(4);
            animateProgress(100);
            await new Promise(resolve => setTimeout(resolve, STEPS[4].duration));

            // Mark onboarding as complete
            await secureStorage.saveSecure('ssi_onboarding_completed', 'true');

            // Navigate to success or home
            await new Promise(resolve => setTimeout(resolve, 500));
            router.replace('/onboarding/did-success');

        } catch (err) {
            logger.error('DID creation failed: ' + err.message);
            setError(true);
            setErrorMessage(err.message || 'Unable to create digital identity');

            Alert.alert(
                'Creation Failed',
                err.message || 'Unable to create your digital identity. Please try again.',
                [
                    { text: 'Try Again', onPress: handleRetry },
                    { text: 'Continue Offline', onPress: () => router.replace('/tabs') }
                ]
            );
        }
    };

    const animateProgress = (toValue) => {
        Animated.timing(progressAnim, {
            toValue,
            duration: 500,
            easing: Easing.ease,
            useNativeDriver: false,
        }).start();
        setProgress(toValue);
    };

    const handleRetry = () => {
        setError(false);
        setCurrentStep(0);
        setProgress(0);
        progressAnim.setValue(0);
        createDID();
    };

    const progressWidth = progressAnim.interpolate({
        inputRange: [0, 100],
        outputRange: ['0%', '100%'],
    });

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.progressBarContainer}>
                    <View style={styles.progressBarBackground}>
                        <Animated.View
                            style={[
                                styles.progressBarFill,
                                { width: progressWidth },
                            ]}
                        >
                            <LinearGradient
                                colors={['#06B6D4', '#0891B2']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.progressGradient}
                            />
                        </Animated.View>
                    </View>
                    <Text style={styles.stepCounter}>
                        Step {Math.min(currentStep + 1, STEPS.length)} of {STEPS.length}
                    </Text>
                </View>

                <View style={styles.illustrationContainer}>
                    <BlockchainNetworkAnimation error={error} />
                </View>

                <Text style={styles.title}>
                    {error ? 'Connection Failed' : 'Creating Your Digital Identity'}
                </Text>
                <Text style={styles.subtitle}>
                    {error
                        ? errorMessage || 'Unable to connect to blockchain. Please check your internet connection.'
                        : 'Please wait while we set up your blockchain identity...'}
                </Text>

                {createdDID && !error && (
                    <View style={styles.didPreview}>
                        <Text style={styles.didLabel}>Your DID:</Text>
                        <Text style={styles.didValue} numberOfLines={1}>
                            {createdDID}
                        </Text>
                    </View>
                )}

                {error ? (
                    <View style={styles.errorActions}>
                        <TouchableOpacity
                            style={styles.retryButton}
                            onPress={handleRetry}
                        >
                            <Text style={styles.retryButtonText}>Try Again</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.offlineButton}
                            onPress={() => router.replace('/tabs')}
                        >
                            <Text style={styles.offlineButtonText}>Continue Offline</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <>
                        <View style={styles.stepsList}>
                            {STEPS.map((step, index) => (
                                <StepItem
                                    key={index}
                                    text={step.text}
                                    state={
                                        index < currentStep
                                            ? 'completed'
                                            : index === currentStep
                                                ? 'active'
                                                : 'pending'
                                    }
                                />
                            ))}
                        </View>

                        <CollapsibleCard
                            title="What is a DID?"
                            expanded={didInfoExpanded}
                            onToggle={() => setDidInfoExpanded(!didInfoExpanded)}
                        >
                            <Text style={styles.cardBody}>
                                A Decentralized Identifier (DID) is your unique identity on the
                                blockchain. Think of it as a digital passport that you fully
                                control.
                            </Text>
                            <View style={styles.benefitsList}>
                                <BenefitItem text="You own your identity" />
                                <BenefitItem text="No central authority can revoke it" />
                                <BenefitItem text="Cryptographically secure" />
                                <BenefitItem text="Works across all platforms" />
                            </View>
                        </CollapsibleCard>

                        <CollapsibleCard
                            title="Technical Details"
                            expanded={techInfoExpanded}
                            onToggle={() => setTechInfoExpanded(!techInfoExpanded)}
                        >
                            <View style={styles.techDetails}>
                                <TechDetailRow label="Network:" value="Private Ethereum" />
                                <TechDetailRow label="DID Method:" value="did:ethr" />
                                <TechDetailRow label="Key Algorithm:" value="secp256k1" />
                                <TechDetailRow label="Estimated time:" value="15-30 seconds" />
                            </View>
                        </CollapsibleCard>

                        <View style={styles.noteContainer}>
                            <AlertTriangle color="#6B7280" size={16} />
                            <Text style={styles.noteText}>
                                This process is secure and automatic. Do not close the app.
                            </Text>
                        </View>
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

// Keep all the component functions (BlockchainNetworkAnimation, StepItem, CollapsibleCard, BenefitItem, TechDetailRow) 
// exactly as they are in your original code...

function BlockchainNetworkAnimation({ error }) {
    const rotateAnim = useRef(new Animated.Value(0)).current;
    const keyRotateAnim = useRef(new Animated.Value(0)).current;
    const glowAnim = useRef(new Animated.Value(0)).current;
    const node1Anim = useRef(new Animated.Value(0)).current;
    const node2Anim = useRef(new Animated.Value(0)).current;
    const node3Anim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (!error) {
            Animated.loop(
                Animated.timing(rotateAnim, {
                    toValue: 1,
                    duration: 30000,
                    easing: Easing.linear,
                    useNativeDriver: true,
                })
            ).start();

            Animated.loop(
                Animated.timing(keyRotateAnim, {
                    toValue: 1,
                    duration: 10000,
                    easing: Easing.linear,
                    useNativeDriver: true,
                })
            ).start();

            Animated.loop(
                Animated.sequence([
                    Animated.timing(glowAnim, {
                        toValue: 1,
                        duration: 2000,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                    Animated.timing(glowAnim, {
                        toValue: 0,
                        duration: 2000,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                ])
            ).start();

            const createPulseAnimation = (anim, delay) => {
                return Animated.loop(
                    Animated.sequence([
                        Animated.delay(delay),
                        Animated.timing(anim, {
                            toValue: 1,
                            duration: 1500,
                            easing: Easing.inOut(Easing.ease),
                            useNativeDriver: true,
                        }),
                        Animated.timing(anim, {
                            toValue: 0,
                            duration: 1500,
                            easing: Easing.inOut(Easing.ease),
                            useNativeDriver: true,
                        }),
                    ])
                );
            };

            createPulseAnimation(node1Anim, 0).start();
            createPulseAnimation(node2Anim, 500).start();
            createPulseAnimation(node3Anim, 1000).start();
        }
    }, [error]);

    const rotation = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    const keyRotation = keyRotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    const glowOpacity = glowAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.4, 1],
    });

    const nodeScale1 = node1Anim.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 1.2],
    });

    const nodeScale2 = node2Anim.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 1.2],
    });

    const nodeScale3 = node3Anim.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 1.2],
    });

    const nodeColor = error ? '#EF4444' : '#06B6D4';

    return (
        <View style={styles.animationContainer}>
            <Animated.View
                style={[
                    styles.networkCircle,
                    { transform: [{ rotate: rotation }] },
                ]}
            >
                <Animated.View
                    style={[
                        styles.node,
                        styles.node1,
                        {
                            backgroundColor: nodeColor,
                            transform: [{ scale: nodeScale1 }],
                        },
                    ]}
                />
                <Animated.View
                    style={[
                        styles.node,
                        styles.node2,
                        {
                            backgroundColor: nodeColor,
                            transform: [{ scale: nodeScale2 }],
                        },
                    ]}
                />
                <Animated.View
                    style={[
                        styles.node,
                        styles.node3,
                        {
                            backgroundColor: nodeColor,
                            transform: [{ scale: nodeScale3 }],
                        },
                    ]}
                />
                <Animated.View
                    style={[
                        styles.node,
                        styles.node4,
                        { backgroundColor: nodeColor },
                    ]}
                />
                <Animated.View
                    style={[
                        styles.node,
                        styles.node5,
                        { backgroundColor: nodeColor },
                    ]}
                />
                <Animated.View
                    style={[
                        styles.node,
                        styles.node6,
                        { backgroundColor: nodeColor },
                    ]}
                />

                <View style={[styles.connectionLine, styles.line1]} />
                <View style={[styles.connectionLine, styles.line2]} />
                <View style={[styles.connectionLine, styles.line3]} />
                <View style={[styles.connectionLine, styles.line4]} />
                <View style={[styles.connectionLine, styles.line5]} />
                <View style={[styles.connectionLine, styles.line6]} />
            </Animated.View>

            <Animated.View
                style={[
                    styles.keyContainer,
                    {
                        transform: [{ rotate: keyRotation }],
                        opacity: glowOpacity,
                    },
                ]}
            >
                <View style={styles.keyBackground}>
                    <Key color="#FFFFFF" size={48} />
                </View>
            </Animated.View>
        </View>
    );
}

function StepItem({ text, state }) {
    const scaleAnim = useRef(new Animated.Value(0)).current;
    const spinAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (state === 'completed') {
            Animated.spring(scaleAnim, {
                toValue: 1,
                tension: 50,
                friction: 7,
                useNativeDriver: true,
            }).start();
        }

        if (state === 'active') {
            Animated.loop(
                Animated.timing(spinAnim, {
                    toValue: 1,
                    duration: 1000,
                    easing: Easing.linear,
                    useNativeDriver: true,
                })
            ).start();
        }
    }, [state]);

    const rotation = spinAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    return (
        <View style={styles.stepItem}>
            <View style={styles.stepIcon}>
                {state === 'completed' ? (
                    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                        <CheckCircle2 color="#10B981" size={24} />
                    </Animated.View>
                ) : state === 'active' ? (
                    <Animated.View style={{ transform: [{ rotate: rotation }] }}>
                        <Loader2 color="#06B6D4" size={24} />
                    </Animated.View>
                ) : (
                    <Circle color="#D1D5DB" size={24} />
                )}
            </View>
            <Text
                style={[
                    styles.stepText,
                    state === 'completed' && styles.stepTextCompleted,
                    state === 'active' && styles.stepTextActive,
                    state === 'pending' && styles.stepTextPending,
                ]}
            >
                {text}
            </Text>
        </View>
    );
}

function CollapsibleCard({ title, expanded, onToggle, children }) {
    const heightAnim = useRef(new Animated.Value(0)).current;
    const rotateAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(heightAnim, {
                toValue: expanded ? 1 : 0,
                duration: 300,
                easing: Easing.ease,
                useNativeDriver: false,
            }),
            Animated.timing(rotateAnim, {
                toValue: expanded ? 1 : 0,
                duration: 200,
                easing: Easing.ease,
                useNativeDriver: true,
            }),
        ]).start();
    }, [expanded]);

    const rotation = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '180deg'],
    });

    return (
        <View style={styles.collapsibleCard}>
            <TouchableOpacity
                style={styles.cardHeader}
                onPress={onToggle}
                activeOpacity={0.7}
            >
                <View style={styles.cardHeaderLeft}>
                    <Info color="#3B82F6" size={16} />
                    <Text style={styles.cardTitle}>{title}</Text>
                </View>
                <Animated.View style={{ transform: [{ rotate: rotation }] }}>
                    <ChevronDown color="#6B7280" size={20} />
                </Animated.View>
            </TouchableOpacity>
            {expanded && (
                <Animated.View style={[styles.cardContent, { opacity: heightAnim }]}>
                    {children}
                </Animated.View>
            )}
        </View>
    );
}

function BenefitItem({ text }) {
    return (
        <View style={styles.benefitItem}>
            <View style={styles.benefitDot} />
            <Text style={styles.benefitText}>{text}</Text>
        </View>
    );
}

function TechDetailRow({ label, value }) {
    return (
        <View style={styles.techDetailRow}>
            <Text style={styles.techDetailLabel}>{label}</Text>
            <Text style={styles.techDetailValue}>{value}</Text>
        </View>
    );
}

// Copy all the styles exactly from your original code
const styles = StyleSheet.create({
    // ... paste all your styles here exactly as they are
    container: {
        flex: 1,
        backgroundColor: '#0F172A',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 40,
    },
    progressBarContainer: {
        paddingHorizontal: 16,
        paddingTop: 8,
    },
    progressBarBackground: {
        height: 4,
        backgroundColor: '#334155',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 2,
    },
    progressGradient: {
        flex: 1,
    },
    stepCounter: {
        fontSize: 14,
        fontWeight: '500',
        color: '#94A3B8',
        textAlign: 'center',
        marginTop: 16,
    },
    illustrationContainer: {
        height: 360,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 24,
    },
    animationContainer: {
        width: 300,
        height: 300,
        justifyContent: 'center',
        alignItems: 'center',
    },
    networkCircle: {
        width: 280,
        height: 280,
        position: 'relative',
    },
    node: {
        position: 'absolute',
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#06B6D4',
        shadowColor: '#06B6D4',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 8,
        elevation: 4,
    },
    node1: {
        top: 0,
        left: 120,
    },
    node2: {
        top: 60,
        right: 20,
    },
    node3: {
        top: 180,
        right: 0,
    },
    node4: {
        bottom: 0,
        left: 120,
    },
    node5: {
        top: 180,
        left: 0,
    },
    node6: {
        top: 60,
        left: 20,
    },
    connectionLine: {
        position: 'absolute',
        height: 2,
        backgroundColor: '#06B6D4',
        opacity: 0.3,
    },
    line1: {
        width: 100,
        top: 80,
        left: 90,
        transform: [{ rotate: '30deg' }],
    },
    line2: {
        width: 120,
        top: 140,
        right: 40,
        transform: [{ rotate: '60deg' }],
    },
    line3: {
        width: 140,
        bottom: 100,
        left: 70,
    },
    line4: {
        width: 100,
        top: 80,
        right: 90,
        transform: [{ rotate: '-30deg' }],
    },
    line5: {
        width: 120,
        top: 140,
        left: 40,
        transform: [{ rotate: '-60deg' }],
    },
    line6: {
        width: 140,
        bottom: 100,
        right: 70,
    },
    keyContainer: {
        position: 'absolute',
    },
    keyBackground: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#06B6D4',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#06B6D4',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 20,
        elevation: 8,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#F1F5F9',
        textAlign: 'center',
        paddingHorizontal: 32,
        marginTop: 24,
    },
    subtitle: {
        fontSize: 16,
        color: '#94A3B8',
        textAlign: 'center',
        paddingHorizontal: 32,
        marginTop: 12,
        lineHeight: 24,
    },
    didPreview: {
        marginHorizontal: 32,
        marginTop: 16,
        padding: 12,
        backgroundColor: 'rgba(6, 182, 212, 0.1)',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(6, 182, 212, 0.3)',
    },
    didLabel: {
        fontSize: 12,
        color: '#94A3B8',
        marginBottom: 4,
    },
    didValue: {
        fontSize: 11,
        color: '#06B6D4',
        fontFamily: 'monospace',
    },
    stepsList: {
        paddingHorizontal: 32,
        marginTop: 32,
    },
    stepItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
    },
    stepIcon: {
        width: 24,
        height: 24,
        marginRight: 16,
    },
    stepText: {
        fontSize: 16,
        flex: 1,
    },
    stepTextCompleted: {
        color: '#F1F5F9',
        fontWeight: '500',
    },
    stepTextActive: {
        color: '#06B6D4',
        fontWeight: '600',
    },
    stepTextPending: {
        color: '#475569',
        fontWeight: '400',
    },
    collapsibleCard: {
        marginHorizontal: 16,
        marginTop: 16,
        backgroundColor: 'rgba(6, 182, 212, 0.1)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(6, 182, 212, 0.3)',
        overflow: 'hidden',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
    },
    cardHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#F1F5F9',
    },
    cardContent: {
        paddingHorizontal: 16,
        paddingBottom: 16,
    },
    cardBody: {
        fontSize: 14,
        color: '#CBD5E1',
        lineHeight: 22,
        marginBottom: 16,
    },
    benefitsList: {
        gap: 8,
    },
    benefitItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    benefitDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#06B6D4',
    },
    benefitText: {
        fontSize: 14,
        color: '#CBD5E1',
        flex: 1,
    },
    techDetails: {
        gap: 12,
    },
    techDetailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    techDetailLabel: {
        fontSize: 14,
        color: '#94A3B8',
    },
    techDetailValue: {
        fontSize: 14,
        color: '#F1F5F9',
        fontWeight: '500',
    },
    noteContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 32,
        paddingHorizontal: 32,
    },
    noteText: {
        fontSize: 12,
        color: '#64748B',
        textAlign: 'center',
        flex: 1,
    },
    errorActions: {
        paddingHorizontal: 32,
        marginTop: 32,
        gap: 12,
    },
    retryButton: {
        height: 52,
        borderRadius: 12,
        backgroundColor: '#DC2626',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#DC2626',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    retryButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    offlineButton: {
        height: 52,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#DC2626',
        justifyContent: 'center',
        alignItems: 'center',
    },
    offlineButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#DC2626',
    },
});