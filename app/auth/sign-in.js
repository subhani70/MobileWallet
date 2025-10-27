// app/auth/sign-in.js - Sign In Screen
import { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Animated,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Shield, PlusCircle } from 'lucide-react-native';
import * as secureStorage from '../../services/secureStorage';

export default function SignInScreen() {
    const router = useRouter();
    const [walletExists, setWalletExists] = useState(false);
    const floatAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        checkWalletExists();
        startFloatingAnimation();
    }, []);

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

    const checkWalletExists = async () => {
        try {
            const exists = await secureStorage.isWalletInitialized();
            setWalletExists(exists);
        } catch (error) {
            console.error('Error checking wallet:', error);
            setWalletExists(false);
        }
    };
    const handleCreateWallet = () => {
        // Navigate to onboarding (now at root level)
        router.push('/onboarding/onboarding');  
    };

    // Temporary for testing
    const handleSkipToHome = () => {
        Alert.alert(
            'Skip Setup',
            'This is for testing only. Create a wallet for full functionality.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Skip',
                    onPress: () => router.replace('/tabs'),
                },
            ]
        );
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
                    {walletExists ? (
                        <>
                            <View style={styles.welcomeSection}>
                                <Text style={styles.welcomeText}>Welcome back!</Text>
                                <Text style={styles.subtitle}>
                                    Sign in functionality coming soon...
                                </Text>
                            </View>

                            <TouchableOpacity
                                style={styles.tempButton}
                                onPress={handleSkipToHome}
                            >
                                <Text style={styles.tempButtonText}>Go to Home (Testing)</Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <>
                            <View style={styles.welcomeSection}>
                                <Text style={styles.welcomeText}>Welcome to CredentialWallet</Text>
                                <Text style={styles.subtitle}>
                                    Create your self-sovereign identity wallet to get started
                                </Text>
                            </View>

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

                            <Text style={styles.infoText}>
                                Import wallet and other options coming soon
                            </Text>
                        </>
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
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
        flexGrow: 1,
    },
    topSection: {
        height: 400,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 40,
    },
    logoContainer: {
        marginBottom: 24,
    },
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
    appName: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#FFFFFF',
        letterSpacing: -0.5,
        marginBottom: 8,
    },
    tagline: {
        fontSize: 16,
        color: 'rgba(255, 255, 255, 0.8)',
    },
    bottomSection: {
        flex: 1,
        backgroundColor: '#0F172A',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        paddingHorizontal: 32,
        paddingTop: 32,
        paddingBottom: 24,
        marginTop: -32,
    },
    welcomeSection: {
        marginBottom: 32,
    },
    welcomeText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#F1F5F9',
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: '#94A3B8',
        textAlign: 'center',
        lineHeight: 24,
    },
    createButton: {
        height: 56,
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 16,
        shadowColor: '#8B5CF6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 4,
    },
    createGradient: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    createText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    infoText: {
        fontSize: 14,
        color: '#64748B',
        textAlign: 'center',
        marginTop: 20,
    },
    tempButton: {
        height: 56,
        backgroundColor: '#1E293B',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#334155',
    },
    tempButtonText: {
        fontSize: 16,
        color: '#94A3B8',
        fontWeight: '600',
    },
});