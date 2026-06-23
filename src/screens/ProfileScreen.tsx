import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { theme } from '../theme/theme';
import { apiService } from '../services/api';
import { useApp } from '../context/AppContext';
import {
  User,
  Plus,
  Phone,
  ShieldAlert,
  Bell,
  Lock,
  HelpCircle,
  LogOut,
  ChevronRight,
  Crown,
  Check,
  Trash2,
  Settings,
  Server,
  Shield
} from 'lucide-react-native';

interface ProfileScreenProps {
  onLogout?: () => void;
  navigation?: any;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ onLogout, navigation }) => {
  const { user, syncUser, updatePremiumStatus } = useApp();

  // Developer settings states
  const [showDevPanel, setShowDevPanel] = useState(false);
  const [serverUrl, setServerUrl] = useState('');
  const [devProfile, setDevProfile] = useState({ uid: '', email: '', name: '' });
  const [testingConnection, setTestingConnection] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // Focus states for inputs
  const [focusedContactName, setFocusedContactName] = useState(false);
  const [focusedContactPhone, setFocusedContactPhone] = useState(false);
  const [focusedServerUrl, setFocusedServerUrl] = useState(false);
  const [focusedDevUid, setFocusedDevUid] = useState(false);
  const [focusedDevEmail, setFocusedDevEmail] = useState(false);
  const [focusedDevName, setFocusedDevName] = useState(false);
  const [focusedContactEmail, setFocusedContactEmail] = useState(false);

  // Emergency contacts states
  const [contacts, setContacts] = useState<any[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [newContactRelation, setNewContactRelation] = useState('Mom');
  const [submittingContact, setSubmittingContact] = useState(false);

  // Load initial settings and contacts
  const loadProfileAndContacts = async () => {
    try {
      const url = await apiService.getBaseUrl();
      const prof = await apiService.getMockProfile();
      setServerUrl(url);
      setDevProfile(prof);
      
      // Load contacts
      fetchContacts();
    } catch (err) {
      console.warn('Failed to load settings or contacts:', err);
    }
  };

  const fetchContacts = async () => {
    setLoadingContacts(true);
    try {
      const res = await apiService.getContacts();
      if (res.success && res.data) {
        setContacts(res.data);
      }
    } catch (err) {
      console.warn('Failed to fetch emergency contacts:', err);
    } finally {
      setLoadingContacts(false);
    }
  };

  useEffect(() => {
    loadProfileAndContacts();
  }, []);

  // Developer connection testing
  const handleTestConnection = async () => {
    setTestingConnection(true);
    try {
      const response = await fetch(`${serverUrl}/health`);
      const data = await response.json();
      if (data && data.status === 'OK') {
        Alert.alert('Success', 'Connection to Auracast server successful!');
      } else {
        Alert.alert('Error', 'Server responded but status was not OK.');
      }
    } catch (err: any) {
      Alert.alert(
        'Connection Failed',
        `Cannot connect to ${serverUrl}. Make sure your backend server is running.\n\nError: ${err.message}`
      );
    } finally {
      setTestingConnection(false);
    }
  };

  // Developer config saving
  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await apiService.setBaseUrl(serverUrl);
      await apiService.setMockProfile(devProfile.uid, devProfile.email, devProfile.name);
      await syncUser();
      Alert.alert('Success', 'Configuration saved successfully!');
    } catch (err) {
      Alert.alert('Error', 'Failed to save settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  // Premium Subscription trigger
  const handleSubscribe = async () => {
    try {
      const res = await apiService.subscribePremium();
      if (res.success) {
        updatePremiumStatus(true);
        Alert.alert('VIP Premium Status', 'Thank you for subscribing! Premium features are now unlocked.');
      }
    } catch (err: any) {
      Alert.alert('Subscription Failed', err.response?.data?.message || err.message);
    }
  };

  // Add contact trigger
  const handleAddContact = async () => {
    if (!newContactName.trim() || !newContactPhone.trim() || !newContactEmail.trim()) {
      Alert.alert('Validation Error', 'Name, Phone Number, and Email Address are required.');
      return;
    }

    setSubmittingContact(true);
    try {
      const res = await apiService.addContact({
        name: newContactName.trim(),
        relationship: newContactRelation,
        phoneNumber: newContactPhone.trim(),
        email: newContactEmail.trim()
      });
      if (res.success) {
        Alert.alert('Success', 'Emergency contact added successfully.');
        setNewContactName('');
        setNewContactPhone('');
        setNewContactEmail('');
        setNewContactRelation('Mom');
        setShowAddForm(false);
        fetchContacts();
      }
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to add contact.');
    } finally {
      setSubmittingContact(false);
    }
  };

  // Delete contact trigger
  const handleDeleteContact = async (contactId: string) => {
    Alert.alert(
      'Delete Contact',
      'Are you sure you want to remove this emergency contact?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await apiService.deleteContact(contactId);
              if (res.success) {
                fetchContacts();
              }
            } catch (err: any) {
              Alert.alert('Error', 'Failed to remove contact.');
            }
          },
        },
      ]
    );
  };

  // Get Initials from Name
  const getInitials = (nameStr: string) => {
    if (!nameStr) return 'SJ';
    const parts = nameStr.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Title Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
      </View>

      {/* 1. User Profile Details Card */}
      <View style={styles.profileCard}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>{getInitials(user?.displayName || 'Sarah Johnson')}</Text>
        </View>
        <View style={styles.profileMeta}>
          <Text style={styles.profileName}>{user?.displayName || 'Sarah Johnson'}</Text>
          <Text style={styles.profileEmail}>{user?.email || 'sarah@example.com'}</Text>
          
          <View style={styles.planBadgeContainer}>
            <View style={[styles.planBadge, user?.isPremium ? styles.planPremium : styles.planFree]}>
              <Text style={styles.planBadgeText}>
                {user?.isPremium ? '👑 PREMIUM' : '👑 FREE PLAN'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* 2. Upgrade Banner Card (Only visible if Free) */}
      {!user?.isPremium && (
        <View style={styles.upgradeCard}>
          <View style={styles.upgradeHeaderRow}>
            <View>
              <Text style={styles.upgradeTitle}>Upgrade to Premium</Text>
              <Text style={styles.upgradeSubtitle}>Unlock AI predictions & more</Text>
            </View>
            <Crown size={22} color="#F59E0B" fill="#F59E0B" />
          </View>

          {/* Bullet Grid */}
          <View style={styles.upgradeFeaturesGrid}>
            <View style={styles.featureItem}>
              <Text style={styles.featureBullet}>✦</Text>
              <Text style={styles.featureText}>Daily predictions</Text>
            </View>
            <View style={styles.featureItem}>
              <Text style={styles.featureBullet}>✦</Text>
              <Text style={styles.featureText}>AI patterns</Text>
            </View>
            <View style={styles.featureItem}>
              <Text style={styles.featureBullet}>✦</Text>
              <Text style={styles.featureText}>SOS alerts</Text>
            </View>
            <View style={styles.featureItem}>
              <Text style={styles.featureBullet}>✦</Text>
              <Text style={styles.featureText}>Weekly reports</Text>
            </View>
          </View>

          {/* Subscribe Button */}
          <TouchableOpacity style={styles.upgradeBtn} onPress={handleSubscribe}>
            <Text style={styles.upgradeBtnText}>Upgrade — ₹199/month</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 3. Emergency Contacts Card */}
      <View style={styles.card}>
        <View style={styles.contactsCardHeader}>
          <Text style={styles.contactsTitle}>Emergency Contacts</Text>
          <TouchableOpacity onPress={() => setShowAddForm(!showAddForm)}>
            <Text style={styles.addContactLink}>+ Add</Text>
          </TouchableOpacity>
        </View>

        {/* Add Contact Form Inline */}
        {showAddForm && (
          <View style={styles.addContactForm}>
            <Text style={styles.formGroupLabel}>Contact Name</Text>
            <TextInput
              style={[styles.formInput, focusedContactName && styles.formInputFocused]}
              onFocus={() => setFocusedContactName(true)}
              onBlur={() => setFocusedContactName(false)}
              value={newContactName}
              onChangeText={setNewContactName}
              placeholder="Full Name"
              placeholderTextColor="#64748B"
            />
            <Text style={styles.formGroupLabel}>Phone Number</Text>
            <TextInput
              style={[styles.formInput, focusedContactPhone && styles.formInputFocused]}
              onFocus={() => setFocusedContactPhone(true)}
              onBlur={() => setFocusedContactPhone(false)}
              value={newContactPhone}
              onChangeText={setNewContactPhone}
              placeholder="+91 XXXXX XXXXX"
              placeholderTextColor="#64748B"
              keyboardType="phone-pad"
            />
            <Text style={styles.formGroupLabel}>Email Address</Text>
            <TextInput
              style={[styles.formInput, focusedContactEmail && styles.formInputFocused]}
              onFocus={() => setFocusedContactEmail(true)}
              onBlur={() => setFocusedContactEmail(false)}
              value={newContactEmail}
              onChangeText={setNewContactEmail}
              placeholder="emergency@example.com"
              placeholderTextColor="#64748B"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Text style={styles.formGroupLabel}>Relationship</Text>
            <View style={styles.relationshipRow}>
              {['Mom', 'Spouse', 'Friend', 'Doctor'].map((rel) => (
                <TouchableOpacity
                  key={rel}
                  style={[
                    styles.relationBtn,
                    newContactRelation === rel ? styles.relationBtnActive : null,
                  ]}
                  onPress={() => setNewContactRelation(rel)}
                >
                  <Text
                    style={[
                      styles.relationBtnText,
                      newContactRelation === rel ? styles.relationBtnTextActive : null,
                    ]}
                  >
                    {rel}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.formActionsRow}>
              <TouchableOpacity
                style={[styles.formBtn, styles.formBtnCancel]}
                onPress={() => setShowAddForm(false)}
              >
                <Text style={styles.formBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.formBtn, styles.formBtnSave]}
                onPress={handleAddContact}
                disabled={submittingContact}
              >
                {submittingContact ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.formBtnSaveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Contacts List */}
        <View style={styles.contactsList}>
          {loadingContacts && contacts.length === 0 ? (
            <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginVertical: 12 }} />
          ) : contacts.length === 0 ? (
            <Text style={styles.emptyContactsText}>No emergency contacts added yet.</Text>
          ) : (
            contacts.map((contact) => (
              <View key={contact._id} style={styles.contactRow}>
                <View style={styles.contactAvatar}>
                  <Text style={styles.contactAvatarText}>{getInitials(contact.name)}</Text>
                </View>
                <View style={styles.contactMeta}>
                  <Text style={styles.contactName}>{contact.name}</Text>
                  <Text style={styles.contactDetail}>
                    {contact.relationship} · {contact.phoneNumber}
                  </Text>
                  <Text style={styles.contactDetail}>
                    {contact.email}
                  </Text>
                </View>
                <View style={styles.contactActionRow}>
                  <TouchableOpacity style={styles.callIconBtn}>
                    <Phone size={15} color="#94A3B8" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteIconBtn}
                    onPress={() => handleDeleteContact(contact._id)}
                  >
                    <Trash2 size={15} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </View>

      {/* 4. SOS Mode Info Card */}
      <View style={styles.sosInfoCard}>
        <View style={styles.sosIconContainer}>
          <ShieldAlert size={18} color="#EF4444" />
        </View>
        <View style={styles.sosMeta}>
          <Text style={styles.sosTitle}>SOS Mode</Text>
          <Text style={styles.sosDesc}>
            During a severe episode, the SOS button on your dashboard instantly notifies your emergency contacts.
          </Text>
        </View>
      </View>

      {/* 5. Settings List Row items */}
      <Text style={styles.settingsSectionTitle}>SETTINGS</Text>
      
      <View style={styles.settingsList}>
        {/* Row 1: Notifications */}
        <TouchableOpacity 
          style={styles.settingsRow}
          onPress={() => navigation?.navigate('Notifications')}
        >
          <View style={styles.settingsRowLeft}>
            <Bell size={18} color={theme.colors.primary} />
            <Text style={styles.settingsLabel}>Notifications</Text>
          </View>
          <ChevronRight size={16} color="#64748B" />
        </TouchableOpacity>

        {/* Row 2: Sign Out */}
        {onLogout && (
          <TouchableOpacity style={styles.settingsRow} onPress={onLogout}>
            <View style={styles.settingsRowLeft}>
              <LogOut size={18} color="#EF4444" />
              <Text style={[styles.settingsLabel, { color: '#EF4444' }]}>Sign Out</Text>
            </View>
            <ChevronRight size={16} color="#EF4444" />
          </TouchableOpacity>
        )}
      </View>

      {/* Collapsible Developer Console Settings */}
      <TouchableOpacity
        style={styles.devCollapseBtn}
        onPress={() => setShowDevPanel(!showDevPanel)}
      >
        <Settings size={14} color="#64748B" />
        <Text style={styles.devCollapseText}>
          {showDevPanel ? 'Hide Developer Settings' : 'Show Developer Settings'}
        </Text>
      </TouchableOpacity>

      {showDevPanel && (
        <View style={styles.devCard}>
          <View style={styles.cardHeader}>
            <Server size={18} color={theme.colors.primary} />
            <Text style={styles.devCardTitle}>Backend Server Connection</Text>
          </View>
          
          <Text style={styles.devLabel}>Server Base URL</Text>
          <TextInput
            style={[styles.devInput, focusedServerUrl && styles.devInputFocused]}
            onFocus={() => setFocusedServerUrl(true)}
            onBlur={() => setFocusedServerUrl(false)}
            value={serverUrl}
            onChangeText={setServerUrl}
            placeholder="http://10.0.2.2:5000/api"
            placeholderTextColor="#64748B"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={styles.devOutlineBtn}
            onPress={handleTestConnection}
            disabled={testingConnection}
          >
            {testingConnection ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <Text style={styles.devOutlineBtnText}>Test Connection</Text>
            )}
          </TouchableOpacity>

          <View style={[styles.cardHeader, { marginTop: 20 }]}>
            <Shield size={18} color={theme.colors.primary} />
            <Text style={styles.devCardTitle}>Simulate Firebase User</Text>
          </View>

          <Text style={styles.devLabel}>Firebase User UID</Text>
          <TextInput
            style={[styles.devInput, focusedDevUid && styles.devInputFocused]}
            onFocus={() => setFocusedDevUid(true)}
            onBlur={() => setFocusedDevUid(false)}
            value={devProfile.uid}
            onChangeText={(text) => setDevProfile({ ...devProfile, uid: text })}
            placeholder="e.g. dev_mock_user_123"
            placeholderTextColor="#64748B"
          />

          <Text style={styles.devLabel}>Email Address</Text>
          <TextInput
            style={[styles.devInput, focusedDevEmail && styles.devInputFocused]}
            onFocus={() => setFocusedDevEmail(true)}
            onBlur={() => setFocusedDevEmail(false)}
            value={devProfile.email}
            onChangeText={(text) => setDevProfile({ ...devProfile, email: text })}
            placeholder="e.g. patient@example.com"
            placeholderTextColor="#64748B"
            keyboardType="email-address"
          />

          <Text style={styles.devLabel}>Display Name</Text>
          <TextInput
            style={[styles.devInput, focusedDevName && styles.devInputFocused]}
            onFocus={() => setFocusedDevName(true)}
            onBlur={() => setFocusedDevName(false)}
            value={devProfile.name}
            onChangeText={(text) => setDevProfile({ ...devProfile, name: text })}
            placeholder="e.g. Sarah Johnson"
            placeholderTextColor="#64748B"
          />

          <TouchableOpacity
            style={styles.devSaveBtn}
            onPress={handleSaveSettings}
            disabled={savingSettings}
          >
            {savingSettings ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.devSaveBtnText}>Save & Apply Config</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 48,
  },
  header: {
    marginTop: 8,
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#F8FAFC',
  },
  profileCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  profileMeta: {
    flex: 1,
    marginLeft: 16,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  profileEmail: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  planBadgeContainer: {
    flexDirection: 'row',
    marginTop: 8,
  },
  planBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  planPremium: {
    backgroundColor: 'rgba(245, 158, 11, 0.05)',
    borderColor: '#F59E0B',
  },
  planFree: {
    backgroundColor: 'rgba(245, 158, 11, 0.05)',
    borderColor: '#F59E0B',
  },
  planBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#F59E0B',
  },
  upgradeCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 20,
    marginBottom: 16,
  },
  upgradeHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  upgradeTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  upgradeSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  upgradeFeaturesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.15)',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  featureBullet: {
    color: theme.colors.primary,
    marginRight: 4,
    fontSize: 11,
  },
  featureText: {
    color: theme.colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  upgradeBtn: {
    height: 48,
    borderRadius: 16,
    backgroundColor: theme.colors.risk.medium,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.colors.risk.medium,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  upgradeBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 20,
    marginBottom: 16,
  },
  contactsCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  contactsTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  addContactLink: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '800',
  },
  contactsList: {
    gap: 12,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    padding: 12,
  },
  contactAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactAvatarText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94A3B8',
  },
  contactMeta: {
    flex: 1,
    marginLeft: 12,
  },
  contactName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  contactDetail: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
    fontWeight: '500',
  },
  contactActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  callIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(239,68,68,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContactsText: {
    color: '#64748B',
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 12,
  },
  
  // Add Contact Form Styles
  addContactForm: {
    backgroundColor: theme.colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    marginBottom: 16,
  },
  formGroupLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  formInput: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    color: '#F8FAFC',
    fontSize: 13,
    marginBottom: 12,
  },
  formInputFocused: {
    borderColor: theme.colors.primary,
  },
  relationshipRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  relationBtn: {
    flex: 1,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E293B',
    backgroundColor: '#151E2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  relationBtnActive: {
    borderColor: theme.colors.primary,
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
  },
  relationBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  relationBtnTextActive: {
    color: theme.colors.primary,
  },
  formActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  formBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formBtnCancel: {
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  formBtnCancelText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '800',
  },
  formBtnSave: {
    backgroundColor: theme.colors.primary,
  },
  formBtnSaveText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },

  // SOS Mode Info Card
  sosInfoCard: {
    backgroundColor: 'rgba(239, 68, 68, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 24,
    padding: 20,
    flexDirection: 'row',
    marginBottom: 24,
    alignItems: 'center',
  },
  sosIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosMeta: {
    flex: 1,
    marginLeft: 16,
  },
  sosTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#EF4444',
  },
  sosDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
    marginTop: 4,
    fontWeight: '500',
  },

  // Settings List Styles
  settingsSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  settingsList: {
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 8,
    marginBottom: 24,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  settingsRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingsLabel: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },

  // Collapsible Developer Console Settings
  devCollapseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginBottom: 16,
  },
  devCollapseText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
  },
  devCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 20,
    marginBottom: 24,
  },
  devCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#F8FAFC',
    marginLeft: 8,
  },
  devLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    marginTop: 12,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  devInput: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    color: '#F8FAFC',
    fontSize: 13,
    height: 40,
    marginBottom: 8,
  },
  devInputFocused: {
    borderColor: theme.colors.primary,
  },
  devOutlineBtn: {
    height: 38,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    backgroundColor: 'rgba(99, 102, 241, 0.03)',
  },
  devOutlineBtnText: {
    color: theme.colors.primary,
    fontWeight: '800',
    fontSize: 12,
  },
  devSaveBtn: {
    height: 44,
    borderRadius: 12,
    backgroundColor: theme.colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    shadowColor: theme.colors.secondary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  devSaveBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
