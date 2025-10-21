// / app/settings.jsx
// // Real Digital Wallet - Settings Screen

// import { useState, useEffect } from 'react';
// import {
//     View,
//     Text,
//     StyleSheet,
//     TouchableOpacity,
//     ScrollView,
//     Alert,
//     StatusBar,
//     Switch,
//     Share
// } from 'react-native';
// import * as Clipboard from 'expo-clipboard';
// import { useRouter } from 'expo-router';
// import * as didManager from '../services/didManager';
// import * as secureStorage from '../services/secureStorage';
// import * as biometric from '../services/biometric';
// import logger from '../utils/logger';

// export default function SettingsScreen() {
//     const router = useRouter();
//     const [walletInfo, setWalletInfo] = useState(null);
//     const [biometricEnabled, setBiometricEnabled] = useState(false);
//     const [biometricAvailable, setBiometricAvailable] = useState(false);
//     const [credentialsCount, setCredentialsCount] = useState(0);

//     useEffect(() => {
//         loadSettings();
//     }, []);

//     const loadSettings = async () => {
//         const info = await didManager.getWalletInfo();
//         setWalletInfo(info);

//         const available = await biometric.canUseBiometric();
//         setBiometricAvailable(available);

//         const enabled = await secureStorage.isBiometricEnabled();
//         setBiometricEnabled(enabled);

//         const creds = await secureStorage.getCredentials();
//         setCredentialsCount(creds.length);
//     };

//     const toggleBiometric = async (value) => {
//         if (value && biometricAvailable) {
//             const result = await biometric.authenticateWithBiometric('Enable biometric authentication');
//             if (result.success) {
//                 await secureStorage.setBiometricEnabled(true);
//                 setBiometricEnabled(true);
//                 Alert.alert('Enabled', 'Biometric authentication is now enabled');
//             }
//         } else {
//             await secureStorage.setBiometricEnabled(false);
//             setBiometricEnabled(false);
//         }
//     };

//     const handleCopyDID = async () => {
//         if (walletInfo?.did) {
//             await Clipboard.setStringAsync(walletInfo.did);
//             Alert.alert('Copied', 'DID copied to clipboard');
//         }
//     };

//     const handleCopyAddress = async () => {
//         if (walletInfo?.address) {
//             await Clipboard.setStringAsync(walletInfo.address);
//             Alert.alert('Copied', 'Address copied to clipboard');
//         }
//     };

//     const handleShareIdentity = async () => {
//         if (walletInfo?.did) {
//             try {
//                 await Share.share({
//                     message: `My Digital Identity\n\nDID: ${walletInfo.did}\n\nAddress: ${walletInfo.address}`,
//                     title: 'My Digital Identity',
//                 });
//             } catch (error) {
//                 console.error('Share failed');
//             }
//         }
//     };

//     const handleViewLogs = () => {
//         const logs = logger.getLogs();
//         const recentLogs = logs.slice(0, 10).map(log => `[${log.timestamp}] ${log.message}`).join('\n\n');
//         Alert.alert('Activity Logs', recentLogs || 'No logs available', [{ text: 'Close' }]);
//     };

//     const handleBackupWallet = () => {
//         Alert.alert(
//             'Backup Wallet',
//             'Your wallet is automatically backed up securely on this device. For additional security, write down your recovery phrase and store it in a safe place.',
//             [{ text: 'Got It' }]
//         );
//     };

//     const handleClearWallet = () => {
//         Alert.alert(
//             'Clear Wallet',
//             'This will permanently delete your identity and all credentials. This action cannot be undone!\n\nAre you sure you want to continue?',
//             [
//                 { text: 'Cancel', style: 'cancel' },
//                 {
//                     text: 'Delete Everything',
//                     style: 'destructive',
//                     onPress: async () => {
//                         await secureStorage.clearWallet();
//                         setWalletInfo(null);
//                         Alert.alert('Wallet Cleared', 'Your wallet has been reset', [
//                             { text: 'OK', onPress: () => router.replace('/') }
//                         ]);
//                     },
//                 },
//             ]
//         );
//     };

