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
  Linking,
} from 'react-native';
import { theme } from '../theme/theme';
import { apiService } from '../services/api';
import { useApp } from '../context/AppContext';
import { ShieldAlert, Plus, Trash2, Lock, Sparkles, Send } from 'lucide-react-native';

export const SOSScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user } = useApp();

  const [loading, setLoading] = useState(true);
  const [triggeringSOS, setTriggeringSOS] = useState(false);
  const [addingContact, setAddingContact] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);

  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const res = await apiService.getContacts();
      if (res.success) {
        setContacts(res.data);
      }
    } catch (err) {
      console.warn("Failed to load emergency contacts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, [user?.isPremium]);

  const handleAddContact = async () => {
    if (!name.trim() || !phoneNumber.trim() || !email.trim()) {
      Alert.alert('Validation Error', 'Contact name, phone number, and email are required.');
      return;
    }
    setAddingContact(true);
    try {
      const res = await apiService.addContact({
        name: name.trim(),
        relationship: relationship.trim(),
        phoneNumber: phoneNumber.trim(),
        email: email.trim()
      });
      if (res.success) {
        Alert.alert('Success', 'Emergency contact added successfully.');
        setName('');
        setRelationship('');
        setPhoneNumber('');
        setEmail('');
        fetchContacts();
      }
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to add contact.');
    } finally {
      setAddingContact(false);
    }
  };

  const handleDeleteContact = async (id: string) => {
    Alert.alert(
      'Delete Contact',
      'Are you sure you want to remove this emergency contact?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await apiService.deleteContact(id);
              if (res.success) {
                Alert.alert('Deleted', 'Contact has been removed.');
                fetchContacts();
              }
            } catch (err: any) {
              Alert.alert('Error', err.response?.data?.message || 'Failed to delete contact.');
            }
          }
        }
      ]
    );
  };

  const handleTriggerSOS = async () => {
    if (contacts.length === 0) {
      Alert.alert('No Contacts', 'Please add at least one emergency contact before triggering SOS.');
      return;
    }

    Alert.alert(
      'Trigger Emergency SOS',
      'Choose how you want to contact your emergency contacts for free via your carrier.',
      [
        {
          text: 'Auto-Email',
          onPress: async () => {
            setTriggeringSOS(true);
            try {
              const res = await apiService.triggerSOS();
              if (res.success) {
                Alert.alert(
                  '🚨 Emails Dispatched',
                  `Automated distress emails sent to ${res.alertedCount} contacts: ${res.contactsAlerted.join(', ')}.`
                );
              }
            } catch (err: any) {
              Alert.alert('SOS Error', err.response?.data?.message || 'Failed to trigger SOS email broadcast.');
            } finally {
              setTriggeringSOS(false);
            }
          }
        },
        {
          text: 'Text All',
          onPress: () => {
            const numSeparator = Platform.OS === 'ios' ? ',' : ';';
            const bodySeparator = Platform.OS === 'ios' ? '&' : '?';
            const numbers = contacts.map(c => c.phoneNumber).join(numSeparator);
            const url = `sms:${numbers}${bodySeparator}body=${encodeURIComponent("Emergency SOS: I am having a severe migraine and need immediate help!")}`;
            
            Linking.openURL(url).catch(() => {
              Alert.alert('Error', 'Could not open the messaging app. Please try calling instead.');
            });
          }
        },
        {
          text: 'Call Primary',
          style: 'cancel',
          onPress: () => {
            Linking.openURL(`tel:${contacts[0].phoneNumber}`).catch(() => {
              Alert.alert('Error', 'Could not open the dialer.');
            });
          }
        }
      ]
    );
  };

  const renderContent = () => {

    return (
      <View style={styles.sosContent}>
        {/* BIG RED SOS BUTTON */}
        <View style={styles.buttonCard}>
          <TouchableOpacity
            style={[styles.sosBtn, triggeringSOS ? styles.sosBtnTriggering : null]}
            onPress={handleTriggerSOS}
            disabled={triggeringSOS}
          >
            {triggeringSOS ? (
              <ActivityIndicator size="large" color={theme.colors.text} />
            ) : (
              <>
                <ShieldAlert size={48} color={theme.colors.text} />
                <Text style={styles.sosBtnText}>TRIGGER SOS</Text>
                <Text style={styles.sosBtnSubText}>Tap to alert contacts</Text>
              </>
            )}
          </TouchableOpacity>
          <Text style={styles.sosDisclaimer}>
            Tapping the SOS button will let you instantly Auto-Email, Call, or Text your emergency contacts.
          </Text>
        </View>

        {/* ADD CONTACT SECTION */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Add Emergency Contact</Text>

          <Text style={styles.label}>Contact Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Jane Doe"
            placeholderTextColor={theme.colors.textSubtle}
          />

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Relationship</Text>
              <TextInput
                style={styles.input}
                value={relationship}
                onChangeText={setRelationship}
                placeholder="e.g. Spouse"
                placeholderTextColor={theme.colors.textSubtle}
              />
            </View>
            <View style={{ flex: 1.5 }}>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={styles.input}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                placeholder="e.g. +91 9876543210"
                placeholderTextColor={theme.colors.textSubtle}
                keyboardType="phone-pad"
              />
            </View>
          </View>
          
          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="e.g. emergency@example.com"
            placeholderTextColor={theme.colors.textSubtle}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <TouchableOpacity
            style={styles.addContactBtn}
            onPress={handleAddContact}
            disabled={addingContact}
          >
            {addingContact ? (
              <ActivityIndicator size="small" color={theme.colors.background} />
            ) : (
              <>
                <Plus size={16} color={theme.colors.background} />
                <Text style={styles.addContactBtnText}>Save Trusted Contact</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* LIST CONTACTS SECTION */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Your Trusted Contacts ({contacts.length})</Text>

          {loading ? (
            <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginVertical: 10 }} />
          ) : contacts.length === 0 ? (
            <Text style={styles.emptyText}>No trusted contacts saved. Add some above to enable SOS broadcasts.</Text>
          ) : (
            <View style={styles.contactsList}>
              {contacts.map((contact, index) => (
                <View key={contact._id || index} style={styles.contactItem}>
                  <View>
                    <Text style={styles.contactNameText}>{contact.name}</Text>
                    <Text style={styles.contactSubText}>
                      {contact.relationship ? `${contact.relationship} • ` : ''}{contact.phoneNumber}
                    </Text>
                    <Text style={styles.contactSubText}>
                      {contact.email}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDeleteContact(contact._id)}
                  >
                    <Trash2 size={16} color={theme.colors.risk.high} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <ShieldAlert size={28} color={theme.colors.risk.high} />
        <Text style={styles.title}>SOS Helper</Text>
        <Text style={styles.subtitle}>Direct emergency broadcasting channel for critical pain episodes</Text>
      </View>

      {renderContent()}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl * 2,
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
    marginTop: theme.spacing.sm,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginTop: theme.spacing.sm,
  },
  subtitle: {
    fontSize: 13,
    color: theme.colors.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },
  lockedContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    alignItems: 'center',
  },
  lockIcon: {
    marginBottom: theme.spacing.md,
  },
  lockedTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  lockedDescription: {
    fontSize: 13,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: theme.spacing.lg,
  },
  lockedPreviewCard: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.01)',
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    alignItems: 'center',
    gap: 12,
    marginBottom: theme.spacing.lg,
  },
  sosButtonMock: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: theme.colors.textSubtle,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    opacity: 0.3,
  },
  sosButtonMockText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.textSubtle,
  },
  lockedPreviewTeaser: {
    color: theme.colors.textSubtle,
    fontSize: 11,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  unlockBtn: {
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: theme.borderRadius.sm,
    gap: 10,
    width: '100%',
    justifyContent: 'center',
  },
  unlockBtnText: {
    color: theme.colors.background,
    fontWeight: '700',
    fontSize: 14,
  },
  sosContent: {
    gap: theme.spacing.lg,
  },
  buttonCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    alignItems: 'center',
  },
  sosBtn: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: theme.colors.risk.high,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: theme.colors.risk.high,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 5,
    marginBottom: theme.spacing.md,
  },
  sosBtnTriggering: {
    opacity: 0.6,
  },
  sosBtnText: {
    fontSize: 18,
    fontWeight: '900',
    color: theme.colors.text,
  },
  sosBtnSubText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.8)',
    textTransform: 'uppercase',
  },
  sosDisclaimer: {
    fontSize: 11,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 15,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.colors.textMuted,
    marginBottom: 6,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.sm,
    color: theme.colors.text,
    fontSize: 14,
    marginBottom: theme.spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  addContactBtn: {
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: theme.borderRadius.sm,
    gap: 8,
    marginTop: theme.spacing.xs,
  },
  addContactBtnText: {
    color: theme.colors.background,
    fontWeight: '700',
    fontSize: 13,
  },
  emptyText: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: theme.spacing.md,
  },
  contactsList: {
    gap: 10,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.sm,
  },
  contactNameText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
  },
  contactSubText: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  deleteBtn: {
    padding: 8,
  }
});
