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
  PermissionsAndroid,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { theme } from '../theme/theme';
import { apiService } from '../services/api';
import { useApp } from '../context/AppContext';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import { 
  Mic, 
  MicOff, 
  Check, 
  Calendar, 
  Clock, 
  Smile, 
  FileText, 
  ChevronLeft, 
  Info,
  Sliders,
  AlertCircle
} from 'lucide-react-native';

const SYMPTOM_OPTIONS = [
  'Aura', 'Nausea', 'Vomiting', 'Light Sensitivity', 'Sound Sensitivity', 'Dizziness', 'Blurred Vision'
];

// Use singleton instance directly
const audioRecorderPlayer = AudioRecorderPlayer;

export const JournalScreen: React.FC = () => {
  const { triggerRefresh, refreshTrigger, addNotification, notifications, dismissNotification, dismissedIds, user } = useApp();
  const journalNotif = notifications && notifications.find(n => n.category === 'journal' && !dismissedIds.includes(n.id));

  const [showLogForm, setShowLogForm] = useState(false);
  const [focusedInput, setFocusedInput] = useState<'date' | 'startTime' | 'endTime' | 'notes' | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [submittingLog, setSubmittingLog] = useState(false);
  const [processingVoice, setProcessingVoice] = useState(false);

  const [history, setHistory] = useState<any[]>([]);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState('00:00');
  const [audioPath, setAudioPath] = useState('');
  const [transcription, setTranscription] = useState('');

  // Form inputs
  const getTodayDateStr = () => {
    const d = new Date();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
  };

  const getCurrentTimeStr = () => {
    const d = new Date();
    const hrs = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${hrs}:${mins}`;
  };

  const [date, setDate] = useState(getTodayDateStr());
  const [startTime, setStartTime] = useState(getCurrentTimeStr());
  const [endTime, setEndTime] = useState('');
  const [painSeverity, setPainSeverity] = useState(5);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  const fetchHistory = async (showLoader = false) => {
    try {
      if (showLoader) setLoadingHistory(true);
      const res = await apiService.getMigraineHistory();
      if (res.success && res.data) {
        setHistory(res.data);
        // Cache for instant next load
        if (user?._id) {
          AsyncStorage.setItem(`@auracast_journal_history_${user._id}`, JSON.stringify(res.data)).catch(() => {});
        }
      }
    } catch (err) {
      console.warn('Failed to fetch migraine history in background:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Load cached journal history instantly, then refresh from network
  useEffect(() => {
    const loadCachedThenFetch = async () => {
      if (user?._id) {
        try {
          const cached = await AsyncStorage.getItem(`@auracast_journal_history_${user._id}`);
          if (cached) {
            setHistory(JSON.parse(cached));
            setLoadingHistory(false); // Show cached data immediately
          }
        } catch {}
      }
      // Always fetch fresh in background
      fetchHistory(false);
    };
    loadCachedThenFetch();
  }, [user?._id, refreshTrigger]);

  const startRecording = async () => {
    // Request microphone permission at runtime on Android
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Microphone Permission',
            message: 'Orlese needs access to your microphone so you can log migraines using your voice.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert('Permission Denied', 'Microphone access is required to use voice logging.');
          return;
        }
      } catch (err) {
        console.warn('Failed to request microphone permission:', err);
        return;
      }
    }

    try {
      setIsRecording(true);
      setRecordTime('00:00');
      const result = await audioRecorderPlayer.startRecorder(undefined);
      
      audioRecorderPlayer.addRecordBackListener((e) => {
        setRecordTime(
          audioRecorderPlayer.mmssss(
            Math.floor(e.currentPosition)
          ).slice(0, 5) // mm:ss
        );
      });
      console.log('Recording started at path:', result);
      setAudioPath(result);
    } catch (err) {
      console.error('Start record error:', err);
      setIsRecording(false);
      Alert.alert('Microphone Access', 'Could not access device microphone. Try the simulated input below for testing.');
    }
  };

  const stopRecordingAndProcess = async () => {
    try {
      setIsRecording(false);
      const result = await audioRecorderPlayer.stopRecorder();
      audioRecorderPlayer.removeRecordBackListener();
      
      console.log('Recording stopped at path:', result);
      handleProcessAudio(result);
    } catch (err) {
      console.error('Stop record error:', err);
    }
  };

  const handleProcessAudio = async (uri: string) => {
    setProcessingVoice(true);
    try {
      const res = await apiService.uploadVoiceLog(uri);
      if (res.success && res.data) {
        setTranscription(res.data.transcription);
        const fields = res.data.parsedFields;
        
        setDate(fields.date || date);
        setStartTime(fields.startTime || startTime);
        if (fields.endTime) setEndTime(fields.endTime);
        if (fields.painSeverity) setPainSeverity(fields.painSeverity);
        if (fields.symptoms) setSelectedSymptoms(fields.symptoms);
        if (fields.notes) setNotes(fields.notes);
        
        Alert.alert('Voice Parsed', 'Auto-filled migraine log based on your speech. Please review the details below.');
      }
    } catch (err: any) {
      Alert.alert('Speech parsing failed', err.response?.data?.message || err.message);
    } finally {
      setProcessingVoice(false);
    }
  };

  // Safe Simulated STT triggering
  const handleSimulatedSpeech = async () => {
    setProcessingVoice(true);
    try {
      // Simulate slight network delay for premium feel
      await new Promise<void>(resolve => setTimeout(() => resolve(), 500));

      const mockTranscription = "I started having a migraine at 3 PM. The pain severity is about 8. I am experiencing severe nausea, light sensitivity, and some blurred vision.";
      
      const mockRes = {
        success: true,
        data: {
          transcription: mockTranscription,
          parsedFields: {
            date: new Date().toISOString().split('T')[0],
            startTime: "15:00",
            painSeverity: 8,
            symptoms: ["Nausea", "Light Sensitivity", "Blurred Vision"],
            notes: mockTranscription
          }
        }
      };

      setTranscription(mockRes.data.transcription);
      const fields = mockRes.data.parsedFields;
      
      setDate(fields.date);
      setStartTime(fields.startTime);
      setPainSeverity(fields.painSeverity);
      setSelectedSymptoms(fields.symptoms);
      setNotes(fields.notes);
      
      Alert.alert('Mock Speech Extracted', 'Simulated speech parsed: "' + mockRes.data.transcription + '"');
    } catch (err: any) {
      Alert.alert('Mock failed', err.message);
    } finally {
      setProcessingVoice(false);
    }
  };

  const handleToggleSymptom = (symptom: string) => {
    setSelectedSymptoms(prev =>
      prev.includes(symptom) ? prev.filter(s => s !== symptom) : [...prev, symptom]
    );
  };

  const handleSubmit = async () => {
    setSubmittingLog(true);
    try {
      const payload = {
        date,
        startTime,
        endTime: endTime || undefined,
        painSeverity,
        symptoms: selectedSymptoms,
        notes,
        isVoiceLog: !!transcription,
        audioFileUrl: transcription ? '/uploads/simulated-log.m4a' : undefined
      };

      const res = await apiService.createMigraineLog(payload);
      if (res.success) {
        // Clear form
        setNotes('');
        setSelectedSymptoms([]);
        setTranscription('');
        setShowLogForm(false);
        triggerRefresh(); // Refresh context and history list

        // Check for severe migraine pain level (>=8) and premium status to trigger SOS alert prompt
        if (user?.isPremium && painSeverity >= 8) {
          Alert.alert(
            'Severe Migraine Detected',
            `We noticed you logged a severe pain severity of ${painSeverity}/10. Would you like to activate SOS Mode to instantly alert your emergency contacts?`,
            [
              {
                text: 'No, Cancel',
                style: 'cancel',
              },
              {
                text: 'Yes, Send SOS',
                style: 'destructive',
                onPress: async () => {
                  try {
                    const sosRes = await apiService.triggerSOS();
                    if (sosRes.success) {
                      Alert.alert(
                        'SOS Activated',
                        `Emergency alerts broadcast successfully to your contacts: ${sosRes.contactsAlerted?.join(', ') || ''}`
                      );
                    }
                  } catch (err: any) {
                    Alert.alert(
                      'SOS Activation Failed',
                      err.response?.data?.message || 'Failed to trigger SOS broadcast.'
                    );
                  }
                }
              }
            ]
          );
        } else {
          Alert.alert('Success', 'Migraine episode logged successfully');
        }
      }
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to submit migraine log.');
    } finally {
      setSubmittingLog(false);
    }
  };

  const getSeverityBadgeText = (score: number) => {
    if (score >= 8) return `Severe ${score}/10`;
    if (score >= 5) return `Moderate ${score}/10`;
    return `Mild ${score}/10`;
  };

  const getSeverityColors = (score: number) => {
    if (score >= 8) return { text: '#EF4444', bg: 'rgba(239, 68, 68, 0.08)', border: 'rgba(239, 68, 68, 0.2)' };
    if (score >= 5) return { text: '#F59E0B', bg: 'rgba(245, 158, 11, 0.08)', border: 'rgba(245, 158, 11, 0.2)' };
    return { text: '#10B981', bg: 'rgba(16, 185, 129, 0.08)', border: 'rgba(16, 185, 129, 0.2)' };
  };

  const getEpisodeFormattedDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const getDurationHours = (start: string, end?: string) => {
    if (!end) return 'Ongoing';
    try {
      const [sh, sm] = start.split(':').map(Number);
      const [eh, em] = end.split(':').map(Number);
      let diff = (eh * 60 + em) - (sh * 60 + sm);
      if (diff < 0) diff += 24 * 60;
      const hrs = Math.round((diff / 60) * 10) / 10;
      return `${hrs} hrs`;
    } catch {
      return '6 hrs';
    }
  };

  // Render Log Entry Form
  if (showLogForm) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        
        {/* Back navigation header */}
        <View style={styles.formHeader}>
          <TouchableOpacity 
            style={styles.backBtn}
            onPress={() => setShowLogForm(false)}
          >
            <ChevronLeft size={22} color={theme.colors.primary} />
            <Text style={styles.backBtnText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.formTitle}>Log New Episode</Text>
        </View>

        {/* 1. Voice input quick widget */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Voice Logging</Text>
          <Text style={styles.cardDesc}>
            Log your migraine effortlessly by talking. Our AI will automatically analyze your description and fill in the details.
          </Text>

          <View style={styles.recordingRow}>
            <TouchableOpacity 
              style={[styles.micBtn, isRecording ? styles.micBtnRecording : null]} 
              onPress={isRecording ? stopRecordingAndProcess : startRecording}
              disabled={processingVoice}
            >
              {isRecording ? (
                <MicOff size={28} color="#FFFFFF" />
              ) : (
                <Mic size={28} color="#FFFFFF" />
              )}
            </TouchableOpacity>

            <View style={styles.recordingStatusContainer}>
              <Text style={styles.recordingStatusText}>
                {isRecording ? `Recording... ${recordTime}` : 'Tap mic to start recording'}
              </Text>
              {processingVoice && (
                <View style={styles.loaderRow}>
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                  <Text style={styles.loaderText}>AI is analyzing speech...</Text>
                </View>
              )}
            </View>
          </View>

          {/* Dev Simulated voice trigger */}
          <TouchableOpacity style={styles.simBtn} onPress={handleSimulatedSpeech} disabled={processingVoice}>
            <Text style={styles.simBtnText}>Simulate Speech Analysis (Dev Tool)</Text>
          </TouchableOpacity>

          {transcription ? (
            <View style={styles.transcriptBox}>
              <Text style={styles.transcriptLabel}>TRANSCRIPTION</Text>
              <Text style={styles.transcriptText}>"{transcription}"</Text>
            </View>
          ) : null}
        </View>

        {/* 2. Manual Inputs */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Manual Details</Text>
          
          {/* Date Picker */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>
              <Calendar size={14} color="#94A3B8" /> Date of Episode
            </Text>
            <TextInput
              style={[styles.input, focusedInput === 'date' && styles.inputFocused]}
              onFocus={() => setFocusedInput('date')}
              onBlur={() => setFocusedInput(null)}
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#64748B"
            />
          </View>

          {/* Times */}
          <View style={styles.row}>
            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={styles.label}>
                <Clock size={14} color="#94A3B8" /> Start Time
              </Text>
              <TextInput
                style={[styles.input, focusedInput === 'startTime' && styles.inputFocused]}
                onFocus={() => setFocusedInput('startTime')}
                onBlur={() => setFocusedInput(null)}
                value={startTime}
                onChangeText={setStartTime}
                placeholder="HH:MM"
                placeholderTextColor="#64748B"
              />
            </View>
            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={styles.label}>
                <Clock size={14} color="#94A3B8" /> End Time (Optional)
              </Text>
              <TextInput
                style={[styles.input, focusedInput === 'endTime' && styles.inputFocused]}
                onFocus={() => setFocusedInput('endTime')}
                onBlur={() => setFocusedInput(null)}
                value={endTime}
                onChangeText={setEndTime}
                placeholder="HH:MM"
                placeholderTextColor="#64748B"
              />
            </View>
          </View>

          {/* Pain Severity */}
          <View style={styles.formGroup}>
            <View style={styles.severityHeader}>
              <Text style={styles.label}>
                <Sliders size={14} color="#94A3B8" /> Pain Severity
              </Text>
              <Text style={styles.severityValText}>{painSeverity}/10</Text>
            </View>
            
            {/* Custom slider mock button group */}
            <View style={styles.sliderMockContainer}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((val) => (
                <TouchableOpacity
                  key={val}
                  style={[
                    styles.sliderButton,
                    val <= 3 ? styles.sliderLow : val <= 7 ? styles.sliderMedium : styles.sliderHigh,
                    painSeverity === val ? {
                      backgroundColor: val <= 3 ? theme.colors.risk.low : val <= 7 ? theme.colors.risk.medium : theme.colors.risk.high,
                    } : null
                  ]}
                  onPress={() => setPainSeverity(val)}
                >
                  <Text style={[styles.sliderButtonText, painSeverity === val ? styles.sliderButtonTextActive : null]}>
                    {val}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Symptoms Tags */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>
              <AlertCircle size={14} color="#94A3B8" /> Active Symptoms
            </Text>
            <View style={styles.tagContainer}>
              {SYMPTOM_OPTIONS.map((sym) => {
                const isSelected = selectedSymptoms.includes(sym);
                return (
                  <TouchableOpacity
                    key={sym}
                    style={[styles.tag, isSelected ? styles.tagSelected : null]}
                    onPress={() => handleToggleSymptom(sym)}
                  >
                    <Text style={[styles.tagText, isSelected ? styles.tagTextSelected : null]}>
                      {isSelected ? `✓ ${sym}` : sym}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Notes (Shadow work prompts) */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>
              <FileText size={14} color="#94A3B8" /> Personal Reflection & Notes
            </Text>
            <TextInput
              style={[styles.input, styles.textArea, focusedInput === 'notes' && styles.inputFocused]}
              onFocus={() => setFocusedInput('notes')}
              onBlur={() => setFocusedInput(null)}
              value={notes}
              onChangeText={setNotes}
              placeholder="How are you feeling emotionally? Any triggers or relief methods?"
              placeholderTextColor="#64748B"
              multiline
              numberOfLines={4}
            />
          </View>
        </View>

        {/* Guided Shadow Work prompts helper inside manual detail */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Emotional Reflection Prompts</Text>
          <Text style={styles.cardDesc}>
            Tap a prompt below to insert it into your notes field for self-reflection.
          </Text>
          <View style={styles.promptsContainer}>
            {[
              "Where in my body is stress showing up today?",
              "What unexpressed emotion am I holding onto?",
              "Did I ignore my own boundaries today?",
              "What did my body need today that I neglected?"
            ].map((prompt, idx) => (
              <TouchableOpacity 
                key={idx} 
                style={styles.promptItem}
                onPress={() => setNotes(prev => prev ? prev + "\n" + prompt : prompt)}
              >
                <Text style={styles.promptItemText}>✦ {prompt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={styles.submitBtn}
          onPress={handleSubmit}
          disabled={submittingLog}
        >
          {submittingLog ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.submitBtnText}>Save Migraine Log</Text>
          )}
        </TouchableOpacity>

      </ScrollView>
    );
  }

  // DEFAULT VIEW: History List matching mockup
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Migraine Journal</Text>
        <Text style={styles.subtitle}>{history.length} {history.length === 1 ? 'episode' : 'episodes'} recorded</Text>
      </View>

      {/* Action Row */}
      <View style={styles.actionRow}>
        <TouchableOpacity 
          style={styles.logNewBtn} 
          onPress={() => setShowLogForm(true)}
        >
          <Text style={styles.logNewBtnText}>+ Log New Migraine</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.micIconBtn} 
          onPress={() => {
            setShowLogForm(true);
            startRecording();
          }}
        >
          <Mic size={20} color={theme.colors.secondary} />
        </TouchableOpacity>
      </View>

      {/* Dynamic Journal Alert Card */}
      {journalNotif && (
        <View style={styles.journalAlertCard}>
          <View style={styles.alertHeader}>
            <Calendar size={18} color={theme.colors.primary} />
            <Text style={styles.journalAlertTitle}>{journalNotif.title}</Text>
            <TouchableOpacity onPress={() => dismissNotification(journalNotif.id)}>
              <Text style={styles.alertDismiss}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.journalAlertMessage}>{journalNotif.message}</Text>
        </View>
      )}

      {/* Alert Info Bar */}
      <View style={styles.alertBar}>
        <Mic size={14} color={theme.colors.secondary} />
        <Text style={styles.alertBarText}>
          Tap the mic to record a voice entry — AI will extract details automatically
        </Text>
      </View>

      {/* Episode Log Cards */}
      <View style={styles.historyList}>
        {loadingHistory ? (
          <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginTop: 24 }} />
        ) : history.length === 0 ? (
          <Text style={styles.emptyText}>No migraine entries logged yet.</Text>
        ) : (
          history.map((log, index) => {
            const colors = getSeverityColors(log.painSeverity);
            return (
              <View 
                key={log._id || index} 
                style={[
                  styles.historyItem,
                  { borderLeftWidth: 4, borderLeftColor: colors.text }
                ]}
              >
                {/* Header: Date + Pain Pill */}
                <View style={styles.historyItemHeader}>
                  <Text style={styles.historyItemDate}>
                    {getEpisodeFormattedDate(log.date)}
                  </Text>
                  <View style={[styles.severityBadge, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                    <Text style={[styles.severityBadgeText, { color: colors.text }]}>
                      {getSeverityBadgeText(log.painSeverity)}
                    </Text>
                  </View>
                </View>
                
                {/* Time & Duration metadata */}
                <Text style={styles.historyItemTime}>
                  {log.startTime} · {getDurationHours(log.startTime, log.endTime)}
                </Text>
                
                {/* Symptom Tag Pills */}
                {log.symptoms && log.symptoms.length > 0 && (
                  <View style={styles.historyTagRow}>
                    {log.symptoms.map((sym: string, i: number) => (
                      <View key={i} style={styles.historySymptomPill}>
                        <Text style={styles.historySymptomPillText}>{sym}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Notes Reflection */}
                {log.notes ? (
                  <Text style={styles.historyItemNotes}>{log.notes}</Text>
                ) : null}
              </View>
            );
          })
        )}
      </View>

    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 48,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#F8FAFC',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  logNewBtn: {
    flex: 1,
    height: 50,
    backgroundColor: theme.colors.primary,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  logNewBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
  micIconBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1.5,
    borderColor: theme.colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(20, 184, 166, 0.05)',
  },
  alertBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(20, 184, 166, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(20, 184, 166, 0.15)',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 24,
  },
  alertBarText: {
    flex: 1,
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 14,
  },
  historyList: {
    gap: 14,
  },
  historyItem: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 24,
    padding: 20,
  },
  historyItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  historyItemDate: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F8FAFC',
  },
  severityBadge: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  severityBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  historyItemTime: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    marginBottom: 12,
  },
  historyTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  historySymptomPill: {
    backgroundColor: 'rgba(99, 102, 241, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.15)',
    borderRadius: 9999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  historySymptomPillText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  historyItemNotes: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 18,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.03)',
  },
  emptyText: {
    color: '#64748B',
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 30,
  },
  
  // Form Styles
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    position: 'relative',
    height: 36,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    left: 0,
    zIndex: 10,
  },
  backBtnText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 2,
  },
  formTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 20,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
    marginBottom: 16,
  },
  recordingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginVertical: 8,
  },
  micBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.colors.secondary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  micBtnRecording: {
    backgroundColor: '#EF4444',
  },
  recordingStatusContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  recordingStatusText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '600',
  },
  loaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  loaderText: {
    color: '#64748B',
    fontSize: 12,
  },
  simBtn: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(20, 184, 166, 0.3)',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(20, 184, 166, 0.02)',
  },
  simBtnText: {
    color: theme.colors.secondary,
    fontWeight: '700',
    fontSize: 12,
  },
  transcriptBox: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
  },
  transcriptLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.colors.primary,
    marginBottom: 4,
    letterSpacing: 1,
  },
  transcriptText: {
    fontSize: 13,
    color: '#F8FAFC',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  formGroup: {
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  input: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    color: '#F8FAFC',
    fontSize: 14,
    height: 50,
  },
  inputFocused: {
    borderColor: theme.colors.primary,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
    paddingVertical: 12,
  },
  severityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  severityValText: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  sliderMockContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.background,
    padding: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  sliderButton: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 1.5,
  },
  sliderLow: {
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
  },
  sliderMedium: {
    backgroundColor: 'rgba(245, 158, 11, 0.05)',
  },
  sliderHigh: {
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
  },
  sliderButtonActive: {
    backgroundColor: theme.colors.primary,
  },
  sliderButtonText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '800',
  },
  sliderButtonTextActive: {
    color: '#FFFFFF',
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 9999,
  },
  tagSelected: {
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    borderColor: theme.colors.primary,
  },
  tagText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
  tagTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  submitBtn: {
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 25,
    gap: 10,
    marginTop: 8,
    marginBottom: 24,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
  promptsContainer: {
    gap: 8,
  },
  promptItem: {
    backgroundColor: 'rgba(20, 184, 166, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(20, 184, 166, 0.15)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  promptItemText: {
    fontSize: 12,
    color: theme.colors.secondary,
    fontWeight: '600',
  },
  journalAlertCard: {
    backgroundColor: 'rgba(99, 102, 241, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.25)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  journalAlertTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginLeft: 8,
    flex: 1,
  },
  alertDismiss: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: 'bold',
    paddingHorizontal: 4,
  },
  journalAlertMessage: {
    fontSize: 13,
    color: '#E2E8F0',
    lineHeight: 18,
  },
});
