import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { theme } from '../theme/theme';
import { apiService } from '../services/api';
import { useApp } from '../context/AppContext';
import { Sparkles, Activity, Shield, Eye, EyeOff } from 'lucide-react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import auth from '@react-native-firebase/auth';

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const { syncUser } = useApp();

  React.useEffect(() => {
    // Configure Google Sign-In with Web Client ID from Firebase Console / google-services.json
    // If you don't have google-services.json configured yet, GoogleSignin may throw an error.
    GoogleSignin.configure({
      webClientId: '884378357872-5at2o9mm72fr7otb7uo6lugp2lu44fnk.apps.googleusercontent.com', // Replace with your actual Web Client ID (client_type: 3 in google-services.json)
      offlineAccess: true,
    });
  }, []);
  
  const [isSignUp, setIsSignUp] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState<'name' | 'email' | 'password' | null>(null);

  const handleSignIn = async () => {
    if (isSignUp && !displayName.trim()) {
      Alert.alert('Validation Error', 'Please enter your display name.');
      return;
    }
    if (!email || !password) {
      Alert.alert('Validation Error', 'Please enter both email and password.');
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        const res = await apiService.signUp({
          displayName: displayName.trim(),
          email: email.trim(),
          password
        });
        if (res.success) {
          Alert.alert('Success', 'Registration successful. Please sign in with your credentials.');
          setIsSignUp(false);
          setPassword(''); // Clear password for safety and to prompt entry
        } else {
          Alert.alert('Registration Failed', res.message || 'Please try again.');
        }
      } else {
        const res = await apiService.signIn({
          email: email.trim(),
          password
        });
        if (res.success && res.data) {
          await syncUser({
            _id: res.data.uid,
            firebaseUid: res.data.uid,
            email: res.data.email,
            displayName: res.data.name,
            isPremium: res.data.isPremium ?? true
          });
          onLoginSuccess();
        } else {
          Alert.alert('Authentication Failed', res.message || 'Verification failed.');
        }
      }
    } catch (err: any) {
      Alert.alert(
        isSignUp ? 'Sign Up Failed' : 'Sign In Failed',
        err.response?.data?.message || err.message || 'Check connection to backend.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      // 1. Ensure Google Play Services are available (Android only)
      if (Platform.OS === 'android') {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      }

      // 2. Trigger Google Sign In flow
      const signInResult = await GoogleSignin.signIn();
      const idToken = signInResult.data?.idToken;

      if (!idToken) {
        throw new Error('No Google ID Token returned. Make sure webClientId is configured correctly.');
      }

      // 3. Authenticate with Firebase using Google Credentials
      const googleCredential = auth.GoogleAuthProvider.credential(idToken);
      const userCredential = await auth().signInWithCredential(googleCredential);

      // 4. Retrieve Firebase session ID token
      const firebaseIdToken = await userCredential.user.getIdToken();

      // 5. Save the real token and sync the profile with backend MongoDB
      await apiService.setFirebaseAuthToken(firebaseIdToken);

      await syncUser({
        _id: userCredential.user.uid,
        firebaseUid: userCredential.user.uid,
        email: userCredential.user.email || '',
        displayName: userCredential.user.displayName || 'Google User',
        isPremium: false // backend will compute & resolve real premium status from database
      });

      // Show success alert confirming the sign-in
      Alert.alert('Success', `Signed in successfully with Google as ${userCredential.user.displayName || userCredential.user.email}`);

      onLoginSuccess();
    } catch (err: any) {
      console.error('Google Sign-In Error:', err);
      // Give a helpful configuration hint if error indicates client configuration issues
      let friendlyMessage = err.message || 'An error occurred during authentication.';
      if (friendlyMessage.includes('DEVELOPER_ERROR') || friendlyMessage.includes('10:')) {
        friendlyMessage = 'Google configuration error (DEVELOPER_ERROR).\n\nPlease verify that:\n1. Your SHA-1 debug fingerprint is added to the Firebase Console.\n2. google-services.json matches your Firebase project.\n3. The webClientId in LoginScreen.tsx matches the Web client OAuth ID.';
      }
      Alert.alert('Google Sign In Failed', friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.keyboardContainer}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        
        {/* Brand App Icon & Logo Header */}
        <View style={styles.logoHeader}>
          <View style={styles.logoCircleContainer}>
            <View style={styles.logoPulseBg} />
            <Activity size={36} color={theme.colors.primary} />
            <Sparkles size={18} color={theme.colors.secondary} style={styles.sparkleIconAbsolute} />
          </View>
          <Text style={styles.appName}>Orlese</Text>
          <Text style={styles.subtitle}>Mind-Body Wellness & Migraine Intelligence</Text>
        </View>

        {/* Feature Badges Section */}
        <View style={styles.badgeContainer}>
          <View style={styles.badge}>
            <Sparkles size={12} color={theme.colors.secondary} />
            <Text style={styles.badgeText}>AI Forecasting</Text>
          </View>
          <View style={styles.badge}>
            <Activity size={12} color={theme.colors.primary} />
            <Text style={styles.badgeText}>Trigger Tracking</Text>
          </View>
          <View style={styles.badge}>
            <Shield size={12} color="#EF4444" />
            <Text style={styles.badgeText}>SOS Alerts</Text>
          </View>
        </View>

        {/* Sign In/Up Main Form Card */}
        <View style={styles.card}>
          <Text style={styles.cardHeaderTitle}>{isSignUp ? 'CREATE ACCOUNT' : 'WELCOME BACK'}</Text>
          
          {/* Display Name Input (Only for Sign Up) */}
          {isSignUp && (
            <TextInput
              style={[
                styles.input,
                focusedInput === 'name' && styles.inputFocused
              ]}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Display name"
              placeholderTextColor={theme.colors.textSubtle}
              autoCapitalize="words"
              autoCorrect={false}
              onFocus={() => setFocusedInput('name')}
              onBlur={() => setFocusedInput(null)}
            />
          )}

          {/* Email Address Input */}
          <TextInput
            style={[
              styles.input,
              focusedInput === 'email' && styles.inputFocused
            ]}
            value={email}
            onChangeText={setEmail}
            placeholder="Email address"
            placeholderTextColor={theme.colors.textSubtle}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
            onFocus={() => setFocusedInput('email')}
            onBlur={() => setFocusedInput(null)}
          />

          {/* Password Input with eye toggle */}
          <View style={[
            styles.passwordInputContainer,
            focusedInput === 'password' && styles.inputFocused
          ]}>
            <TextInput
              style={styles.passwordInput}
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor={theme.colors.textSubtle}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              onFocus={() => setFocusedInput('password')}
              onBlur={() => setFocusedInput(null)}
            />
            <TouchableOpacity 
              style={styles.eyeBtn}
              onPress={() => setShowPassword(!showPassword)}
              activeOpacity={0.7}
            >
              {showPassword ? (
                <EyeOff size={18} color={theme.colors.textMuted} />
              ) : (
                <Eye size={18} color={theme.colors.textMuted} />
              )}
            </TouchableOpacity>
          </View>

          {/* Primary Action Button */}
          <TouchableOpacity
            style={styles.signInBtn}
            onPress={handleSignIn}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#0B0F19" />
            ) : (
              <Text style={styles.signInBtnText}>{isSignUp ? 'Create Account' : 'Sign In'}</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Continue with Google button */}
        <TouchableOpacity
          style={styles.googleBtn}
          onPress={handleGoogleSignIn}
          disabled={loading}
          activeOpacity={0.9}
        >
          <View style={styles.googleIconContainer}>
            <Svg width="18" height="18" viewBox="0 0 24 24">
              <Path
                fill="#EA4335"
                d="M12 5.04c1.9 0 3.6.7 4.9 1.9l3.7-3.7C18.2 1.2 15.3 0 12 0 7.3 0 3.3 2.7 1.3 6.6l4.2 3.2c1-3 3.9-4.8 6.5-4.8z"
              />
              <Path
                fill="#4285F4"
                d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.7z"
              />
              <Path
                fill="#FBBC05"
                d="M5.5 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.3 7C.5 8.5 0 10.2 0 12s.5 3.5 1.3 5l4.2-3.2z"
              />
              <Path
                fill="#34A853"
                d="M12 24c3.2 0 6-1.1 8-2.9l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.6 0-6.7-2.5-7.8-5.8l-4.2 3.2C3.3 21.3 7.3 24 12 24z"
              />
            </Svg>
          </View>
          <Text style={styles.googleBtnText}>Continue with Google</Text>
        </TouchableOpacity>

        {/* Mode Toggle Navigation Link */}
        <View style={styles.toggleModeContainer}>
          <Text style={styles.toggleModeText}>
            {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
          </Text>
          <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)} activeOpacity={0.7}>
            <Text style={styles.toggleModeAction}>
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  container: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 40,
    alignItems: 'center',
  },
  logoHeader: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoCircleContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(99, 102, 241, 0.25)',
    marginBottom: 20,
    position: 'relative',
  },
  logoPulseBg: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 40,
    backgroundColor: 'rgba(99, 102, 241, 0.04)',
    transform: [{ scale: 1.25 }],
  },
  sparkleIconAbsolute: {
    position: 'absolute',
    top: -2,
    right: -2,
  },
  appName: {
    fontSize: 32,
    fontWeight: '900',
    color: theme.colors.text,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 13,
    color: theme.colors.textMuted,
    marginTop: 6,
    fontWeight: '500',
    textAlign: 'center',
  },
  badgeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 36,
    width: '100%',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.06)',
    borderColor: 'rgba(99, 102, 241, 0.2)',
    borderWidth: 1,
    borderRadius: 9999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 6,
  },
  badgeText: {
    color: theme.colors.text,
    fontSize: 11,
    fontWeight: '600',
  },
  card: {
    width: '100%',
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  cardHeaderTitle: {
    color: theme.colors.secondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 20,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    color: theme.colors.text,
    fontSize: 14,
    marginBottom: 14,
    height: 52,
  },
  inputFocused: {
    borderColor: theme.colors.primary,
  },
  passwordInputContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
    height: 52,
  },
  passwordInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 16,
    color: theme.colors.text,
    fontSize: 14,
  },
  eyeBtn: {
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  },
  signInBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  signInBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  googleBtn: {
    width: '100%',
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    gap: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  googleIconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  googleBtnText: {
    color: '#151E2E',
    fontWeight: '700',
    fontSize: 15,
  },
  toggleModeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  toggleModeText: {
    color: theme.colors.textSubtle,
    fontSize: 14,
    fontWeight: '500',
  },
  toggleModeAction: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
});