//     if (!walletInfo) {
//         return (
//             <View style={styles.container}>
//                 <StatusBar barStyle="dark-content" />
//                 <View style={styles.emptyState}>
//                     <View style={styles.emptyIconContainer}>
//                         <Text style={styles.emptyIcon}>⚙️</Text>
//                     </View>
//                     <Text style={styles.emptyTitle}>No Wallet Found</Text>
//                     <Text style={styles.emptyText}>
//                         Create your wallet first to access settings
//                     </Text>
//                     <TouchableOpacity style={styles.emptyButton} onPress={() => router.push('/')}>
//                         <Text style={styles.emptyButtonText}>Go to Home</Text>
//                     </TouchableOpacity>
//                 </View>
//             </View>
//         );
//     }

//     return (
//         <View style={styles.container}>
//             <StatusBar barStyle="dark-content" />

//             {/* Header */}
//             <View style={styles.header}>
//                 <Text style={styles.headerTitle}>Settings</Text>
//             </View>

//             <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
//                 {/* Identity Card */}
//                 <View style={styles.section}>
//                     <Text style={styles.sectionTitle}>Digital Identity</Text>

//                     <View style={styles.identityCard}>
//                         <View style={styles.identityHeader}>
//                             <View style={styles.identityAvatar}>
//                                 <Text style={styles.identityAvatarText}>
//                                     {walletInfo.address?.slice(2, 4).toUpperCase()}
//                                 </Text>
//                             </View>
//                             <View style={styles.identityInfo}>
//                                 <Text style={styles.identityLabel}>Your Wallet</Text>
//                                 <Text style={styles.identityAddress} numberOfLines={1}>
//                                     {walletInfo.address?.slice(0, 10)}...{walletInfo.address?.slice(-8)}
//                                 </Text>
//                             </View>
//                         </View>

//                         <View style={styles.identityDivider} />

//                         <TouchableOpacity style={styles.identityRow} onPress={handleCopyDID}>
//                             <View style={styles.identityRowLeft}>
//                                 <Text style={styles.identityRowLabel}>DID</Text>
//                                 <Text style={styles.identityRowValue} numberOfLines={1}>
//                                     {walletInfo.did}
//                                 </Text>
//                             </View>
//                             <Text style={styles.identityRowIcon}>📋</Text>
//                         </TouchableOpacity>

//                         <TouchableOpacity style={styles.identityRow} onPress={handleCopyAddress}>
//                             <View style={styles.identityRowLeft}>
//                                 <Text style={styles.identityRowLabel}>Blockchain Address</Text>
//                                 <Text style={styles.identityRowValue} numberOfLines={1}>
//                                     {walletInfo.address}
//                                 </Text>
//                             </View>
//                             <Text style={styles.identityRowIcon}>📋</Text>
//                         </TouchableOpacity>

//                         <TouchableOpacity style={styles.shareButton} onPress={handleShareIdentity}>
//                             <Text style={styles.shareButtonText}>Share Identity</Text>
//                         </TouchableOpacity>
//                     </View>
//                 </View>

//                 {/* Security Section */}
//                 <View style={styles.section}>
//                     <Text style={styles.sectionTitle}>Security</Text>

//                     <View style={styles.settingsCard}>
//                         <TouchableOpacity
//                             style={styles.settingRow}
//                             activeOpacity={biometricAvailable ? 0.7 : 1}
//                         >
//                             <View style={styles.settingLeft}>
//                                 <View style={styles.settingIconContainer}>
//                                     <Text style={styles.settingIcon}>🔒</Text>
//                                 </View>
//                                 <View style={styles.settingInfo}>
//                                     <Text style={styles.settingTitle}>Biometric Lock</Text>
//                                     <Text style={styles.settingSubtitle}>
//                                         {biometricAvailable ? 'Use fingerprint or Face ID' : 'Not available'}
//                                     </Text>
//                                 </View>
//                             </View>
//                             <Switch
//                                 value={biometricEnabled}
//                                 onValueChange={toggleBiometric}
//                                 disabled={!biometricAvailable}
//                                 trackColor={{ false: '#E5E7EB', true: '#93C5FD' }}
//                                 thumbColor={biometricEnabled ? '#3B82F6' : '#F3F4F6'}
//                                 ios_backgroundColor="#E5E7EB"
//                             />
//                         </TouchableOpacity>
//                     </View>
//                 </View>

