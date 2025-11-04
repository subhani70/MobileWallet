// app/credentials.js
// Production-Ready Credentials Screen - Fixed Hooks Error

import { useState, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    Dimensions,
    StatusBar,
    Animated,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import {
    FolderOpen,
    Plus,
    Shield,
    ChevronRight,
    Trash2,
    Copy,
    Share2,
    FileText,
    Download,
    RefreshCw,
} from 'lucide-react-native';

import * as secureStorage from '../../services/secureStorage';
import logger from '../../utils/logger';
import * as didManager from '../../services/didManager';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 32;
const CARD_HEIGHT = 200;

// Separate component for Credential Card to fix hooks issue
const CredentialCard = ({ credential, index, isSelected, onSelect, onDelete, onShare, fadeAnim }) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
        Animated.spring(scaleAnim, {
            toValue: 0.97,
            useNativeDriver: true,
        }).start();
    };

    const handlePressOut = () => {
        Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 3,
            useNativeDriver: true,
        }).start();
    };

    const getCardGradient = (index) => {
        const gradients = [
            ['#667eea', '#764ba2'],
            ['#06B6D4', '#0891B2'],
            ['#10B981', '#059669'],
            ['#F59E0B', '#D97706'],
            ['#EC4899', '#BE185D'],
            ['#8B5CF6', '#7C3AED'],
        ];
        return gradients[index % gradients.length];
    };

    const gradient = getCardGradient(index);
    
    // Extract credential data safely
    const credentialData = credential.data || {};
    const dataKeys = Object.keys(credentialData);
    const primaryKey = dataKeys[0];
    const primaryValue = credentialData[primaryKey];

    return (
        <Animated.View
            style={[
                styles.cardContainer,
                {
                    transform: [{ scale: scaleAnim }],
                    opacity: fadeAnim,
                }
            ]}
        >
            <TouchableOpacity
                activeOpacity={0.9}
                onPress={onSelect}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
            >
                <LinearGradient
                    colors={gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.card}
                >
                    {/* Card Header */}
                    <View style={styles.cardHeader}>
                        <View style={styles.cardIconContainer}>
                            <FileText color="#FFFFFF" size={24} />
                        </View>
                        <View style={styles.cardActions}>
                            <TouchableOpacity
                                style={styles.cardActionButton}
                                onPress={() => onShare(credential)}
                            >
                                <Share2 color="#FFFFFF" size={18} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.cardActionButton}
                                onPress={() => onDelete(credential)}
                            >
                                <Trash2 color="#FFFFFF" size={18} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Card Content */}
                    <View style={styles.cardBody}>
                        {primaryKey && (
                            <View>
                                <Text style={styles.cardLabel}>
                                    {primaryKey.replace(/_/g, ' ').toUpperCase()}
                                </Text>
                                <Text style={styles.cardValue} numberOfLines={2}>
                                    {String(primaryValue)}
                                </Text>
                            </View>
                        )}
                        {!primaryKey && (
                            <View>
                                <Text style={styles.cardLabel}>VERIFIABLE CREDENTIAL</Text>
                                <Text style={styles.cardValue}>Credential #{index + 1}</Text>
                            </View>
                        )}
                    </View>

                    {/* Card Footer */}
                    <View style={styles.cardFooter}>
                        <View style={styles.issuerInfo}>
                            <Text style={styles.issuerLabel}>ISSUED BY</Text>
                            <Text style={styles.issuerValue} numberOfLines={1}>
                                {credential.issuer ? 
                                    `${credential.issuer.slice(0, 25)}...` : 
                                    'Unknown Issuer'
                                }
                            </Text>
                        </View>
                        <View style={styles.verifiedBadge}>
                            <Shield color="#FFFFFF" size={16} />
                            <Text style={styles.verifiedText}>Verified</Text>
                        </View>
                    </View>

                    {/* Expanded Details */}
                    {isSelected && (
                        <Animated.View style={styles.expandedDetails}>
                            <View style={styles.divider} />
                            
                            <Text style={styles.detailsTitle}>Full Details</Text>
                            
                            {dataKeys.map((key) => (
                                <View key={key} style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>
                                        {key.replace(/_/g, ' ').toUpperCase()}:
                                    </Text>
                                    <Text style={styles.detailValue}>
                                        {String(credentialData[key])}
                                    </Text>
                                </View>
                            ))}
                            
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>SUBJECT DID:</Text>
                                <Text style={styles.detailValue} numberOfLines={2}>
                                    {credential.subject || 'Not specified'}
                                </Text>
                            </View>
                            
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>ISSUER DID:</Text>
                                <Text style={styles.detailValue} numberOfLines={2}>
                                    {credential.issuer || 'Not specified'}
                                </Text>
                            </View>
                            
                            <Text style={styles.timestamp}>
                                Added on {new Date(credential.addedAt).toLocaleString()}
                            </Text>
                        </Animated.View>
                    )}
                </LinearGradient>
            </TouchableOpacity>
        </Animated.View>
    );
};

