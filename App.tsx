import React, { useState, useEffect } from 'react';
import {
  StatusBar,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppProvider } from './src/context/AppContext';
import { theme } from './src/theme/theme';
import { apiService } from './src/services/api';

// Screen imports
import { DashboardScreen } from './src/screens/DashboardScreen';
import { JournalScreen } from './src/screens/JournalScreen';
import { TriggersScreen } from './src/screens/TriggersScreen';
import { InsightsScreen } from './src/screens/InsightsScreen';
import { ChatScreen } from './src/screens/ChatScreen';
import { SOSScreen } from './src/screens/SOSScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { NotificationsScreen } from './src/screens/NotificationsScreen';

// Icon imports matching exact bottom navigation mockup
import { Home, BookOpen, Activity, BarChart2, User, MessageSquare } from 'lucide-react-native';

function AppContent() {
  // Default to false — LoginScreen shows immediately, switches to app if logged in.
  // This prevents any black/blank screen flash during startup.
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [authChecked, setAuthChecked] = useState<boolean>(false);
  const [currentScreen, setCurrentScreen] = useState<'Dashboard' | 'Journal' | 'Triggers' | 'Insights' | 'Chat' | 'SOS' | 'Profile' | 'Notifications'>('Dashboard');

  useEffect(() => {
    AsyncStorage.getItem('@auracast_logged_in')
      .then(val => {
        setIsLoggedIn(val === 'true');
        setAuthChecked(true);
      })
      .catch(() => {
        setIsLoggedIn(false);
        setAuthChecked(true);
      });
  }, []);

  const handleLoginSuccess = async () => {
    try {
      await AsyncStorage.setItem('@auracast_logged_in', 'true');
      setIsLoggedIn(true);
      setCurrentScreen('Dashboard');
    } catch (err) {
      console.warn("Failed to save login state:", err);
    }
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('@auracast_logged_in');
      await AsyncStorage.removeItem('@auracast_cached_user');
      await apiService.clearMockProfile();
      setIsLoggedIn(false);
      setCurrentScreen('Dashboard');
    } catch (err) {
      console.warn("Failed to remove login state:", err);
    }
  };

  // Custom navigation emulator for state-based routing
  const navigation = {
    navigate: (screenName: 'Dashboard' | 'Journal' | 'Triggers' | 'Insights' | 'Chat' | 'SOS' | 'Profile' | 'Notifications') => {
      console.log("Navigating to screen:", screenName);
      setCurrentScreen(screenName);
    }
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'Dashboard':
        return <DashboardScreen navigation={navigation} />;
      case 'Journal':
        return <JournalScreen />;
      case 'Triggers':
        return <TriggersScreen />;
      case 'Insights':
        return <InsightsScreen navigation={navigation} />;
      case 'Chat':
        return <ChatScreen />;
      case 'SOS':
        return <SOSScreen navigation={navigation} />;
      case 'Profile':
        return <ProfileScreen onLogout={handleLogout} navigation={navigation} />;
      case 'Notifications':
        return <NotificationsScreen navigation={navigation} />;
      default:
        return <DashboardScreen navigation={navigation} />;
    }
  };

  // While auth state hasn't been determined yet, show a branded dark splash
  // (authChecked=false only for ~50ms max, barely visible but prevents black screen)
  if (!authChecked) {
    return (
      <SafeAreaView style={styles.splashScreen}>
        <StatusBar barStyle="light-content" backgroundColor="#0B0F19" />
      </SafeAreaView>
    );
  }

  if (!isLoggedIn) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  // Active tab helper components with capsule styling and vertical stem indicator
  const renderTabItem = (
    screenName: 'Dashboard' | 'Journal' | 'Triggers' | 'Insights' | 'Chat' | 'Profile',
    label: string,
    IconComponent: any
  ) => {
    const isActive = currentScreen === screenName;
    return (
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => setCurrentScreen(screenName)}
      >
        <View style={[styles.iconContainer, isActive ? styles.iconContainerActive : null]}>
          <IconComponent
            size={20}
            color={isActive ? '#00A3FF' : '#94A3B8'}
          />
        </View>
        <View style={isActive ? styles.indicator : styles.indicatorInactive} />
        <Text style={[styles.tabLabel, isActive ? styles.tabLabelActive : null]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0B0F19" />
      
      {/* Screen Render Area */}
      <View style={styles.screenContainer}>
        {renderScreen()}
      </View>

      {/* Floating Bottom Tab Bar matching mockup (exactly 6 items) */}
      <View style={styles.tabBar}>
        {renderTabItem('Dashboard', 'Home', Home)}
        {renderTabItem('Journal', 'Journal', BookOpen)}
        {renderTabItem('Triggers', 'Triggers', Activity)}
        {renderTabItem('Insights', 'Insights', BarChart2)}
        {renderTabItem('Chat', 'Chat', MessageSquare)}
        {renderTabItem('Profile', 'Profile', User)}
      </View>
    </SafeAreaView>
  );
}

function App(): React.JSX.Element {
  useEffect(() => {
    console.log("React Native root App component mounted!");
  }, []);

  return (
    <SafeAreaProvider style={{ flex: 1 }}>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  splashScreen: {
    flex: 1,
    backgroundColor: '#0B0F19', // Same as app background — seamless, no black flash
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0B0F19',
  },
  screenContainer: {
    flex: 1,
  },
  tabBar: {
    height: 74,
    flexDirection: 'row',
    backgroundColor: '#151E2E',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    paddingBottom: 8,
    paddingTop: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    paddingVertical: 4,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainerActive: {
    backgroundColor: 'rgba(0, 163, 255, 0.12)',
  },
  indicator: {
    width: 2,
    height: 5,
    backgroundColor: '#00A3FF',
    marginTop: 2,
    marginBottom: 2,
  },
  indicatorInactive: {
    width: 2,
    height: 5,
    backgroundColor: 'transparent',
    marginTop: 2,
    marginBottom: 2,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
  },
  tabLabelActive: {
    color: '#00A3FF',
    fontWeight: '700',
  },
});

export default App;