//                 {/* Wallet Section */}
//                 <View style={styles.section}>
//                     <Text style={styles.sectionTitle}>Wallet</Text>

//                     <View style={styles.settingsCard}>
//                         <TouchableOpacity style={styles.settingRow} onPress={handleBackupWallet}>
//                             <View style={styles.settingLeft}>
//                                 <View style={styles.settingIconContainer}>
//                                     <Text style={styles.settingIcon}>💾</Text>
//                                 </View>
//                                 <View style={styles.settingInfo}>
//                                     <Text style={styles.settingTitle}>Backup Wallet</Text>
//                                     <Text style={styles.settingSubtitle}>Secure your credentials</Text>
//                                 </View>
//                             </View>
//                             <Text style={styles.settingChevron}>›</Text>
//                         </TouchableOpacity>

//                         <View style={styles.settingDivider} />

//                         <TouchableOpacity style={styles.settingRow} onPress={handleViewLogs}>
//                             <View style={styles.settingLeft}>
//                                 <View style={styles.settingIconContainer}>
//                                     <Text style={styles.settingIcon}>📋</Text>
//                                 </View>
//                                 <View style={styles.settingInfo}>
//                                     <Text style={styles.settingTitle}>Activity Logs</Text>
//                                     <Text style={styles.settingSubtitle}>View recent activity</Text>
//                                 </View>
//                             </View>
//                             <Text style={styles.settingChevron}>›</Text>
//                         </TouchableOpacity>
//                     </View>
//                 </View>

//                 {/* Stats Section */}
//                 <View style={styles.section}>
//                     <Text style={styles.sectionTitle}>Statistics</Text>

//                     <View style={styles.statsGrid}>
//                         <View style={styles.statBox}>
//                             <Text style={styles.statValue}>{credentialsCount}</Text>
//                             <Text style={styles.statLabel}>Credentials</Text>
//                         </View>

//                         <View style={styles.statBox}>
//                             <Text style={styles.statValue}>1</Text>
//                             <Text style={styles.statLabel}>Wallet</Text>
//                         </View>
//                     </View>
//                 </View>

//                 {/* About Section */}
//                 <View style={styles.section}>
//                     <Text style={styles.sectionTitle}>About</Text>

//                     <View style={styles.settingsCard}>
//                         <View style={styles.aboutRow}>
//                             <Text style={styles.aboutLabel}>App Version</Text>
//                             <Text style={styles.aboutValue}>1.0.0</Text>
//                         </View>

//                         <View style={styles.settingDivider} />

//                         <View style={styles.aboutRow}>
//                             <Text style={styles.aboutLabel}>Protocol</Text>
//                             <Text style={styles.aboutValue}>W3C DID</Text>
//                         </View>

//                         <View style={styles.settingDivider} />

//                         <View style={styles.aboutRow}>
//                             <Text style={styles.aboutLabel}>Network</Text>
//                             <Text style={styles.aboutValue}>VoltusWave</Text>
//                         </View>
//                     </View>
//                 </View>

//                 {/* Danger Zone */}
//                 <View style={styles.section}>
//                     <Text style={styles.dangerTitle}>Danger Zone</Text>

//                     <TouchableOpacity style={styles.dangerCard} onPress={handleClearWallet}>
//                         <View style={styles.dangerContent}>
//                             <Text style={styles.dangerIcon}>🗑️</Text>
//                             <View style={styles.dangerInfo}>
//                                 <Text style={styles.dangerText}>Clear Wallet</Text>
//                                 <Text style={styles.dangerSubtext}>
//                                     Permanently delete your identity and all credentials
//                                 </Text>
//                             </View>
//                         </View>
//                     </TouchableOpacity>

//                     <Text style={styles.dangerWarning}>
//                         ⚠️ This action cannot be undone. Make sure you have backups before proceeding.
//                     </Text>
//                 </View>

//                 <View style={{ height: 60 }} />
//             </ScrollView>
//         </View>
//     );
// }

