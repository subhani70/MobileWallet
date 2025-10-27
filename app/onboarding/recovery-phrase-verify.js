import { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Animated, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, X, ArrowLeft } from 'lucide-react-native';
import * as secureStorage from '../../services/secureStorage';
import { getWordlist, getRandomIndices } from '../../utils/mnemonicUtils';

function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default function RecoveryPhraseVerify() {
  const router = useRouter();
  const [mnemonicWords, setMnemonicWords] = useState([]);
  const [positions, setPositions] = useState([]); // indices to verify
  const [answers, setAnswers] = useState({});
  const [attempts, setAttempts] = useState({});
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [wordOptions, setWordOptions] = useState([]);
  const [feedback, setFeedback] = useState({});
  const [showSuccess, setShowSuccess] = useState(false);

  const shakeAnims = useRef({});
  const confettiAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const init = async () => {
      try {
        const m = await secureStorage.getMnemonic();
        if (!m) throw new Error('No mnemonic found');
        const words = m.trim().split(' ');
        if (words.length !== 12) throw new Error('Invalid mnemonic length');

        setMnemonicWords(words);

        // pick 3 random indices to verify
        let idxs = getRandomIndices ? getRandomIndices(3) : (() => {
          const picked = new Set();
          while (picked.size < 3) picked.add(Math.floor(Math.random() * 12));
          return Array.from(picked).sort((a, b) => a - b);
        })();

        setPositions(idxs);
        const anims = {};
        idxs.forEach((pos) => { anims[pos] = new Animated.Value(0); });
        shakeAnims.current = anims;
      } catch (e) {
        Alert.alert('Error', e.message || 'Failed to load recovery phrase', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    };
    init();
  }, []);

  const generateWordOptions = (correctWord, count = 8) => {
    const wordlist = getWordlist ? getWordlist() : [];
    const pool = wordlist.length ? wordlist : mnemonicWords; // fallback
    const opts = new Set([correctWord]);
    while (opts.size < count) {
      const w = pool[Math.floor(Math.random() * pool.length)];
      if (w && w !== correctWord) opts.add(w);
    }
    return shuffleArray(Array.from(opts));
  };

  const handleWordSlotPress = (position) => {
    setSelectedPosition(position);
    const correctWord = mnemonicWords[position];
    setWordOptions(generateWordOptions(correctWord));
  };

  const handleWordSelect = async (word) => {
    if (selectedPosition === null) return;

    const correctWord = mnemonicWords[selectedPosition];
    const isCorrect = word === correctWord;

    if (isCorrect) {
      const newAnswers = { ...answers, [selectedPosition]: word };
      setAnswers(newAnswers);
      setFeedback({ ...feedback, [selectedPosition]: 'correct' });
      setSelectedPosition(null);

      const totalVerified = Object.keys(newAnswers).length;
      if (totalVerified === positions.length) {
        // success
        setTimeout(async () => {
          setShowSuccess(true);
          playSuccessAnimation();
          await secureStorage.saveSecure('recovery_phrase_verified', 'true');
          setTimeout(() => {
            router.replace('/tabs');
          }, 1400);
        }, 400);
      }
    } else {
      setFeedback({ ...feedback, [selectedPosition]: 'incorrect' });
      const newAttempts = { ...attempts, [selectedPosition]: (attempts[selectedPosition] || 0) + 1 };
      setAttempts(newAttempts);
      playShakeAnimation(selectedPosition);

      setTimeout(() => {
        setFeedback((prev) => {
          const updated = { ...prev };
          delete updated[selectedPosition];
          return updated;
        });
      }, 800);

      if (newAttempts[selectedPosition] >= 3) {
        const hintPrev = selectedPosition > 0 ? mnemonicWords[selectedPosition - 1] : 'the start';
        Alert.alert('Hint', `This word comes after "${hintPrev}"`);
      }
    }

    setSelectedPosition(null);
  };

  const playShakeAnimation = (position) => {
    const anim = shakeAnims.current[position];
    if (!anim) return;
    Animated.sequence([
      Animated.timing(anim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(anim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(anim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const playSuccessAnimation = () => {
    Animated.spring(confettiAnim, {
      toValue: 1,
      tension: 50,
      friction: 7,
      useNativeDriver: true,
    }).start();
  };

  const verifiedCount = Object.keys(answers).length;
  const totalCount = positions.length;
  const progress = totalCount > 0 ? verifiedCount / totalCount : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color="#F1F5F9" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Verify Recovery Phrase</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Verify Your Recovery Phrase</Text>
        <Text style={styles.subtitle}>
          Select the correct words to confirm you've saved your phrase
        </Text>

        <View style={styles.wordsGrid}>
          {mnemonicWords.map((word, index) => {
            const isBlank = positions.includes(index);
            const isAnswered = answers[index] !== undefined;
            const feedbackState = feedback[index];
            const shakeAnim = shakeAnims.current[index];
            if (isBlank) {
              const transform = shakeAnim ? [{ translateX: shakeAnim }] : [];
              return (
                <TouchableOpacity
                  key={index}
                  style={styles.wordCell}
                  onPress={() => !isAnswered && handleWordSlotPress(index)}
                  disabled={isAnswered}
                >
                  <Animated.View
                    style={[
                      StyleSheet.absoluteFillObject,
                      styles.blankCell,
                      isAnswered && styles.answeredCell,
                      feedbackState === 'correct' && styles.correctCell,
                      feedbackState === 'incorrect' && styles.incorrectCell,
                      { transform },
                    ]}
                  >
                    <Text style={styles.wordNumber}>{index + 1}.</Text>
                    {isAnswered ? (
                      <>
                        <Text style={styles.wordText}>{answers[index]}</Text>
                        {feedbackState === 'correct' && (
                          <View style={styles.feedbackIcon}>
                            <Check color="#10B981" size={20} strokeWidth={3} />
                          </View>
                        )}
                        {feedbackState === 'incorrect' && (
                          <View style={styles.feedbackIcon}>
                            <X color="#EF4444" size={20} strokeWidth={3} />
                          </View>
                        )}
                      </>
                    ) : (
                      <Text style={styles.placeholderText}>Tap to select</Text>
                    )}
                  </Animated.View>
                </TouchableOpacity>
              );
            }
            return (
              <View key={index} style={[styles.wordCell, styles.disabledCell]}>
                <Text style={styles.wordNumber}>{index + 1}.</Text>
                <Text style={[styles.wordText, styles.disabledText]}>{word}</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.progressSection}>
          <Text style={styles.progressText}>
            {verifiedCount} of {totalCount} words verified
          </Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={selectedPosition !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedPosition(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setSelectedPosition(null)}
          />
        </View>
        <View style={styles.bottomSheet}>
          <View style={styles.dragHandle} />
          <Text style={styles.sheetTitle}>
            Select Word #{selectedPosition !== null ? selectedPosition + 1 : ''}
          </Text>

          <View style={styles.optionsGrid}>
            {wordOptions.map((w, i) => (
              <TouchableOpacity key={i} style={styles.wordOption} onPress={() => handleWordSelect(w)}>
                <Text style={styles.wordOptionText}>{w}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      <Modal visible={showSuccess} transparent animationType="fade">
        <View style={styles.successOverlay}>
          <Animated.View
            style={[
              styles.successCard,
              { transform: [{ scale: confettiAnim }], opacity: confettiAnim },
            ]}
          >
            <LinearGradient colors={['#10B981', '#059669']} style={styles.successCircle}>
              <Check color="#FFFFFF" size={64} strokeWidth={3} />
            </LinearGradient>
            <Text style={styles.successTitle}>Verification Successful!</Text>
            <Text style={styles.successSubtitle}>
              Your recovery phrase has been verified
            </Text>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#1E293B',
    borderBottomWidth: 1, borderBottomColor: '#475569',
  },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#F1F5F9' },
  headerSpacer: { width: 40 },
  content: { padding: 16 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#94A3B8', lineHeight: 20, marginBottom: 20 },
  wordsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  wordCell: {
    width: '31%', backgroundColor: '#334155', borderWidth: 1, borderColor: '#475569',
    borderRadius: 8, padding: 10, height: 52, justifyContent: 'center', position: 'relative',
  },
  blankCell: {
    backgroundColor: '#1E293B', borderWidth: 2, borderColor: '#06B6D4', borderRadius: 8,
    padding: 10, height: 52, justifyContent: 'center',
  },
  answeredCell: { backgroundColor: '#1E293B' },
  correctCell: { borderColor: '#10B981', backgroundColor: 'rgba(16,185,129,0.1)' },
  incorrectCell: { borderColor: '#EF4444', backgroundColor: 'rgba(239,68,68,0.1)' },
  disabledCell: { opacity: 0.6 },
  wordNumber: { fontSize: 11, fontWeight: 'bold', color: '#64748B', position: 'absolute', top: 4, left: 6 },
  wordText: { fontSize: 14, fontFamily: 'monospace', color: '#F1F5F9', textAlign: 'center', marginTop: 6 },
  disabledText: { color: '#64748B' },
  placeholderText: { fontSize: 12, color: '#64748B', textAlign: 'center', marginTop: 4 },
  feedbackIcon: { position: 'absolute', top: 4, right: 4 },
  progressSection: { marginTop: 8 },
  progressText: { fontSize: 13, fontWeight: '500', color: '#94A3B8', marginBottom: 6, textAlign: 'center' },
  progressBar: { height: 8, backgroundColor: '#334155', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#06B6D4', borderRadius: 4 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  bottomSheet: {
    backgroundColor: '#1E293B', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 12, paddingHorizontal: 16, paddingBottom: 32, maxHeight: '50%',
  },
  dragHandle: { width: 32, height: 4, backgroundColor: '#475569', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 18, fontWeight: '600', color: '#F1F5F9', marginBottom: 16, textAlign: 'center' },
  optionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  wordOption: {
    width: '47%', height: 52, backgroundColor: '#334155', borderWidth: 2, borderColor: '#475569',
    borderRadius: 12, justifyContent: 'center', alignItems: 'center',
  },
  wordOptionText: { fontSize: 16, fontFamily: 'monospace', color: '#F1F5F9', fontWeight: '500' },
  successOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  successCard: { backgroundColor: '#1E293B', borderRadius: 24, padding: 32, alignItems: 'center', maxWidth: 320, width: '100%' },
  successCircle: { width: 120, height: 120, borderRadius: 60, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
});