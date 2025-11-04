// contexts/ThemeContext.js (plain JS)
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_STORAGE_KEY = '@theme_mode'; // 'light' | 'dark' | 'system'

const lightTheme = {
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceSecondary: '#F1F5F9',
  text: '#0F172A',
  textSecondary: '#475569',
  textTertiary: '#94A3B8',
  border: '#E2E8F0',
  borderSecondary: '#CBD5E1',
  primary: '#06B6D4',
  primaryLight: '#E0F2FE',
  success: '#22C55E',
  error: '#EF4444',
  warning: '#F97316',
  info: '#3B82F6',
  accent: '#8B5CF6',
  card: '#FFFFFF',
  shadow: 'rgba(0, 0, 0, 0.1)',
};

const darkTheme = {
  background: '#0F172A',
  surface: '#1E293B',
  surfaceSecondary: '#334155',
  text: '#F1F5F9',
  textSecondary: '#CBD5E1',
  textTertiary: '#64748B',
  border: '#334155',
  borderSecondary: '#475569',
  primary: '#06B6D4',
  primaryLight: '#0E7490',
  success: '#22C55E',
  error: '#EF4444',
  warning: '#F97316',
  info: '#3B82F6',
  accent: '#A855F7',
  card: '#1E293B',
  shadow: 'rgba(0, 0, 0, 0.3)',
};

const ThemeContext = createContext(undefined);

export function ThemeProvider({ children }) {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState('system'); // 'light' | 'dark' | 'system'

  useEffect(() => {
    loadThemeMode();
    const sub = Appearance.addChangeListener(() => {
      if (themeMode === 'system') {
        // trigger rerender
        setThemeModeState((m) => m);
      }
    });
    return () => sub?.remove?.();
  }, []);

  const loadThemeMode = async () => {
    try {
      const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (saved && (saved === 'light' || saved === 'dark' || saved === 'system')) {
        setThemeModeState(saved);
      }
    } catch (e) {
      console.log('Failed to load theme mode', e);
    }
  };

  const setThemeMode = async (mode) => {
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
      setThemeModeState(mode);
    } catch (e) {
      console.log('Failed to save theme mode', e);
    }
  };

  const isDark = themeMode === 'system' ? systemColorScheme === 'dark' : themeMode === 'dark';
  const theme = useMemo(() => (isDark ? darkTheme : lightTheme), [isDark]);

  return (
    <ThemeContext.Provider value={{ theme, themeMode, isDark, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}