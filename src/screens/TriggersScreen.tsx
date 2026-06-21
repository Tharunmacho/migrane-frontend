import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  PanResponder,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { theme } from '../theme/theme';
import { apiService } from '../services/api';
import { useApp } from '../context/AppContext';
import {
  Moon,
  Droplet,
  Monitor,
  Info,
  Activity,
  Zap,
  Flame,
  Coffee,
  Cloud,
  Heart,
  Plus,
  FileText,
} from 'lucide-react-native';

const FOOD_OPTIONS = ['Chocolate', 'Coffee', 'Cheese', 'Processed Foods', 'Skipped Meals'];
const ENV_OPTIONS = ['Bright Light', 'Loud Noise', 'Heat', 'Humidity', 'Weather Change', 'Strong Smells'];
const HEALTH_OPTIONS = ['Anxiety', 'Fatigue', 'Fever', 'Medication Change', 'Menstrual Cycle'];

const STRESS_EMOJIS = ['😌', '🙂', '😐', '😟', '😰'];

// Custom Slider using PanResponder for absolute positioning, dragging, and clicking
const CustomSlider: React.FC<{
  value: number;
  min: number;
  max: number;
  onChange: (val: number) => void;
  color?: string;
}> = ({ value = 0, min, max, onChange, color = theme.colors.primary }) => {
  const [width, setWidth] = useState(0);
  const startX = useRef(0);
  const startVal = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt, gestureState) => {
        if (width <= 0) return;
        const locationX = evt.nativeEvent.locationX;
        let newValue = min + (locationX / width) * (max - min);
        newValue = Math.max(min, Math.min(max, Math.round(newValue)));
        onChange(newValue);
        startX.current = gestureState.x0;
        startVal.current = newValue;
      },
      onPanResponderMove: (evt, gestureState) => {
        if (width <= 0) return;
        const deltaX = gestureState.dx;
        const deltaValue = (deltaX / width) * (max - min);
        let newValue = startVal.current + deltaValue;
        newValue = Math.max(min, Math.min(max, Math.round(newValue)));
        onChange(newValue);
      },
    })
  ).current;

  // Safeguard percentage
  const valClamped = Math.max(min, Math.min(max, value));
  const percentage = ((valClamped - min) / (max - min)) * 100;

  return (
    <View
      style={styles.sliderContainer}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      <View style={styles.sliderTrackBg}>
        <View style={[styles.sliderTrackFill, { width: `${percentage}%`, backgroundColor: color }]} />
      </View>
      <View style={[styles.sliderThumb, { left: `${percentage}%`, borderColor: color }]} />
      
      {/* Absolute overlay for dragging/tapping */}
      <View
        style={StyleSheet.absoluteFill}
        {...panResponder.panHandlers}
      />
    </View>
  );
};

