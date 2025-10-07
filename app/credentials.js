// app/credentials.js
// Modern Wallet-Style Credentials Screen

import { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    Dimensions,
    StatusBar
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as secureStorage from '../services/secureStorage';
import { vcAPI } from '../services/api';
import logger from '../utils/logger';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';

// import { useFocusEffect } from 'expo-router';



const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 40;

export default function CredentialsScreen() {
    const [credentials, setCredentials] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedCard, setSelectedCard] = useState(null);

    useFocusEffect(
        useCallback(() => {
            loadCredentials();
        }, [])
    );

    const loadCredentials = async () => {
        try {
            setIsLoading(true);
            const stored = await secureStorage.getCredentials();
            setCredentials(stored);
            logger.info(`Loaded ${stored.length} credentials`);
        } catch (error) {
            logger.error('Failed to load credentials');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadCredentials();
    }, []);

    const handleDelete = (credentialId) => {
        Alert.alert(
            'Remove Card',
            'Remove this credential from your wallet?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        await secureStorage.deleteCredential(credentialId);
                        await loadCredentials();
                    },
                },
            ]
        );
    };

    const getCardGradient = (index) => {
        const gradients = [
            ['#667eea', '#764ba2'],
            ['#f093fb', '#f5576c'],
            ['#4facfe', '#00f2fe'],
            ['#43e97b', '#38f9d7'],
            ['#fa709a', '#fee140'],
            ['#30cfd0', '#330867'],
        ];
        return gradients[index % gradients.length];
    };

    const renderCredentialCard = (credential, index) => {
        const gradient = getCardGradient(index);
        const isSelected = selectedCard === credential.id;

        return (
            <TouchableOpacity
                key={credential.id}
                activeOpacity={0.9}
                onPress={() => setSelectedCard(isSelected ? null : credential.id)}
                style={[styles.cardContainer, isSelected && styles.cardSelected]}
            >
                <LinearGradient
                    colors={gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.card}
                >
                    {/* Card Header */}
                    <View style={styles.cardHeader}>
                        <View style={styles.cardChip} />
                        <TouchableOpacity
                            onPress={() => handleDelete(credential.id)}
                            style={styles.deleteIcon}
                        >
                            <Text style={styles.deleteIconText}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Card Content */}
                    <View style={styles.cardBody}>
                        <Text style={styles.cardTitle}>Verifiable Credential</Text>

                        {/* Main Claim Display */}
                        {credential.data && Object.keys(credential.data).length > 0 && (
                            <View style={styles.mainClaim}>
                                <Text style={styles.mainClaimLabel}>
                                    {Object.keys(credential.data)[0]}
                                </Text>
                                <Text style={styles.mainClaimValue}>
                                    {String(Object.values(credential.data)[0])}
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Card Footer */}
                    <View style={styles.cardFooter}>
                        <View>
                            <Text style={styles.footerLabel}>ISSUED BY</Text>
                            <Text style={styles.footerValue} numberOfLines={1}>
                                {credential.issuer?.slice(0, 20)}...
                            </Text>
                        </View>
                        <View style={styles.cardLogo}>
                            <Text style={styles.cardLogoText}>VC</Text>
                        </View>
                    </View>

                    {/* Expanded Details */}
                    {isSelected && (
                        <View style={styles.expandedDetails}>
                            <View style={styles.detailsDivider} />

                            <Text style={styles.detailsTitle}>Credential Details</Text>

                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Subject:</Text>
                                <Text style={styles.detailValue} numberOfLines={1}>
                                    {credential.subject}
                                </Text>
                            </View>

                            {credential.data && Object.entries(credential.data).map(([key, value]) => (
                                <View key={key} style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>{key}:</Text>
                                    <Text style={styles.detailValue}>{String(value)}</Text>
                                </View>
                            ))}

                            <Text style={styles.timestamp}>
                                Added: {new Date(credential.addedAt).toLocaleDateString()}
                            </Text>
                        </View>
                    )}
                </LinearGradient>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            {/* Wallet Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>My Wallet</Text>
                <View style={styles.cardCount}>
                    <Text style={styles.cardCountText}>{credentials.length}</Text>
                </View>
            </View>

            {/* Cards ScrollView */}
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {isLoading ? (
                    <View style={styles.loadingContainer}>
                        <Text style={styles.loadingText}>Opening wallet...</Text>
                    </View>
                ) : credentials.length === 0 ? (
                    <View style={styles.emptyWallet}>
                        <Text style={styles.emptyWalletIcon}>💳</Text>
                        <Text style={styles.emptyTitle}>Wallet is Empty</Text>
                        <Text style={styles.emptySubtitle}>
                            You don't have any credentials yet{'\n'}
                            Issue your first credential to get started
                        </Text>
                    </View>
                ) : (
                    credentials.map((credential, index) =>
                        renderCredentialCard(credential, index)
                    )
                )}

                <View style={styles.bottomPadding} />
            </ScrollView>

            {/* Floating Action Button */}
            {credentials.length > 0 && (
                <TouchableOpacity
                    style={styles.fab}
                    onPress={loadCredentials}
                >
                    <Text style={styles.fabText}>⟳</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0a0f',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 20,
    },
    headerTitle: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#fff',
        letterSpacing: -0.5,
    },
    cardCount: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    cardCountText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
    },
    cardContainer: {
        width: CARD_WIDTH,
        marginBottom: 20,
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    cardSelected: {
        transform: [{ scale: 1.02 }],
    },
    card: {
        borderRadius: 20,
        padding: 24,
        minHeight: 200,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 20,
    },
    cardChip: {
        width: 50,
        height: 40,
        borderRadius: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
    },
    deleteIcon: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    deleteIconText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    cardBody: {
        flex: 1,
    },
    cardTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.8)',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 16,
    },
    mainClaim: {
        marginTop: 8,
    },
    mainClaimLabel: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.9)',
        marginBottom: 4,
        textTransform: 'capitalize',
    },
    mainClaimValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginTop: 20,
    },
    footerLabel: {
        fontSize: 10,
        color: 'rgba(255, 255, 255, 0.7)',
        marginBottom: 4,
        letterSpacing: 0.5,
    },
    footerValue: {
        fontSize: 12,
        color: '#fff',
        fontWeight: '600',
    },
    cardLogo: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardLogoText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#fff',
    },
    expandedDetails: {
        marginTop: 20,
    },
    detailsDivider: {
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        marginBottom: 16,
    },
    detailsTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 12,
    },
    detailRow: {
        marginBottom: 12,
    },
    detailLabel: {
        fontSize: 11,
        color: 'rgba(255, 255, 255, 0.7)',
        marginBottom: 4,
    },
    detailValue: {
        fontSize: 13,
        color: '#fff',
        fontWeight: '500',
    },
    timestamp: {
        fontSize: 11,
        color: 'rgba(255, 255, 255, 0.6)',
        marginTop: 12,
        fontStyle: 'italic',
    },
    loadingContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    loadingText: {
        fontSize: 16,
        color: '#888',
    },
    emptyWallet: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 80,
    },
    emptyWalletIcon: {
        fontSize: 64,
        marginBottom: 20,
    },
    emptyTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 12,
    },
    emptySubtitle: {
        fontSize: 16,
        color: '#888',
        textAlign: 'center',
        lineHeight: 24,
    },
    bottomPadding: {
        height: 100,
    },
    fab: {
        position: 'absolute',
        right: 20,
        bottom: 20,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#667eea',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#667eea',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 12,
        elevation: 8,
    },
    fabText: {
        fontSize: 28,
        color: '#fff',
    },
});