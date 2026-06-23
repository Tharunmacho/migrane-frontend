import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Circle } from 'react-native-svg';
import { theme } from '../theme/theme';
import { apiService } from '../services/api';
import { useApp } from '../context/AppContext';
import {
  Bell,
  Droplet,
  Eye,
  Pause,
  AlertCircle,
  ShieldAlert,
  Calendar,
  Activity,
  Plus,
  ChevronRight,
  Sparkles,
} from 'lucide-react-native';

const CircularProgress: React.FC<{
  size: number;
  strokeWidth: number;
  percentage: number;
  color: string;
}> = ({ size, strokeWidth, percentage, color }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <View style={styles.circularWrapper}>
      <Svg width={size} height={size}>
        <Circle
          stroke="rgba(255, 255, 255, 0.04)"
          fill="transparent"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
        />
        <Circle
          stroke={color}
          fill="transparent"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.circularInner}>
        <Text style={styles.circularScoreText}>{percentage}%</Text>
        <Text style={styles.circularLabelText}>RISK SCORE</Text>
      </View>
    </View>
  );
};

export const DashboardScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user, refreshTrigger, triggerRefresh, notifications, dismissNotification, dismissedIds } = useApp();

  const homeNotif = notifications && notifications.find(n => !dismissedIds.includes(n.id));
  const hasUnreadNotifications = notifications && notifications.some(n => !n.read);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [prediction, setPrediction] = useState<any>(null);
  const [lastEpisode, setLastEpisode] = useState<any>(null);

  const fetchDashboardData = async (showLoader = false) => {
    try {
      if (showLoader) setLoading(true);
      const res = await apiService.getDailyPrediction();
      if (res.success && res.data) {
        setPrediction(res.data);
        if (user?._id) {
          AsyncStorage.setItem(`@auracast_prediction_${user._id}`, JSON.stringify(res.data)).catch(() => {});
        }
      }
    } catch (err) {
      console.warn('Failed to load daily prediction forecast:', err);
    } finally {
      if (showLoader) setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const loadCached = async () => {
      if (user?._id) {
        try {
          const cached = await AsyncStorage.getItem(`@auracast_prediction_${user._id}`);
          if (cached) {
            setPrediction(JSON.parse(cached));
          }
        } catch {}
      }
    };
    loadCached();
  }, [user?._id]);

  const fetchLastEpisode = async () => {
    try {
      const res = await apiService.getMigraineHistory();
      if (res.success && res.data && res.data.length > 0) {
        const sorted = [...res.data].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        setLastEpisode(sorted[0]);
      }
    } catch (err) {
      console.warn('Failed to fetch last episode history:', err);
    }
  };

  useEffect(() => {
    console.log('[Frontend Test] Dashboard Screen Mounted! User is authenticated and viewing dashboard.');
    fetchDashboardData(false);
    fetchLastEpisode();
  }, [user?._id, user?.isPremium, refreshTrigger]);

  const onRefresh = () => {
    setRefreshing(true);
    triggerRefresh();
    fetchDashboardData();
    fetchLastEpisode();
  };

  const getFormattedDate = () => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const now = new Date();
    return `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
  };

  const getGreeting = () => {
    const hrs = new Date().getHours();
    let greet = 'Good Morning';
    if (hrs >= 12 && hrs < 17) greet = 'Good Afternoon';
    else if (hrs >= 17) greet = 'Good Evening';
    const name = user?.displayName?.split(' ')[0] || 'Sarah';
    return `${greet}, ${name}`;
  };

  const getRiskColor = (score: number) => {
    if (score >= 75) return '#EF4444';
    if (score >= 41) return '#F59E0B';
    return '#10B981';
  };

  const renderActiveRiskFactors = () => {
    const factors = prediction?.riskFactors || [];
    return (
      <View style={styles.factorsList}>
        <Text style={styles.factorsTitle}>RISK FACTORS</Text>
        {factors.length === 0 ? (
          <View style={styles.noFactorsBadge}>
            <Text style={styles.noFactorsBadgeText}>No active factors. Good job!</Text>
          </View>
        ) : (
          <View style={styles.factorsGrid}>
            {factors.map((factor: string, idx: number) => (
              <View key={idx} style={styles.factorPill}>
                <AlertCircle size={10} color="#EF4444" style={styles.factorPillIcon} />
                <Text style={styles.factorPillText} numberOfLines={1}>{factor}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const score = prediction?.score ?? 0;
  const status = prediction?.status ?? 'LOW RISK';
  const riskColor = getRiskColor(score);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* 1. Header Row */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.dateSubtitle}>{getFormattedDate()}</Text>
          <Text style={styles.greetingText}>{getGreeting()} 👋</Text>
        </View>
        <TouchableOpacity 
          style={styles.notificationBtn}
          onPress={() => navigation.navigate('Notifications')}
          activeOpacity={0.7}
        >
          <Bell size={20} color={theme.colors.text} />
          {hasUnreadNotifications ? <View style={styles.notificationDot} /> : null}
        </TouchableOpacity>
      </View>

      {/* Dynamic Home Alert Card */}
      {homeNotif && (() => {
        const getNotificationStyles = (category?: string) => {
          switch (category) {
            case 'journal':
              return {
                color: '#00A3FF',
                bg: 'rgba(0, 163, 255, 0.06)',
                border: 'rgba(0, 163, 255, 0.25)',
                Icon: Calendar
              };
            case 'triggers':
              return {
                color: '#10B981',
                bg: 'rgba(16, 185, 129, 0.06)',
                border: 'rgba(16, 185, 129, 0.25)',
                Icon: Activity
              };
            default:
              return {
                color: '#EF4444',
                bg: 'rgba(239, 68, 68, 0.06)',
                border: 'rgba(239, 68, 68, 0.25)',
                Icon: AlertCircle
              };
          }
        };

        const notifStyle = getNotificationStyles(homeNotif.category);
        const IconComponent = notifStyle.Icon;

        return (
          <TouchableOpacity 
            style={[
              styles.alertPopupCard, 
              { backgroundColor: notifStyle.bg, borderColor: notifStyle.border }
            ]}
            onPress={() => navigation.navigate('Notifications')}
            activeOpacity={0.8}
          >
            <View style={styles.alertPopupHeader}>
              <View style={styles.alertPopupHeaderLeft}>
                <IconComponent size={18} color={notifStyle.color} />
                <Text style={[styles.alertPopupTitle, { color: notifStyle.color }]}>{homeNotif.title}</Text>
              </View>
              <TouchableOpacity 
                style={styles.dismissBtn}
                onPress={(e) => {
                  e.stopPropagation();
                  dismissNotification(homeNotif.id);
                }}
              >
                <Text style={styles.alertPopupDismiss}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.alertPopupMessage}>{homeNotif.message}</Text>
          </TouchableOpacity>
        );
      })()}

      {/* 2. Today's Migraine Risk Card */}
      <View style={[styles.card, { borderLeftWidth: 4, borderLeftColor: riskColor }]}>
        <Text style={styles.cardTitle}>TODAY'S MIGRAINE RISK</Text>
        
        {prediction ? (
          <>
            {/* Risk Level Badge */}
            <View style={styles.riskBadgeContainer}>
              <View style={[
                styles.riskBadge, 
                { 
                  borderColor: `${riskColor}30`, 
                  backgroundColor: `${riskColor}10` 
                }
              ]}>
                <Text style={[styles.riskBadgeText, { color: riskColor }]}>• {status}</Text>
              </View>
            </View>

            {/* Circular Progress & Factors Row */}
            <View style={styles.riskRow}>
              <CircularProgress size={110} strokeWidth={8} percentage={score} color={riskColor} />
              <View style={styles.factorsContainer}>
                {renderActiveRiskFactors()}
              </View>
            </View>
          </>
        ) : (
          <View style={styles.centerCardLoader}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={styles.cardLoaderText}>Calculating risk score...</Text>
          </View>
        )}
      </View>

      {/* 3. Prevention Tips Section */}
      <View style={styles.tipsSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Prevention Tips</Text>
          <View style={styles.aiBadge}>
            <Sparkles size={10} color={theme.colors.secondary} style={styles.aiBadgeIcon} />
            <Text style={styles.aiBadgeText}>AI Suggested</Text>
          </View>
        </View>

        <View style={styles.tipsGrid}>
          {prediction?.suggestions && prediction.suggestions.length > 0 ? (
            prediction.suggestions.map((suggestion: any, idx: number) => {
              let boxStyle: any = styles.tipBoxWater;
              let iconWrapperStyle: any = { backgroundColor: 'rgba(0, 163, 255, 0.08)' };
              let icon = <Droplet size={16} color="#00A3FF" fill="#00A3FF" />;

              switch (suggestion.type) {
                case 'water':
                  boxStyle = styles.tipBoxWater;
                  iconWrapperStyle = { backgroundColor: 'rgba(0, 163, 255, 0.08)' };
                  icon = <Droplet size={16} color="#00A3FF" fill="#00A3FF" />;
                  break;
                case 'screen':
                  boxStyle = styles.tipBoxScreen;
                  iconWrapperStyle = { backgroundColor: 'rgba(168, 85, 247, 0.08)' };
                  icon = <Eye size={16} color="#A855F7" />;
                  break;
                case 'sleep':
                  boxStyle = styles.tipBoxRest;
                  iconWrapperStyle = { backgroundColor: 'rgba(20, 184, 166, 0.08)' };
                  icon = <Text style={styles.tipEmoji}>😴</Text>;
                  break;
                case 'stress':
                  boxStyle = styles.tipBoxBreak;
                  iconWrapperStyle = { backgroundColor: 'rgba(99, 102, 241, 0.08)' };
                  icon = <Activity size={16} color="#6366F1" />;
                  break;
                case 'medical':
                  boxStyle = { backgroundColor: 'rgba(239, 68, 68, 0.03)', borderColor: 'rgba(239, 68, 68, 0.15)' };
                  iconWrapperStyle = { backgroundColor: 'rgba(239, 68, 68, 0.08)' };
                  icon = <Plus size={16} color="#EF4444" />;
                  break;
                case 'environment':
                  boxStyle = { backgroundColor: 'rgba(245, 158, 11, 0.03)', borderColor: 'rgba(245, 158, 11, 0.15)' };
                  iconWrapperStyle = { backgroundColor: 'rgba(245, 158, 11, 0.08)' };
                  icon = <AlertCircle size={16} color="#F59E0B" />;
                  break;
                default:
                  boxStyle = styles.tipBoxBreak;
                  iconWrapperStyle = { backgroundColor: 'rgba(99, 102, 241, 0.08)' };
                  icon = <Sparkles size={16} color="#6366F1" />;
                  break;
              }

              const text = typeof suggestion === 'string' ? suggestion : suggestion.text;

              return (
                <View key={idx} style={[styles.tipBox, boxStyle]}>
                  <View style={[styles.tipIconWrapper, iconWrapperStyle]}>
                    {icon}
                  </View>
                  <Text style={styles.tipText} numberOfLines={3}>{text}</Text>
                </View>
              );
            })
          ) : (
            <Text style={{ color: theme.colors.textSubtle, fontSize: 12 }}>No tips available right now.</Text>
          )}
        </View>
      </View>

      {/* 4. Action Buttons Row */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.btnPrimary}
          onPress={() => navigation.navigate('Journal')}
          activeOpacity={0.8}
        >
          <Plus size={16} color="#FFFFFF" style={styles.btnIcon} />
          <Text style={styles.btnPrimaryText}>Log Migraine</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.btnSecondary}
          onPress={() => navigation.navigate('Triggers')}
          activeOpacity={0.8}
        >
          <Activity size={15} color={theme.colors.secondary} style={styles.btnIcon} />
          <Text style={styles.btnSecondaryText}>Log Triggers</Text>
        </TouchableOpacity>
      </View>

      {/* 5. Last Episode Card */}
      {lastEpisode && (
        <View style={styles.episodeSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Last Episode</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Journal')} activeOpacity={0.7}>
              <Text style={styles.viewAllText}>View All <ChevronRight size={12} color={theme.colors.primary} /></Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.episodeCard, { borderLeftWidth: 3, borderLeftColor: getRiskColor(lastEpisode.painSeverity * 10) }]}>
            <View style={styles.episodeRow}>
              {/* Severity Score circle */}
              <View style={[styles.severityCircle, { borderColor: getRiskColor(lastEpisode.painSeverity * 10) }]}>
                <Text style={[styles.severityText, { color: getRiskColor(lastEpisode.painSeverity * 10) }]}>
                  {lastEpisode.painSeverity}
                </Text>
              </View>

              <View style={styles.episodeMeta}>
                {/* Date */}
                <Text style={styles.episodeDate}>
                  {new Date(lastEpisode.date).toLocaleDateString('en-US', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </Text>
                {/* Meta details */}
                <Text style={styles.episodeDuration}>
                  {lastEpisode.startTime
                    ? `${lastEpisode.startTime}${lastEpisode.endTime ? ` - ${lastEpisode.endTime}` : ' (Ongoing)'}`
                    : 'Duration'} 
                  {lastEpisode.symptoms && lastEpisode.symptoms.length > 0
                    ? ` · ${lastEpisode.symptoms.slice(0, 2).join(', ')}`
                    : ''}
                </Text>

                {/* Sub row of pills */}
                <View style={styles.episodeTagsRow}>
                  {lastEpisode.symptoms &&
                    lastEpisode.symptoms.map((symptom: string, idx: number) => (
                      <View key={idx} style={styles.symptomPill}>
                        <Text style={styles.symptomPillText}>{symptom}</Text>
                      </View>
                    ))}
                </View>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* 6. SOS Emergency Alert Card */}
      <TouchableOpacity
        style={styles.sosCard}
        onPress={() => navigation.navigate('SOS')}
        activeOpacity={0.85}
      >
        <View style={styles.sosPulseBg} />
        <ShieldAlert size={20} color="#FF5A5F" style={styles.sosIcon} />
        <Text style={styles.sosCardText}>SOS EMERGENCY ASSISTANT</Text>
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
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 24,
  },
  headerLeft: {
    flex: 1,
    gap: 2,
  },
  dateSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSubtle,
  },
  greetingText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  notificationBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 11,
    right: 11,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.textSubtle,
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  riskBadgeContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  riskBadge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  riskBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  riskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  circularWrapper: {
    position: 'relative',
    width: 110,
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circularInner: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circularScoreText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  circularLabelText: {
    fontSize: 8,
    color: theme.colors.textMuted,
    fontWeight: '800',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  factorsContainer: {
    flex: 1,
    marginLeft: 16,
  },
  factorsList: {
    justifyContent: 'center',
  },
  factorsTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.colors.textSubtle,
    letterSpacing: 1,
    marginBottom: 8,
  },
  noFactorsBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
    borderColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
  },
  noFactorsBadgeText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
  },
  factorsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  factorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.06)',
    borderColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    maxWidth: '100%',
  },
  factorPillIcon: {
    marginRight: 4,
  },
  factorPillText: {
    fontSize: 11,
    color: '#EF4444',
    fontWeight: '600',
  },
  tipsSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  aiBadge: {
    backgroundColor: 'rgba(20, 184, 166, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(20, 184, 166, 0.25)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiBadgeIcon: {
    marginRight: 4,
  },
  aiBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.secondary,
  },
  tipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    width: '48%',
    height: 58,
    gap: 8,
    borderWidth: 1.5,
  },
  tipBoxWater: {
    backgroundColor: 'rgba(0, 163, 255, 0.03)',
    borderColor: 'rgba(0, 163, 255, 0.15)',
  },
  tipBoxScreen: {
    backgroundColor: 'rgba(168, 85, 247, 0.03)',
    borderColor: 'rgba(168, 85, 247, 0.15)',
  },
  tipBoxBreak: {
    backgroundColor: 'rgba(99, 102, 241, 0.03)',
    borderColor: 'rgba(99, 102, 241, 0.15)',
  },
  tipBoxRest: {
    backgroundColor: 'rgba(20, 184, 166, 0.03)',
    borderColor: 'rgba(20, 184, 166, 0.15)',
  },
  tipIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.text,
    lineHeight: 16,
  },
  tipEmoji: {
    fontSize: 15,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 28,
  },
  btnPrimary: {
    flex: 1,
    height: 48,
    backgroundColor: theme.colors.primary,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  btnSecondary: {
    flex: 1,
    height: 48,
    borderWidth: 1.5,
    borderColor: theme.colors.secondary,
    backgroundColor: 'rgba(20, 184, 166, 0.05)',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondaryText: {
    color: theme.colors.secondary,
    fontWeight: '700',
    fontSize: 14,
  },
  btnIcon: {
    marginRight: 6,
  },
  episodeSection: {
    marginBottom: 24,
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
  },
  episodeCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
  },
  episodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  severityCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  severityText: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  episodeMeta: {
    flex: 1,
    marginLeft: 16,
  },
  episodeDate: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  episodeDuration: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  episodeTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  symptomPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 6,
  },
  symptomPillText: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  sosCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 90, 95, 0.3)',
    borderRadius: 16,
    backgroundColor: 'rgba(255, 90, 95, 0.05)',
    gap: 8,
    marginBottom: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  sosPulseBg: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255, 90, 95, 0.01)',
  },
  sosIcon: {
    marginRight: 4,
  },
  sosCardText: {
    color: '#FF5A5F',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 1.2,
  },
  alertPopupCard: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  alertPopupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  alertPopupHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  alertPopupTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  dismissBtn: {
    padding: 2,
  },
  alertPopupDismiss: {
    color: theme.colors.textSubtle,
    fontSize: 14,
    fontWeight: 'bold',
  },
  alertPopupMessage: {
    fontSize: 13,
    color: theme.colors.text,
    lineHeight: 18,
  },
  centerCardLoader: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  cardLoaderText: {
    color: theme.colors.textSubtle,
    fontSize: 12,
    fontWeight: '600',
  },
});
