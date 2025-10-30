// app/index.js - Splash Screen
import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Shield } from 'lucide-react-native';

export default function SplashScreen() {
    const router = useRouter();
    const logoScale = useRef(new Animated.Value(0.8)).current;
    const logoOpacity = useRef(new Animated.Value(0)).current;
    const nameOpacity = useRef(new Animated.Value(0)).current;
    const taglineOpacity = useRef(new Animated.Value(0)).current;
    const spinnerOpacity = useRef(new Animated.Value(0)).current;
    const rotateValue = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        startAnimations();
        // Always go to Sign-In after splash, every reload
        const timer = setTimeout(() => {
            router.replace('/auth/sign-in');
        }, 2500);

        return () => clearTimeout(timer);
    }, []);

    const startAnimations = () => {
        Animated.parallel([
            Animated.timing(logoScale, {
                toValue: 1,
                duration: 500,
                easing: Easing.bezier(0.34, 1.56, 0.64, 1),
                useNativeDriver: true,
            }),
            Animated.timing(logoOpacity, {
                toValue: 1,
                duration: 500,
                useNativeDriver: true,
            }),
        ]).start();

        Animated.timing(nameOpacity, {
            toValue: 1,
            duration: 500,
            delay: 200,
            useNativeDriver: true,
        }).start();

        Animated.timing(taglineOpacity, {
            toValue: 1,
            duration: 500,
            delay: 400,
            useNativeDriver: true,
        }).start();

        Animated.timing(spinnerOpacity, {
            toValue: 1,
            duration: 300,
            delay: 800,
            useNativeDriver: true,
        }).start();

        Animated.loop(
            Animated.timing(rotateValue, {
                toValue: 1,
                duration: 1500,
                easing: Easing.linear,
                useNativeDriver: true,
            })
        ).start();
    };

    const rotation = rotateValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    return (
        <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.container}>
            <View style={styles.content}>
                <Animated.View
                    style={[
                        styles.logoContainer,
                        {
                            transform: [{ scale: logoScale }],
                            opacity: logoOpacity,
                        },
                    ]}
                >
                    <View style={styles.logoBackground}>
                        <Shield color="#FFFFFF" size={64} strokeWidth={2.5} />
                    </View>
                </Animated.View>

                <Animated.Text style={[styles.appName, { opacity: nameOpacity }]}>
                    CredentialWallet
                </Animated.Text>

                <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
                    Your Identity. Your Control.
                </Animated.Text>
            </View>

            <View style={styles.bottomContent}>
                <Animated.View
                    style={[
                        styles.spinnerContainer,
                        {
                            opacity: spinnerOpacity,
                            transform: [{ rotate: rotation }],
                        },
                    ]}
                >
                    <View style={styles.spinner} />
                </Animated.View>
                <Text style={styles.version}>Version 1.0.0</Text>
            </View>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    logoContainer: { marginBottom: 24 },
    logoBackground: {
        width: 120, height: 120, borderRadius: 30,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center', alignItems: 'center',
        shadowColor: '#FFFFFF', shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3, shadowRadius: 20, elevation: 10,
    },
    appName: { fontSize: 28, fontWeight: 'bold', color: '#FFFFFF', letterSpacing: 0.5, marginBottom: 12 },
    tagline: { fontSize: 16, color: 'rgba(255, 255, 255, 0.7)', letterSpacing: 0.3 },
    bottomContent: { alignItems: 'center', paddingBottom: 80 },
    spinnerContainer: { width: 24, height: 24, marginBottom: 8 },
    spinner: {
        width: 24, height: 24, borderRadius: 12, borderWidth: 3,
        borderColor: 'rgba(255, 255, 255, 0.3)', borderTopColor: '#FFFFFF',
    },
    version: { fontSize: 12, color: 'rgba(255, 255, 255, 0.5)', marginTop: 8 },
});