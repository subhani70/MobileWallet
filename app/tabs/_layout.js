// app/tabs/_layout.js
import { Tabs } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Home, FileText, QrCode, Clock, User, Send } from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext'; // or '../../contexts/ThemeContext'

export default function TabLayout() {
  const { theme, isDark } = useTheme();

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: theme.primary,
          tabBarInactiveTintColor: theme.textTertiary,
          tabBarStyle: {
            backgroundColor: theme.surface,
            borderTopWidth: 1,
            borderTopColor: theme.border,
            height: 80,
            paddingBottom: 20,
            paddingTop: 8,
            shadowColor: theme.primary,
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 4,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '500',
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, focused }) => (
              <Home size={28} color={color} fill={focused ? color : 'none'} />
            ),
          }}
        />

      <Tabs.Screen
        name="credentials"
        options={{
          title: 'Credentials',
          tabBarIcon: ({ color }) => <FileText size={28} color={color} />,
        }}
      />
   
      <Tabs.Screen
        name="scan"
        options={{
          title: '',
          tabBarIcon: () => (
            <View style={styles.scanButtonContainer}>
              <LinearGradient
                colors={['#06B6D4', '#8B5CF6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.scanButton}
              >
                <QrCode size={32} color="#FFFFFF" />
              </LinearGradient>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: 'Transactions',
          tabBarIcon: ({ color }) => <Send size={28} color={color} />,
        }}
      />

      {/* <Tabs.Screen
        name="activity"
        options={{
          title: 'Activity',
          tabBarIcon: ({ color }) => <Clock size={28} color={color} />,
        }}
      /> */}

        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color }) => <User size={28} color={color} />,
          }}
        />
      </Tabs>
    </>
  );
}

const styles = StyleSheet.create({
  scanButtonContainer: {
    marginTop: -20,
  },
  scanButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
});