export default function CredentialsScreen() {
    const router = useRouter();
    const [credentials, setCredentials] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedCard, setSelectedCard] = useState(null);
    const [walletInfo, setWalletInfo] = useState(null);
    
    // Animation values
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;

    // Reload data when screen comes into focus
    useFocusEffect(
        useCallback(() => {
            logger.info('Credentials screen focused - loading data...');
            loadData();
            animateIn();
            
            // Return cleanup function
            return () => {
                fadeAnim.setValue(0);
                slideAnim.setValue(30);
            };
        }, [])
    );

    const animateIn = () => {
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
    };

    const loadData = async () => {
        try {
            await Promise.all([loadWallet(), loadCredentials()]);
        } catch (error) {
            logger.error('Error loading data:', error);
        }
    };

    const loadWallet = async () => {
        try {
            const hasWallet = await didManager.hasWallet();
            if (hasWallet) {
                const info = await didManager.getWalletInfo();
                setWalletInfo(info);
                logger.info('Wallet loaded:', info?.did?.slice(0, 20) + '...');
            } else {
                setWalletInfo(null);
                logger.info('No wallet found');
            }
        } catch (error) {
            logger.error('Failed to load wallet info:', error);
            setWalletInfo(null);
        }
    };

    const loadCredentials = async () => {
        try {
            setIsLoading(true);
            
            // Get credentials from secure storage
            const stored = await secureStorage.getCredentials();
            
            // Ensure we have valid data
            if (stored && Array.isArray(stored)) {
                setCredentials(stored);
                logger.info(`Loaded ${stored.length} credential(s)`);
                
                // Log credential details for debugging
                stored.forEach((cred, index) => {
                    logger.info(`Credential ${index + 1}:`, {
                        id: cred.id,
                        issuer: cred.issuer?.slice(0, 20) + '...',
                        data: cred.data,
                        addedAt: cred.addedAt
                    });
                });
            } else {
                setCredentials([]);
                logger.info('No credentials found in storage');
            }
        } catch (error) {
            logger.error('Failed to load credentials:', error);
            setCredentials([]);
        } finally {
            setIsLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        logger.info('Manual refresh triggered');
        await loadData();
        setTimeout(() => setRefreshing(false), 1000);
    };

    const handleDelete = (credential) => {
        const credentialName = credential.data ? 
            Object.values(credential.data)[0] : 
            'this credential';
            
        Alert.alert(
            'Remove Credential',
            `Are you sure you want to remove "${credentialName}" from your wallet?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await secureStorage.deleteCredential(credential.id);
                            logger.info(`Deleted credential: ${credential.id}`);
                            await loadCredentials();
                        } catch (error) {
                            logger.error('Failed to delete credential:', error);
                            Alert.alert('Error', 'Failed to remove credential');
                        }
                    },
                },
            ]
        );
    };

    const handleShare = (credential) => {
        Alert.alert('Share Credential', 'Sharing feature coming soon!');
    };

    const handleImport = () => {
        Alert.alert(
            'Import Credential', 
            'You can import credentials by scanning QR codes.',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Scan QR', onPress: () => router.push('/scan') }
            ]
        );
    };

    const renderHeader = () => (
        <View style={styles.header}>
            <Animated.View 
                style={[
                    styles.headerContent,
                    {
                        opacity: fadeAnim,
                        transform: [{ translateY: slideAnim }]
                    }
                ]}
            >
                <View>
                    <Text style={styles.headerTitle}>My Credentials</Text>
                    <Text style={styles.headerSubtitle}>
                        {credentials.length} {credentials.length === 1 ? 'credential' : 'credentials'} stored
                    </Text>
                </View>
                <View style={styles.headerActions}>
                    <TouchableOpacity 
                        style={styles.headerButton} 
                        onPress={onRefresh}
                    >
                        <RefreshCw color="#94A3B8" size={20} />
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={styles.headerButton} 
                        onPress={handleImport}
                    >
                        <Plus color="#FFFFFF" size={24} />
                    </TouchableOpacity>
                </View>
            </Animated.View>
        </View>
    );

    const renderEmptyState = () => (
        <Animated.View 
            style={[
                styles.emptyContainer,
                {
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }]
                }
            ]}
        >
            <View style={styles.emptyIconContainer}>
                <FolderOpen color="#64748B" size={100} strokeWidth={1.5} />
            </View>
            <Text style={styles.emptyTitle}>No Credentials Yet</Text>
            <Text style={styles.emptySubtitle}>
                {walletInfo?.did 
                    ? "Your verified credentials will appear here when you receive them"
                    : "Create your identity first to start receiving credentials"
                }
            </Text>
            
            <TouchableOpacity 
                style={styles.primaryButton}
                onPress={() => walletInfo?.did ? handleImport() : router.push('/')}
            >
                <LinearGradient
                    colors={['#667eea', '#764ba2']}
                    style={styles.buttonGradient}
                >
                    <Text style={styles.primaryButtonText}>
                        {walletInfo?.did ? 'Import Credential' : 'Create Identity'}
                    </Text>
                </LinearGradient>
            </TouchableOpacity>
            
            {walletInfo?.did && (
                <TouchableOpacity 
                    style={styles.secondaryButton}
                    onPress={() => router.push('/scan')}
                >
                    <Download color="#667eea" size={20} />
                    <Text style={styles.secondaryButtonText}>Scan QR Code</Text>
                </TouchableOpacity>
            )}
        </Animated.View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" />
            
            {renderHeader()}
            
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor="#667eea"
                    />
                }
            >
                {isLoading ? (
                    <View style={styles.loadingContainer}>
                        <RefreshCw color="#667eea" size={32} />
                        <Text style={styles.loadingText}>Loading credentials...</Text>
                    </View>
                ) : credentials.length === 0 ? (
                    renderEmptyState()
                ) : (
                    <View style={styles.cardsContainer}>
                        {credentials.map((credential, index) => (
                            <CredentialCard
                                key={credential.id}
                                credential={credential}
                                index={index}
                                isSelected={selectedCard === credential.id}
                                onSelect={() => setSelectedCard(selectedCard === credential.id ? null : credential.id)}
                                onDelete={handleDelete}
                                onShare={handleShare}
                                fadeAnim={fadeAnim}
                            />
                        ))}
                    </View>
                )}
                
                <View style={styles.bottomPadding} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0F172A',
    },
    header: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 16,
    },
    headerContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#F1F5F9',
        letterSpacing: -0.5,
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#64748B',
        marginTop: 4,
    },
    headerActions: {
        flexDirection: 'row',
        gap: 12,
    },
    headerButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#1E293B',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#334155',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 16,
    },
    cardsContainer: {
        paddingTop: 8,
    },
    cardContainer: {
        marginBottom: 16,
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 8,
    },
    card: {
        borderRadius: 20,
        padding: 20,
        minHeight: CARD_HEIGHT,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 20,
    },
    cardIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardActions: {
        flexDirection: 'row',
        gap: 8,
    },
    cardActionButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardBody: {
        flex: 1,
        justifyContent: 'center',
    },
    cardLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.8)',
        letterSpacing: 1,
        marginBottom: 8,
    },
    cardValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginTop: 20,
    },
    issuerInfo: {
        flex: 1,
    },
    issuerLabel: {
        fontSize: 10,
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.6)',
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    issuerValue: {
        fontSize: 13,
        color: '#FFFFFF',
        fontWeight: '500',
    },
    verifiedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    verifiedText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    expandedDetails: {
        marginTop: 20,
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        marginBottom: 16,
    },
    detailsTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 12,
    },
    detailRow: {
        marginBottom: 10,
    },
    detailLabel: {
        fontSize: 11,
        color: 'rgba(255, 255, 255, 0.6)',
        marginBottom: 2,
        letterSpacing: 0.5,
    },
    detailValue: {
        fontSize: 14,
        color: '#FFFFFF',
        fontWeight: '500',
    },
    timestamp: {
        fontSize: 11,
        color: 'rgba(255, 255, 255, 0.5)',
        marginTop: 12,
        fontStyle: 'italic',
    },
    loadingContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 100,
        gap: 16,
    },
    loadingText: {
        fontSize: 16,
        color: '#64748B',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        paddingHorizontal: 32,
    },
    emptyIconContainer: {
        marginBottom: 24,
    },
    emptyTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#F1F5F9',
        marginBottom: 12,
    },
    emptySubtitle: {
        fontSize: 16,
        color: '#64748B',
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 32,
    },
    primaryButton: {
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 16,
    },
    buttonGradient: {
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 12,
    },
    primaryButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
        textAlign: 'center',
    },
    secondaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#334155',
        backgroundColor: '#1E293B',
    },
    secondaryButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#667eea',
    },
    bottomPadding: {
        height: 100,
    },
});