// const styles = StyleSheet.create({
//     container: {
//         flex: 1,
//         backgroundColor: '#F8F9FA',
//     },
//     header: {
//         paddingHorizontal: 20,
//         paddingTop: 60,
//         paddingBottom: 20,
//         backgroundColor: '#FFFFFF',
//         borderBottomWidth: 1,
//         borderBottomColor: '#E5E7EB',
//     },
//     headerTitle: {
//         fontSize: 34,
//         fontWeight: '700',
//         color: '#1A1A1A',
//         letterSpacing: -0.5,
//     },
//     scrollView: {
//         flex: 1,
//     },
//     section: {
//         marginTop: 24,
//         paddingHorizontal: 20,
//     },
//     sectionTitle: {
//         fontSize: 13,
//         fontWeight: '600',
//         color: '#6B7280',
//         textTransform: 'uppercase',
//         letterSpacing: 0.5,
//         marginBottom: 12,
//     },
//     // Identity Card
//     identityCard: {
//         backgroundColor: '#FFFFFF',
//         borderRadius: 16,
//         padding: 20,
//         shadowColor: '#000',
//         shadowOffset: { width: 0, height: 2 },
//         shadowOpacity: 0.05,
//         shadowRadius: 8,
//         elevation: 2,
//     },
//     identityHeader: {
//         flexDirection: 'row',
//         alignItems: 'center',
//         marginBottom: 20,
//     },
//     identityAvatar: {
//         width: 60,
//         height: 60,
//         borderRadius: 30,
//         backgroundColor: '#3B82F6',
//         alignItems: 'center',
//         justifyContent: 'center',
//         marginRight: 16,
//     },
//     identityAvatarText: {
//         fontSize: 24,
//         fontWeight: '700',
//         color: '#FFFFFF',
//     },
//     identityInfo: {
//         flex: 1,
//     },
//     identityLabel: {
//         fontSize: 13,
//         fontWeight: '500',
//         color: '#6B7280',
//         marginBottom: 4,
//     },
//     identityAddress: {
//         fontSize: 16,
//         fontWeight: '600',
//         color: '#1A1A1A',
//         fontFamily: 'monospace',
//     },
//     identityDivider: {
//         height: 1,
//         backgroundColor: '#E5E7EB',
//         marginBottom: 16,
//     },
//     identityRow: {
//         flexDirection: 'row',
//         justifyContent: 'space-between',
//         alignItems: 'center',
//         paddingVertical: 12,
//     },
//     identityRowLeft: {
//         flex: 1,
//         marginRight: 12,
//     },
//     identityRowLabel: {
//         fontSize: 12,
//         fontWeight: '500',
//         color: '#6B7280',
//         marginBottom: 4,
//     },
//     identityRowValue: {
//         fontSize: 14,
//         color: '#1A1A1A',
//         fontFamily: 'monospace',
//     },
//     identityRowIcon: {
//         fontSize: 20,
//     },
//     shareButton: {
//         backgroundColor: '#3B82F6',
//         paddingVertical: 14,
//         borderRadius: 10,
//         alignItems: 'center',
//         marginTop: 16,
//     },
//     shareButtonText: {
//         color: '#FFFFFF',
//         fontSize: 16,
//         fontWeight: '600',
//     },
//     // Settings Card
//     settingsCard: {
//         backgroundColor: '#FFFFFF',
//         borderRadius: 16,
//         overflow: 'hidden',
//         shadowColor: '#000',
//         shadowOffset: { width: 0, height: 2 },
//         shadowOpacity: 0.05,
//         shadowRadius: 8,
//         elevation: 2,
//     },
//     settingRow: {
//         flexDirection: 'row',
//         justifyContent: 'space-between',
//         alignItems: 'center',
//         padding: 16,
//     },
//     settingLeft: {
//         flexDirection: 'row',
//         alignItems: 'center',
//         flex: 1,
//     },
//     settingIconContainer: {
//         width: 40,
//         height: 40,
//         borderRadius: 20,
//         backgroundColor: '#F3F4F6',
//         alignItems: 'center',
//         justifyContent: 'center',
//         marginRight: 12,
//     },
//     settingIcon: {
//         fontSize: 20,
//     },
//     settingInfo: {
//         flex: 1,
//     },
//     settingTitle: {
//         fontSize: 16,
//         fontWeight: '600',
//         color: '#1A1A1A',
//         marginBottom: 2,
//     },
//     settingSubtitle: {
//         fontSize: 13,
//         color: '#6B7280',
//     },
//     settingChevron: {
//         fontSize: 24,
//         color: '#9CA3AF',
//         fontWeight: '300',
//     },
//     settingDivider: {
//         height: 1,
//         backgroundColor: '#E5E7EB',
//         marginLeft: 68,
//     },
//     // Stats
//     statsGrid: {
//         flexDirection: 'row',
//         gap: 12,
//     },
//     statBox: {
//         flex: 1,
//         backgroundColor: '#FFFFFF',
//         borderRadius: 16,
//         padding: 20,
//         alignItems: 'center',
//         shadowColor: '#000',
//         shadowOffset: { width: 0, height: 2 },
//         shadowOpacity: 0.05,
//         shadowRadius: 8,
//         elevation: 2,
//     },
//     statValue: {
//         fontSize: 32,
//         fontWeight: '700',
//         color: '#3B82F6',
//         marginBottom: 4,
//     },
//     statLabel: {
//         fontSize: 13,
//         fontWeight: '500',
//         color: '#6B7280',
//     },
//     // About
//     aboutRow: {
//         flexDirection: 'row',
//         justifyContent: 'space-between',
//         alignItems: 'center',
//         paddingVertical: 16,
//         paddingHorizontal: 16,
//     },
//     aboutLabel: {
//         fontSize: 16,
//         color: '#1A1A1A',
//     },
//     aboutValue: {
//         fontSize: 16,
//         fontWeight: '600',
//         color: '#6B7280',
//     },
//     // Danger Zone
//     dangerTitle: {
//         fontSize: 13,
//         fontWeight: '600',
//         color: '#EF4444',
//         textTransform: 'uppercase',
//         letterSpacing: 0.5,
//         marginBottom: 12,
//     },
//     dangerCard: {
//         backgroundColor: '#FFFFFF',
//         borderRadius: 16,
//         borderWidth: 2,
//         borderColor: '#FEE2E2',
//         overflow: 'hidden',
//     },
//     dangerContent: {
//         flexDirection: 'row',
//         alignItems: 'center',
//         padding: 16,
//     },
//     dangerIcon: {
//         fontSize: 32,
//         marginRight: 16,
//     },
//     dangerInfo: {
//         flex: 1,
//     },
//     dangerText: {
//         fontSize: 16,
//         fontWeight: '600',
//         color: '#EF4444',
//         marginBottom: 4,
//     },
//     dangerSubtext: {
//         fontSize: 13,
//         color: '#9CA3AF',
//         lineHeight: 18,
//     },
//     dangerWarning: {
//         fontSize: 12,
//         color: '#6B7280',
//         textAlign: 'center',
//         marginTop: 12,
//         lineHeight: 18,
//     },
//     // Empty State
//     emptyState: {
//         flex: 1,
//         justifyContent: 'center',
//         alignItems: 'center',
//         padding: 40,
//     },
//     emptyIconContainer: {
//         width: 100,
//         height: 100,
//         borderRadius: 50,
//         backgroundColor: '#F8F9FA',
//         alignItems: 'center',
//         justifyContent: 'center',
//         marginBottom: 24,
//     },
//     emptyIcon: {
//         fontSize: 48,
//     },
//     emptyTitle: {
//         fontSize: 24,
//         fontWeight: '700',
//         color: '#1A1A1A',
//         marginBottom: 12,
//     },
//     emptyText: {
//         fontSize: 16,
//         color: '#6B7280',
//         textAlign: 'center',
//         marginBottom: 32,
//     },
//     emptyButton: {
//         backgroundColor: '#3B82F6',
//         paddingVertical: 14,
//         paddingHorizontal: 32,
//         borderRadius: 10,
//     },
//     emptyButtonText: {
//         color: '#FFFFFF',
//         fontSize: 16,
//         fontWeight: '600',
//     },
// });