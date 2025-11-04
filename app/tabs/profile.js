import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

export default function ProfileTab() {
  const { theme, themeMode, setThemeMode, isDark } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.text }]}>Profile</Text>
      <Text style={{ color: theme.textTertiary, marginBottom: 8 }}>
        Current theme: {themeMode} ({isDark ? 'Dark' : 'Light'})
      </Text>

      <View style={styles.row}>
        <TouchableOpacity style={[styles.btn, { backgroundColor: theme.primary }]} onPress={() => setThemeMode('light')}>
          <Text style={styles.btnText}>Light</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, { backgroundColor: theme.primary }]} onPress={() => setThemeMode('dark')}>
          <Text style={styles.btnText}>Dark</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, { backgroundColor: theme.primary }]} onPress={() => setThemeMode('system')}>
          <Text style={styles.btnText}>System</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  row: { flexDirection: 'row', gap: 10, marginTop: 12 },
  btn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
  btnText: { color: '#fff', fontWeight: '700' },
});