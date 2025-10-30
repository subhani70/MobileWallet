// app/onboarding/recovery-phrase-backup.js - WITH PRINT & CLOUD
import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  AlertTriangle,
  Eye,
  EyeOff,
  Copy,
  Edit3,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Printer,
  Cloud,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as secureStorage from '../../services/secureStorage';
import logger from '../../utils/logger';

const CONFIRMATIONS = [
  'I have written down my recovery phrase',
  "I understand I'll lose access if I lose this phrase",
  'The platform cannot recover my phrase',
];

export default function RecoveryPhraseBackup() {
  const router = useRouter();
  const [mnemonic, setMnemonic] = useState([]);
  const [revealed, setRevealed] = useState(false);
  const [checkboxes, setCheckboxes] = useState([false, false, false]);
  const [showTips, setShowTips] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isPrinting, setIsPrinting] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const blurOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadMnemonic();
    startPulseAnimation();
  }, []);

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
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

  const loadMnemonic = async () => {
    try {
      logger.info('📝 Loading mnemonic...');
      const storedMnemonic = await secureStorage.getMnemonic();

      if (!storedMnemonic) {
        throw new Error('No mnemonic found. Please create your wallet first.');
      }

      const words = storedMnemonic.trim().split(' ');

      if (words.length !== 12) {
        throw new Error('Invalid mnemonic. Expected 12 words.');
      }

      setMnemonic(words);
      logger.success(`✅ Mnemonic loaded: ${words.length} words`);

    } catch (error) {
      logger.error('Failed to load mnemonic: ' + error.message);
      Alert.alert(
        'Error',
        'Could not load recovery phrase. Please try again.',
        [{ text: 'Go Back', onPress: () => router.back() }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleReveal = () => {
    Animated.timing(blurOpacity, {
      toValue: revealed ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
    setRevealed(!revealed);
  };

  const handleCopyAll = async () => {
    if (mnemonic.length === 0) return;

    const mnemonicString = mnemonic.join(' ');
    await Clipboard.setStringAsync(mnemonicString);

    Alert.alert(
      '📋 Copied!',
      'Recovery phrase copied to clipboard.\n\n⚠️ Remember to:\n• Paste it in a secure location\n• Clear your clipboard afterwards\n• Never share it with anyone',
      [{ text: 'OK' }]
    );

    logger.warning('⚠️ Mnemonic copied to clipboard');
  };

  const handlePrint = async () => {
    if (mnemonic.length === 0) {
      Alert.alert('Error', 'No recovery phrase to print');
      return;
    }

    Alert.alert(
      '🖨️ Print Recovery Phrase?',
      '⚠️ Security Warning:\n\n• Only print on a trusted printer\n• Store the printout securely\n• Destroy any test prints\n• Consider who has access to your printer',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Print',
          onPress: async () => {
            try {
              setIsPrinting(true);
              logger.info('🖨️ Generating PDF...');

              // Create HTML for PDF
              const html = `
                <!DOCTYPE html>
                <html>
                  <head>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                      * { margin: 0; padding: 0; box-sizing: border-box; }
                      body { 
                        font-family: Arial, sans-serif; 
                        padding: 40px; 
                        background: white;
                      }
                      .header {
                        text-align: center;
                        margin-bottom: 30px;
                        border-bottom: 3px solid #DC2626;
                        padding-bottom: 20px;
                      }
                      .title { 
                        font-size: 28px; 
                        font-weight: bold; 
                        color: #DC2626;
                        margin-bottom: 10px;
                      }
                      .warning {
                        background: #FEE2E2;
                        border: 2px solid #DC2626;
                        border-radius: 8px;
                        padding: 20px;
                        margin: 20px 0;
                      }
                      .warning-title {
                        font-size: 18px;
                        font-weight: bold;
                        color: #7F1D1D;
                        margin-bottom: 10px;
                      }
                      .warning-text {
                        font-size: 14px;
                        color: #991B1B;
                        line-height: 1.6;
                      }
                      .phrase-container {
                        background: #F3F4F6;
                        border: 2px dashed #6B7280;
                        border-radius: 12px;
                        padding: 30px;
                        margin: 30px 0;
                      }
                      .phrase-title {
                        font-size: 18px;
                        font-weight: bold;
                        margin-bottom: 20px;
                        color: #1F2937;
                      }
                      .words-grid {
                        display: grid;
                        grid-template-columns: repeat(3, 1fr);
                        gap: 15px;
                      }
                      .word-cell {
                        background: white;
                        border: 2px solid #D1D5DB;
                        border-radius: 8px;
                        padding: 12px;
                        text-align: center;
                      }
                      .word-number {
                        font-size: 12px;
                        color: #6B7280;
                        font-weight: bold;
                      }
                      .word-text {
                        font-size: 18px;
                        color: #1F2937;
                        font-weight: bold;
                        margin-top: 5px;
                        font-family: 'Courier New', monospace;
                      }
                      .instructions {
                        margin-top: 30px;
                        padding: 20px;
                        background: #DBEAFE;
                        border-radius: 8px;
                      }
                      .instructions-title {
                        font-size: 16px;
                        font-weight: bold;
                        color: #1E40AF;
                        margin-bottom: 10px;
                      }
                      .instruction-item {
                        font-size: 14px;
                        color: #1E3A8A;
                        margin: 8px 0;
                        padding-left: 20px;
                      }
                      .footer {
                        margin-top: 40px;
                        text-align: center;
                        font-size: 12px;
                        color: #6B7280;
                        border-top: 1px solid #D1D5DB;
                        padding-top: 20px;
                      }
                    </style>
                  </head>
                  <body>
                    <div class="header">
                      <div class="title">🔐 Wallet Recovery Phrase</div>
                      <p style="color: #6B7280; font-size: 14px;">CredentialWallet - Self-Sovereign Identity</p>
                    </div>

                    <div class="warning">
                      <div class="warning-title">⚠️ CRITICAL SECURITY INFORMATION</div>
                      <div class="warning-text">
                        • Never share this phrase with anyone, including support staff<br/>
                        • Anyone with these words can access your wallet<br/>
                        • Store this document in a secure location (safe, vault)<br/>
                        • Consider making multiple copies in different locations<br/>
                        • Destroy this printout if you no longer need it
                      </div>
                    </div>

                    <div class="phrase-container">
                      <div class="phrase-title">Write down these 12 words in order:</div>
                      <div class="words-grid">
                        ${mnemonic.map((word, index) => `
                          <div class="word-cell">
                            <div class="word-number">${index + 1}</div>
                            <div class="word-text">${word}</div>
                          </div>
                        `).join('')}
                      </div>
                    </div>

                    <div class="instructions">
                      <div class="instructions-title">📝 Recovery Instructions:</div>
                      <div class="instruction-item">1. Keep this document in a fireproof and waterproof safe</div>
                      <div class="instruction-item">2. To recover your wallet, enter these 12 words in exact order</div>
                      <div class="instruction-item">3. Each word must be spelled exactly as shown above</div>
                      <div class="instruction-item">4. Never store digital copies (photos, scans, etc.)</div>
                    </div>

                    <div class="footer">
                      <p>Generated on: ${new Date().toLocaleString()}</p>
                      <p style="margin-top: 10px; color: #DC2626; font-weight: bold;">
                        Keep this document safe and private
                      </p>
                    </div>
                  </body>
                </html>
              `;

              // Generate PDF
              const { uri } = await Print.printToFileAsync({ html });
              logger.success('✅ PDF generated');

              // Share/Save PDF
              if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri, {
                  mimeType: 'application/pdf',
                  dialogTitle: 'Save Recovery Phrase PDF',
                  UTI: 'com.adobe.pdf',
                });
                logger.info('📄 PDF shared');
              } else {
                Alert.alert('Success', 'PDF created successfully');
              }

            } catch (error) {
              logger.error('Print failed: ' + error.message);
              Alert.alert('Error', 'Failed to create PDF: ' + error.message);
            } finally {
              setIsPrinting(false);
            }
          }
        }
      ]
    );
  };

  const handleCloudBackup = () => {
    Alert.alert(
      '☁️ Cloud Backup',
      'Encrypted cloud backup feature coming soon!\n\nThis will allow you to:\n• Encrypt your recovery phrase with a password\n• Store securely in your cloud storage\n• Restore from cloud on new devices',
      [{ text: 'OK' }]
    );
  };

  const handleCheckbox = (index) => {
    const newCheckboxes = [...checkboxes];
    newCheckboxes[index] = !newCheckboxes[index];
    setCheckboxes(newCheckboxes);
  };

  const allChecked = checkboxes.every(c => c);

  // const handleContinue = async () => {
  //   if (!allChecked) {
  //     Alert.alert('Confirmation Required', 'Please confirm all checkboxes before continuing.');
  //     return;
  //   }

  //   await secureStorage.saveSecure('recovery_phrase_backed_up', 'true');
  //   logger.success('✅ Recovery phrase backup confirmed');
  //   router.replace('/onboarding/RecoveryPhraseVerify');
  // };

  const handleContinue = async () => {
    if (!allChecked) {
      Alert.alert('Confirmation Required', 'Please confirm all checkboxes before continuing.');
      return;
    }
    await secureStorage.saveSecure('recovery_phrase_backed_up', 'true');
    // FIX: Make sure we push to the onboarding route
    router.push('/onboarding/recovery-phrase-verify');
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading recovery phrase...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <LinearGradient
          colors={['#DC2626', '#B91C1C']}
          style={styles.header}
        >
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <AlertTriangle color="#FFFFFF" size={48} strokeWidth={2.5} />
          </Animated.View>
          <Text style={styles.headerTitle}>Save Recovery Phrase</Text>
        </LinearGradient>

        <View style={styles.warningBanner}>
          <AlertTriangle color="#DC2626" size={24} />
          <View style={styles.warningContent}>
            <Text style={styles.warningTitle}>Never Share This Phrase</Text>
            <View style={styles.warningPoints}>
              <View style={styles.warningPoint}>
                <X color="#DC2626" size={14} />
                <Text style={styles.warningPointText}>Never share with anyone</Text>
              </View>
              <View style={styles.warningPoint}>
                <X color="#DC2626" size={14} />
                <Text style={styles.warningPointText}>Never take screenshots</Text>
              </View>
              <View style={styles.warningPoint}>
                <Check color="#059669" size={14} />
                <Text style={styles.successPointText}>Write it down on paper</Text>
              </View>
              <View style={styles.warningPoint}>
                <Check color="#059669" size={14} />
                <Text style={styles.successPointText}>Store in secure location</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.title}>Your 12-Word Recovery Phrase</Text>
          <Text style={styles.subtitle}>
            Write these words in order. You'll need them to recover your wallet.
          </Text>

          <TouchableOpacity onPress={handleReveal} activeOpacity={0.9}>
            <View style={styles.phraseCard}>
              <View style={styles.wordsGrid}>
                {mnemonic.map((word, index) => (
                  <View key={index} style={styles.wordCell}>
                    <Text style={styles.wordNumber}>{index + 1}</Text>
                    <Text style={styles.wordText}>{word}</Text>
                  </View>
                ))}
              </View>

              {!revealed && (
                <Animated.View style={[styles.blurOverlay, { opacity: blurOpacity }]}>
                  <Eye color="#94A3B8" size={40} />
                  <Text style={styles.blurText}>Tap to reveal</Text>
                </Animated.View>
              )}

              <View style={styles.revealButton}>
                {revealed ? (
                  <>
                    <EyeOff color="#94A3B8" size={14} />
                    <Text style={styles.revealButtonText}>Tap to hide</Text>
                  </>
                ) : (
                  <>
                    <Eye color="#94A3B8" size={14} />
                    <Text style={styles.revealButtonText}>Tap to reveal</Text>
                  </>
                )}
              </View>
            </View>
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>Backup Methods</Text>

          {/* Write It Down - RECOMMENDED */}
          <View style={[styles.methodCard, styles.recommendedCard]}>
            <View style={styles.methodHeader}>
              <Edit3 color="#059669" size={20} />
              <View style={styles.methodContent}>
                <View style={styles.methodTitleRow}>
                  <Text style={styles.methodTitle}>Write It Down</Text>
                  <View style={styles.recommendedBadge}>
                    <Text style={styles.recommendedBadgeText}>RECOMMENDED</Text>
                  </View>
                </View>
                <Text style={styles.methodDescription}>Most secure method</Text>
              </View>
            </View>
          </View>

          {/* Print to PDF */}
          <TouchableOpacity
            style={styles.methodCard}
            onPress={handlePrint}
            disabled={isPrinting || !revealed}
          >
            <View style={styles.methodHeader}>
              <Printer color={revealed ? "#6B7280" : "#475569"} size={20} />
              <View style={styles.methodContent}>
                <Text style={[styles.methodTitle, !revealed && styles.methodDisabled]}>
                  Print to PDF
                </Text>
                <Text style={[styles.methodDescription, !revealed && styles.methodDisabled]}>
                  {isPrinting ? 'Generating PDF...' : 'Physical printout'}
                </Text>
                {!revealed && (
                  <Text style={styles.methodWarning}>⚠️ Reveal phrase first</Text>
                )}
              </View>
            </View>
          </TouchableOpacity>

          {/* Cloud Backup - Coming Soon */}
          <TouchableOpacity
            style={styles.methodCard}
            onPress={handleCloudBackup}
          >
            <View style={styles.methodHeader}>
              <Cloud color="#3B82F6" size={20} />
              <View style={styles.methodContent}>
                <Text style={styles.methodTitle}>Encrypted Cloud Backup</Text>
                <Text style={styles.methodDescription}>Coming soon - Secure cloud storage</Text>
                <Text style={styles.methodInfo}>🔐 Will require strong password</Text>
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tipsCard}
            onPress={() => setShowTips(!showTips)}
          >
            <View style={styles.tipsHeader}>
              <Text style={styles.tipsTitle}>Security Tips</Text>
              {showTips ? (
                <ChevronUp color="#94A3B8" size={18} />
              ) : (
                <ChevronDown color="#94A3B8" size={18} />
              )}
            </View>

            {showTips && (
              <View style={styles.tipsContent}>
                <Text style={styles.tipsLabel}>✅ Do:</Text>
                <Text style={styles.tipText}>• Store in fireproof safe</Text>
                <Text style={styles.tipText}>• Make multiple copies</Text>
                <Text style={styles.tipText}>• Use metal backup cards</Text>

                <Text style={[styles.tipsLabel, styles.tipsLabelDont]}>❌ Don't:</Text>
                <Text style={styles.tipText}>• Store digitally unencrypted</Text>
                <Text style={styles.tipText}>• Share via email</Text>
                <Text style={styles.tipText}>• Take photos</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.checkboxSection}>
            {CONFIRMATIONS.map((text, index) => (
              <TouchableOpacity
                key={index}
                style={styles.checkboxRow}
                onPress={() => handleCheckbox(index)}
              >
                <View style={[
                  styles.checkbox,
                  checkboxes[index] && styles.checkboxChecked
                ]}>
                  {checkboxes[index] && (
                    <Check color="#FFFFFF" size={14} strokeWidth={3} />
                  )}
                </View>
                <Text style={styles.checkboxLabel}>
                  <Text style={styles.required}>* </Text>
                  {text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={styles.bottomSection}>
        <TouchableOpacity
          style={[styles.copyButton, !revealed && styles.copyButtonDisabled]}
          onPress={handleCopyAll}
          disabled={!revealed}
        >
          <Copy color={revealed ? "#94A3B8" : "#475569"} size={16} />
          <Text style={[styles.copyButtonText, !revealed && styles.copyButtonTextDisabled]}>
            Copy All Words
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.continueButton,
            !allChecked && styles.continueButtonDisabled
          ]}
          onPress={handleContinue}
          disabled={!allChecked}
        >
          <LinearGradient
            colors={allChecked ? ['#06B6D4', '#0891B2'] : ['#D1D5DB', '#D1D5DB']}
            style={styles.continueButtonGradient}
          >
            <Text style={styles.continueButtonText}>Complete Setup</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // ... keep all existing styles and add these new ones:

  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#94A3B8',
  },
  header: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 8,
    textAlign: 'center',
  },
  warningBanner: {
    backgroundColor: '#FEF2F2',
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#EF4444',
    padding: 12,
    flexDirection: 'row',
    gap: 12,
  },
  warningContent: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#7F1D1D',
    marginBottom: 8,
  },
  warningPoints: {
    gap: 6,
  },
  warningPoint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  warningPointText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#991B1B',
    flex: 1,
  },
  successPointText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#065F46',
    flex: 1,
  },
  section: {
    padding: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 8,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    lineHeight: 20,
    marginBottom: 16,
  },
  phraseCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#475569',
    padding: 16,
    marginBottom: 16,
    position: 'relative',
  },
  wordsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  wordCell: {
    width: '31%',
    backgroundColor: '#334155',
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: 8,
    padding: 8,
    height: 48,
    justifyContent: 'center',
  },
  wordNumber: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#64748B',
    position: 'absolute',
    top: 4,
    left: 6,
  },
  wordText: {
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#F1F5F9',
    textAlign: 'center',
    marginTop: 6,
  },
  blurOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(30, 41, 59, 0.98)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  blurText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 8,
  },
  revealButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#475569',
  },
  revealButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F1F5F9',
    marginBottom: 10,
  },
  methodCard: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  recommendedCard: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 2,
    borderColor: '#10B981',
  },
  methodHeader: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  methodContent: {
    flex: 1,
  },
  methodTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  methodTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F1F5F9',
  },
  methodDisabled: {
    color: '#64748B',
  },
  recommendedBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  recommendedBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  methodDescription: {
    fontSize: 12,
    color: '#94A3B8',
  },
  methodWarning: {
    fontSize: 11,
    color: '#F59E0B',
    marginTop: 4,
  },
  methodInfo: {
    fontSize: 11,
    color: '#3B82F6',
    marginTop: 4,
  },
  tipsCard: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    marginBottom: 16,
  },
  tipsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F1F5F9',
  },
  tipsContent: {
    marginTop: 12,
  },
  tipsLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#065F46',
    marginBottom: 6,
    marginTop: 6,
  },
  tipsLabelDont: {
    color: '#991B1B',
  },
  tipText: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 18,
    marginBottom: 2,
  },
  checkboxSection: {
    gap: 10,
    marginBottom: 12,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#475569',
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: '#06B6D4',
    borderColor: '#06B6D4',
  },
  checkboxLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#F1F5F9',
    flex: 1,
    lineHeight: 18,
  },
  required: {
    color: '#DC2626',
  },
  bottomSection: {
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 8 : 16,
    backgroundColor: '#1E293B',
    borderTopWidth: 1,
    borderTopColor: '#475569',
    gap: 10,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#475569',
    backgroundColor: '#334155',
  },
  copyButtonDisabled: {
    opacity: 0.5,
  },
  copyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
  },
  copyButtonTextDisabled: {
    color: '#475569',
  },
  continueButton: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  continueButtonDisabled: {
    opacity: 0.5,
  },
  continueButtonGradient: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});