export const TriggersScreen: React.FC = () => {
  const { triggerRefresh, refreshTrigger, addNotification, notifications, dismissNotification, dismissedIds, user } = useApp();
  const triggerNotif = notifications && notifications.find(n => n.category === 'triggers' && !dismissedIds.includes(n.id));

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Lifestyle state
  const [sleepHours, setSleepHours] = useState(7);
  const [waterIntake, setWaterIntake] = useState(6);
  const [screenTime, setScreenTime] = useState(4);
  const [stressLevel, setStressLevel] = useState(4);
  const [physicalActivityLevel, setPhysicalActivityLevel] = useState<'None' | 'Light' | 'Moderate' | 'Intense'>('None');

  // Categories lists
  const [selectedFood, setSelectedFood] = useState<string[]>([]);
  const [selectedEnv, setSelectedEnv] = useState<string[]>([]);
  const [selectedHealth, setSelectedHealth] = useState<string[]>([]);

  // Custom Food Trigger
  const [customFood, setCustomFood] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [focusedCustomFood, setFocusedCustomFood] = useState(false);

  // Helper date text
  const getFormattedDate = () => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const now = new Date();
    return `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]}`;
  };

  useEffect(() => {
    const fetchTodayTriggers = async () => {
      try {
        const res = await apiService.getTodayTriggers();
        if (res.success && res.data) {
          const log = res.data;
          setSleepHours(log.sleepHours ?? 7);
          setWaterIntake(log.waterIntake ?? 6);
          setScreenTime(log.screenTime ?? 4);
          setStressLevel(log.stressLevel ?? 4);

          // Map physical activity from backend boolean, using local Storage if available
          const isAct = log.physicalActivity ?? false;
          if (!isAct) {
            setPhysicalActivityLevel('None');
          } else {
            const dateKey = new Date().toISOString().split('T')[0];
            const stored = await AsyncStorage.getItem(`@activity_${dateKey}`);
            if (stored === 'Light' || stored === 'Moderate' || stored === 'Intense') {
              setPhysicalActivityLevel(stored);
            } else {
              setPhysicalActivityLevel('Light');
            }
          }

          setSelectedFood(log.foodTriggers || []);
          setSelectedEnv(log.environmentalTriggers || []);
          setSelectedHealth(log.healthTriggers || []);
        }
      } catch (err) {
        console.warn("Failed to load today's triggers:", err);
      }
    };
    fetchTodayTriggers();
  }, [user?._id, refreshTrigger]);

  const handleToggleFood = (food: string) => {
    setSelectedFood(prev =>
      prev.includes(food) ? prev.filter(f => f !== food) : [...prev, food]
    );
  };

  const handleToggleEnv = (env: string) => {
    setSelectedEnv(prev =>
      prev.includes(env) ? prev.filter(e => e !== env) : [...prev, env]
    );
  };

  const handleToggleHealth = (health: string) => {
    setSelectedHealth(prev =>
      prev.includes(health) ? prev.filter(h => h !== health) : [...prev, health]
    );
  };

  const handleAddCustomFood = () => {
    if (!customFood.trim()) return;
    const food = customFood.trim();
    if (!selectedFood.includes(food)) {
      setSelectedFood(prev => [...prev, food]);
    }
    setCustomFood('');
    setShowCustomInput(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const dateKey = new Date().toISOString().split('T')[0];
      // Save exact activity selection locally to restore high fidelity selection state
      await AsyncStorage.setItem(`@activity_${dateKey}`, physicalActivityLevel);

      const payload = {
        date: dateKey,
        sleepHours,
        waterIntake,
        screenTime,
        stressLevel,
        physicalActivity: physicalActivityLevel !== 'None',
        foodTriggers: selectedFood,
        environmentalTriggers: selectedEnv,
        healthTriggers: selectedHealth,
      };

      const res = await apiService.logTriggers(payload);
      if (res.success) {
        triggerRefresh(); // Refresh Dashboard scores
        Alert.alert('Vitals Updated', "Today's triggers and health metrics have been saved successfully.");
      }
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to save triggers.');
    } finally {
      setSaving(false);
    }
  };

  // Convert stress level 1-10 to index 0-4
  const selectedEmojiIndex = Math.min(4, Math.max(0, Math.floor((stressLevel - 1) / 2)));
  const handleStressEmojiPress = (index: number) => {
    const mappedLevel = (index + 1) * 2; // index 0->2, 1->4, 2->6, 3->8, 4->10
    setStressLevel(mappedLevel);
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading today's logs...</Text>
      </View>
    );
  }

  // Helper renderer for checkable tag pills
  const renderTagPill = (label: string, isSelected: boolean, onPress: () => void) => {
    return (
      <TouchableOpacity
        key={label}
        style={[styles.pill, isSelected ? styles.pillSelected : null]}
        onPress={onPress}
      >
        <Text style={[styles.pillText, isSelected ? styles.pillTextSelected : null]}>
          {isSelected ? `✓ ${label}` : label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Daily Triggers</Text>
        <Text style={styles.dateText}>{getFormattedDate()}</Text>
      </View>

      {/* Dynamic Triggers Alert Card */}
      {triggerNotif && (
        <View style={styles.triggerAlertCard}>
          <View style={styles.alertHeader}>
            <Activity size={18} color="#10B981" />
            <Text style={styles.triggerAlertTitle}>{triggerNotif.title}</Text>
            <TouchableOpacity onPress={() => dismissNotification(triggerNotif.id)}>
              <Text style={styles.alertDismiss}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.triggerAlertMessage}>{triggerNotif.message}</Text>
        </View>
      )}

      {/* 1. LIFESTYLE VITALS */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Moon size={20} color="#94A3B8" />
          <Text style={styles.cardTitle}>Lifestyle</Text>
        </View>

        {/* Sleep Hours */}
        <View style={styles.metricItem}>
          <View style={styles.metricHeader}>
            <View style={styles.metricLabelRow}>
              <Moon size={16} color="#94A3B8" style={styles.metricIcon} />
              <Text style={styles.metricLabel}>Sleep Hours</Text>
            </View>
            <Text style={[styles.metricValue, { color: sleepHours < 6 ? theme.colors.risk.high : theme.colors.primary }]}>
              {sleepHours}h
            </Text>
          </View>
          <View style={styles.sliderWithButtonsRow}>
            <TouchableOpacity
              style={styles.stepButton}
              onPress={() => setSleepHours(prev => Math.max(1, prev - 1))}
            >
              <Text style={styles.stepButtonText}>-</Text>
            </TouchableOpacity>

            <View style={styles.sliderWrapper}>
              <CustomSlider value={sleepHours} min={1} max={12} onChange={setSleepHours} color={theme.colors.primary} />
            </View>

            <TouchableOpacity
              style={styles.stepButton}
              onPress={() => setSleepHours(prev => Math.min(12, prev + 1))}
            >
              <Text style={styles.stepButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Water Intake */}
        <View style={styles.metricItem}>
          <View style={styles.metricHeader}>
            <View style={styles.metricLabelRow}>
              <Droplet size={16} color="#94A3B8" style={styles.metricIcon} />
              <Text style={styles.metricLabel}>Water Intake</Text>
            </View>
            <Text style={[styles.metricValue, { color: theme.colors.secondary }]}>
              {waterIntake} {waterIntake === 1 ? 'glass' : 'glasses'}
            </Text>
          </View>
          <View style={styles.dropletsContainer}>
            {/* First row: 8 droplets */}
            <View style={styles.dropletRow}>
              {Array.from({ length: 8 }).map((_, idx) => {
                const dropletNumber = idx + 1;
                const isFilled = waterIntake >= dropletNumber;
                return (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => {
                      if (waterIntake === dropletNumber) {
                        setWaterIntake(dropletNumber - 1);
                      } else {
                        setWaterIntake(dropletNumber);
                      }
                    }}
                    style={styles.dropletButton}
                  >
                    <Droplet
                      size={24}
                      color={isFilled ? theme.colors.secondary : '#1F2D44'}
                      fill={isFilled ? theme.colors.secondary : 'transparent'}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
            {/* Second row: 2 droplets (wrapping aligned left) */}
            <View style={styles.dropletRow}>
              {Array.from({ length: 2 }).map((_, idx) => {
                const dropletNumber = idx + 9;
                const isFilled = waterIntake >= dropletNumber;
                return (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => {
                      if (waterIntake === dropletNumber) {
                        setWaterIntake(dropletNumber - 1);
                      } else {
                        setWaterIntake(dropletNumber);
                      }
                    }}
                    style={styles.dropletButton}
                  >
                    <Droplet
                      size={24}
                      color={isFilled ? theme.colors.secondary : '#1F2D44'}
                      fill={isFilled ? theme.colors.secondary : 'transparent'}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* Screen Time */}
        <View style={styles.metricItem}>
          <View style={styles.metricHeader}>
            <View style={styles.metricLabelRow}>
              <Monitor size={16} color="#94A3B8" style={styles.metricIcon} />
              <Text style={styles.metricLabel}>Screen Time</Text>
            </View>
            <Text style={[styles.metricValue, { color: screenTime >= 7 ? theme.colors.risk.high : theme.colors.primary }]}>
              {screenTime}h
            </Text>
          </View>
          <View style={styles.singleSliderWrapper}>
            <CustomSlider value={screenTime} min={0} max={24} onChange={setScreenTime} color={theme.colors.primary} />
          </View>
        </View>

        {/* Stress Level */}
        <View style={styles.metricItem}>
          <View style={styles.metricHeader}>
            <View style={styles.metricLabelRow}>
              <Info size={16} color="#94A3B8" style={styles.metricIcon} />
              <Text style={styles.metricLabel}>Stress Level</Text>
            </View>
            <View style={styles.emojiBadge}>
              <Text style={styles.emojiText}>{STRESS_EMOJIS[selectedEmojiIndex]}</Text>
            </View>
          </View>
          <View style={styles.stressRow}>
            {STRESS_EMOJIS.map((emoji, idx) => {
              const isSelected = selectedEmojiIndex === idx;
              return (
                <TouchableOpacity
                  key={idx}
                  style={[styles.emojiButton, isSelected ? styles.emojiButtonSelected : null]}
                  onPress={() => handleStressEmojiPress(idx)}
                >
                  <Text style={styles.emojiText}>{emoji}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Physical Activity */}
        <View style={[styles.metricItem, { borderBottomWidth: 0, paddingBottom: 0 }]}>
          <View style={styles.metricLabelRow}>
            <Activity size={16} color="#94A3B8" style={styles.metricIcon} />
            <Text style={styles.metricLabel}>Physical Activity</Text>
          </View>
          <View style={styles.activityRow}>
            {/* None Option */}
            <TouchableOpacity
              style={[
                styles.activityButton,
                physicalActivityLevel === 'None' ? styles.activityButtonSelected : null
              ]}
              onPress={() => setPhysicalActivityLevel('None')}
            >
              <Moon size={18} color={physicalActivityLevel === 'None' ? theme.colors.primary : '#94A3B8'} />
              <Text style={[
                styles.activityButtonText,
                physicalActivityLevel === 'None' ? styles.activityButtonTextSelected : null
              ]}>
                None
              </Text>
            </TouchableOpacity>

            {/* Light Option */}
            <TouchableOpacity
              style={[
                styles.activityButton,
                physicalActivityLevel === 'Light' ? styles.activityButtonSelected : null
              ]}
              onPress={() => setPhysicalActivityLevel('Light')}
            >
              <Activity size={18} color={physicalActivityLevel === 'Light' ? theme.colors.primary : '#94A3B8'} />
              <Text style={[
                styles.activityButtonText,
                physicalActivityLevel === 'Light' ? styles.activityButtonTextSelected : null
              ]}>
                Light
              </Text>
            </TouchableOpacity>

            {/* Moderate Option */}
            <TouchableOpacity
              style={[
                styles.activityButton,
                physicalActivityLevel === 'Moderate' ? styles.activityButtonSelected : null
              ]}
              onPress={() => setPhysicalActivityLevel('Moderate')}
            >
              <Zap size={18} color={physicalActivityLevel === 'Moderate' ? theme.colors.primary : '#94A3B8'} />
              <Text style={[
                styles.activityButtonText,
                physicalActivityLevel === 'Moderate' ? styles.activityButtonTextSelected : null
              ]}>
                Moderate
              </Text>
            </TouchableOpacity>

            {/* Intense Option */}
            <TouchableOpacity
              style={[
                styles.activityButton,
                physicalActivityLevel === 'Intense' ? styles.activityButtonSelected : null
              ]}
              onPress={() => setPhysicalActivityLevel('Intense')}
            >
              <Flame size={18} color={physicalActivityLevel === 'Intense' ? theme.colors.primary : '#94A3B8'} />
              <Text style={[
                styles.activityButtonText,
                physicalActivityLevel === 'Intense' ? styles.activityButtonTextSelected : null
              ]}>
                Intense
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* 2. FOOD TRIGGERS */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Coffee size={20} color="#94A3B8" />
          <Text style={styles.cardTitle}>Food Triggers</Text>
        </View>
        <View style={styles.tagContainer}>
          {FOOD_OPTIONS.map((food) => {
            const isSelected = selectedFood.includes(food);
            return renderTagPill(food, isSelected, () => handleToggleFood(food));
          })}
          
          {/* Custom triggers already selected */}
          {selectedFood.filter(f => !FOOD_OPTIONS.includes(f)).map((food) => (
            renderTagPill(food, true, () => handleToggleFood(food))
          ))}

          {/* Toggle pill for Other */}
          {renderTagPill('Other', showCustomInput, () => setShowCustomInput(prev => !prev))}
        </View>

        {showCustomInput && (
          <View style={styles.addCustomRow}>
            <TextInput
              style={[styles.customInput, focusedCustomFood && styles.customInputFocused]}
              onFocus={() => setFocusedCustomFood(true)}
              onBlur={() => setFocusedCustomFood(false)}
              value={customFood}
              onChangeText={setCustomFood}
              placeholder="Add custom food trigger..."
              placeholderTextColor="#64748B"
              onSubmitEditing={handleAddCustomFood}
            />
            <TouchableOpacity style={styles.addBtn} onPress={handleAddCustomFood}>
              <Plus size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* 3. ENVIRONMENTAL TRIGGERS */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Cloud size={20} color="#94A3B8" />
          <Text style={styles.cardTitle}>Environmental</Text>
        </View>
        <View style={styles.tagContainer}>
          {ENV_OPTIONS.map((env) => {
            const isSelected = selectedEnv.includes(env);
            return renderTagPill(env, isSelected, () => handleToggleEnv(env));
          })}
        </View>
      </View>

      {/* 4. HEALTH TRIGGERS */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Heart size={20} color="#94A3B8" />
          <Text style={styles.cardTitle}>Health</Text>
        </View>
        <View style={styles.tagContainer}>
          {HEALTH_OPTIONS.map((health) => {
            const isSelected = selectedHealth.includes(health);
            return renderTagPill(health, isSelected, () => handleToggleHealth(health));
          })}
        </View>
      </View>

      {/* SAVE BUTTON */}
      <TouchableOpacity
        style={styles.saveSubmitBtn}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <>
            <FileText size={20} color="#FFFFFF" />
            <Text style={styles.saveSubmitBtnText}>Save Today's Triggers</Text>
          </>
        )}
      </TouchableOpacity>
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
  dateText: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 4,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  loadingText: {
    color: '#94A3B8',
    marginTop: 16,
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F8FAFC',
  },
  metricItem: {
    marginBottom: 22,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  metricLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricIcon: {
    marginRight: 6,
  },
  metricLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#94A3B8',
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  sliderWithButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepButton: {
    width: 38,
    height: 38,
    backgroundColor: 'rgba(99, 102, 241, 0.05)',
    borderWidth: 1.5,
    borderColor: 'rgba(99, 102, 241, 0.15)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepButtonText: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: 'bold',
  },
  sliderWrapper: {
    flex: 1,
    marginHorizontal: 12,
  },
  singleSliderWrapper: {
    flex: 1,
    marginTop: 4,
  },
  sliderContainer: {
    height: 32,
    justifyContent: 'center',
    position: 'relative',
  },
  sliderTrackBg: {
    height: 6,
    backgroundColor: theme.colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  sliderTrackFill: {
    height: '100%',
    borderRadius: 3,
  },
  sliderThumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    marginLeft: -10,
  },
  dropletsContainer: {
    marginTop: 4,
  },
  dropletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  dropletButton: {
    padding: 2,
  },
  emojiBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(20, 184, 166, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(20, 184, 166, 0.15)',
  },
  stressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  emojiButton: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  emojiButtonSelected: {
    backgroundColor: 'rgba(20, 184, 166, 0.08)',
    borderWidth: 1.5,
    borderColor: theme.colors.secondary,
  },
  emojiText: {
    fontSize: 22,
  },
  activityRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  activityButton: {
    flex: 1,
    height: 66,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  activityButtonSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
  },
  activityButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  activityButtonTextSelected: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    marginBottom: 4,
  },
  pillSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
  },
  pillText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '500',
  },
  pillTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  addCustomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
  },
  customInput: {
    flex: 1,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    color: '#F8FAFC',
    fontSize: 13,
  },
  customInputFocused: {
    borderColor: theme.colors.primary,
  },
  addBtn: {
    backgroundColor: theme.colors.secondary,
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.colors.secondary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  saveSubmitBtn: {
    backgroundColor: theme.colors.secondary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
    marginTop: 16,
    marginBottom: 32,
    shadowColor: theme.colors.secondary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  saveSubmitBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  triggerAlertCard: {
    backgroundColor: 'rgba(16, 185, 129, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  triggerAlertTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#10B981',
    marginLeft: 8,
    flex: 1,
  },
  alertDismiss: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: 'bold',
    paddingHorizontal: 4,
  },
  triggerAlertMessage: {
    fontSize: 13,
    color: '#E2E8F0',
    lineHeight: 18,
  },
});
