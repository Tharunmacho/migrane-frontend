import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { theme } from '../theme/theme';
import { apiService } from '../services/api';
import { useApp } from '../context/AppContext';
import { Zap, Calendar, TrendingUp, Info, Activity } from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Zero / Default trends for new accounts (no dummy fake data) ───────────────
const ZERO_TRENDS = [
  { dayName: 'Mon', score: 0 },
  { dayName: 'Tue', score: 0 },
  { dayName: 'Wed', score: 0 },
  { dayName: 'Thu', score: 0 },
  { dayName: 'Fri', score: 0 },
  { dayName: 'Sat', score: 0 },
  { dayName: 'Sun', score: 0 },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────
const getRiskColor = (score: number) => {
  if (score >= 75) return theme.colors.risk.high;
  if (score >= 40) return theme.colors.risk.medium;
  return theme.colors.risk.low;
};

const getTriggerColor = (confidence: number) => {
  if (confidence >= 75) return theme.colors.risk.high;
  if (confidence >= 50) return theme.colors.risk.medium;
  return theme.colors.primary;
};

const getBadgeColors = (confidence: number) => {
  if (confidence >= 75) return { text: theme.colors.risk.high, border: 'rgba(239,68,68,0.35)', bg: 'rgba(239,68,68,0.08)' };
  if (confidence >= 50) return { text: theme.colors.risk.medium, border: 'rgba(245,158,11,0.35)', bg: 'rgba(245,158,11,0.08)' };
  return { text: theme.colors.primary, border: 'rgba(99,102,241,0.35)', bg: 'rgba(99,102,241,0.08)' };
};

// ─── Main Component ────────────────────────────────────────────────────────────
export const InsightsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user, refreshTrigger, updatePremiumStatus } = useApp();

  const [activeTab, setActiveTab] = useState<'intelligence' | 'weekly'>('intelligence');
  const [refreshing, setRefreshing] = useState(false);
  const [intelLoading, setIntelLoading] = useState(true);
  const [weeklyLoading, setWeeklyLoading] = useState(true);

  // Dynamic data — starts null so we can show skeleton/spinner until data arrives
  const [topTriggers, setTopTriggers] = useState<any[] | null>(null);
  const [patterns, setPatterns] = useState<any[] | null>(null);
  const [weeklyStats, setWeeklyStats] = useState<any | null>(null);

  // ─── Data fetching ────────────────────────────────────────────────────────
  const fetchIntelligence = async () => {
    try {
      const res = await apiService.getTriggerIntelligence();
      if (res.success && res.data) {
        const mapped = res.data.map((item: any) => ({
          name: item.name,
          confidence: Math.round(item.confidence),
          occurrences: item.occurrences,
          migraineMatches: item.migraineMatches,
        }));
        setTopTriggers(mapped);
        const derived = mapped
          .filter((t: any) => t.confidence >= 50)
          .slice(0, 3)
          .map((t: any) => ({
            title: `${t.name} → Migraine`,
            confidence: t.confidence,
            ratio: `${t.migraineMatches}/${t.occurrences} times`,
          }));
        setPatterns(derived);
      } else {
        setTopTriggers([]);
        setPatterns([]);
      }
    } catch (e) {
      console.warn('Trigger intelligence fetch failed:', e);
      setTopTriggers([]);
      setPatterns([]);
    } finally {
      setIntelLoading(false);
    }
  };

  const fetchWeekly = async () => {
    try {
      const res = await apiService.getWeeklyInsights();
      if (res.success && res.data) {
        const d = res.data;
        const trends =
          d.riskTrends && d.riskTrends.length > 0
            ? d.riskTrends.map((t: any) => ({ dayName: t.dayName, score: t.score }))
            : ZERO_TRENDS;
        setWeeklyStats({
          totalMigraineDays: d.totalMigraineDays ?? 0,
          averageSeverity: d.averageSeverity ?? 0,
          trends,
          topTriggers: d.topTriggers ?? [],
          isPremiumLocked: res.isPremiumLocked ?? false,
        });
      } else {
        setWeeklyStats({
          totalMigraineDays: 0,
          averageSeverity: 0,
          trends: ZERO_TRENDS,
          topTriggers: [],
          isPremiumLocked: false,
        });
      }
    } catch (e) {
      console.warn('Weekly insights fetch failed:', e);
      setWeeklyStats({
        totalMigraineDays: 0,
        averageSeverity: 0,
        trends: ZERO_TRENDS,
        topTriggers: [],
        isPremiumLocked: false,
      });
    } finally {
      setWeeklyLoading(false);
    }
  };

  useEffect(() => {
    setIntelLoading(true);
    setWeeklyLoading(true);
    fetchIntelligence();
    fetchWeekly();
  }, [user?._id, refreshTrigger]);

  const onRefresh = () => {
    setRefreshing(true);
    setIntelLoading(true);
    setWeeklyLoading(true);
    Promise.all([fetchIntelligence(), fetchWeekly()]).finally(() => setRefreshing(false));
  };

  // Real loaded data or empty list if loaded and no items
  const displayTriggers = topTriggers ?? [];
  const displayPatterns = patterns ?? [];
  const displayWeekly = weeklyStats ?? {
    totalMigraineDays: 0,
    averageSeverity: 0,
    trends: ZERO_TRENDS,
    topTriggers: [],
    isPremiumLocked: false,
  };

  // ─── Sub-components ───────────────────────────────────────────────────────

  const renderTriggerIntelligence = () => (
    <View>
      {/* Top Triggers Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Top Triggers</Text>
          <View style={styles.durationBadge}>
            <Text style={styles.durationBadgeText}>LAST 30 DAYS</Text>
          </View>
        </View>

        {intelLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Analyzing patterns...</Text>
          </View>
        ) : displayTriggers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Zap size={24} color={theme.colors.textSubtle} style={styles.emptyIcon} />
            <Text style={styles.emptyText}>
              No trigger correlations detected yet. Keep logging triggers and migraines to generate AI insights.
            </Text>
          </View>
        ) : (
          <View style={styles.triggersList}>
            {displayTriggers.map((trigger, idx) => {
              const color = getTriggerColor(trigger.confidence);
              return (
                <View key={idx} style={styles.triggerRow}>
                  <View style={styles.triggerInfoRow}>
                    <Text style={styles.triggerLabel}>{trigger.name}</Text>
                    <Text style={[styles.triggerVal, { color }]}>{trigger.confidence}%</Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${trigger.confidence}%`, backgroundColor: color },
                      ]}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* AI Pattern Intelligence */}
      <Text style={styles.sectionHeaderTitle}>AI PATTERN INTELLIGENCE</Text>
      <View style={styles.patternsContainer}>
        {displayPatterns.length === 0 ? (
          <View style={styles.emptyPatternCard}>
            <Info size={20} color={theme.colors.textSubtle} style={styles.emptyPatternIcon} />
            <Text style={styles.emptyPatternText}>
              Insufficient log data to calculate patterns. Log at least 3 migraine episodes to generate AI insights.
            </Text>
          </View>
        ) : (
          displayPatterns.map((pattern, idx) => {
            const bc = getBadgeColors(pattern.confidence);
            return (
              <View key={idx} style={styles.patternCard}>
                <View style={styles.patternLeft}>
                  <View style={styles.patternHeaderRow}>
                    <Zap size={12} color="#F59E0B" fill="#F59E0B" />
                    <Text style={styles.patternHeaderLabel}> PATTERN DETECTED</Text>
                  </View>
                  <Text style={styles.patternTitle}>{pattern.title}</Text>
                  <Text style={styles.patternSubText}>{pattern.ratio}</Text>
                </View>
                <View style={[styles.confBadge, { backgroundColor: bc.bg, borderColor: bc.border }]}>
                  <Text style={[styles.confBadgeVal, { color: bc.text }]}>{pattern.confidence}%</Text>
                  <Text style={[styles.confBadgeLabel, { color: bc.text }]}>CONF.</Text>
                </View>
              </View>
            );
          })
        )}
      </View>
    </View>
  );

  const renderWeeklyReport = () => {
    const maxScore = Math.max(...displayWeekly.trends.map((t: any) => t.score), 1);

    return (
      <View>
        {/* ── Metric Summary Row: 2 equal cards side by side ── */}
        <View style={styles.metricsRow}>
          {/* Migraine Days */}
          <View style={styles.metricCard}>
            <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(99, 102, 241, 0.12)' }]}>
              <Calendar size={22} color={theme.colors.primary} />
            </View>
            <Text style={styles.metricValue}>{displayWeekly.totalMigraineDays}</Text>
            <Text style={styles.metricUnit}>days this week</Text>
            <Text style={styles.metricLabel}>Migraine Days</Text>
          </View>

          {/* Average Severity */}
          <View style={styles.metricCard}>
            <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
              <TrendingUp size={22} color="#EF4444" />
            </View>
            <Text style={styles.metricValue}>
              {displayWeekly.averageSeverity > 0 ? displayWeekly.averageSeverity.toFixed(1) : '0.0'}
            </Text>
            <Text style={styles.metricUnit}>out of 10</Text>
            <Text style={styles.metricLabel}>Avg Severity</Text>
          </View>
        </View>

        {/* ── 7-Day Risk Trend Chart ── */}
        <View style={styles.card}>
          <View style={styles.chartHeader}>
            <View style={styles.chartTitleRow}>
              <Activity size={16} color={theme.colors.primary} />
              <Text style={styles.chartTitle}> 7-Day Risk Trend</Text>
            </View>
            <Text style={styles.chartSubtitle}>
              Predicted risk score forecasts over the past week
            </Text>
          </View>

          {weeklyLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={styles.loadingText}>Computing risk scores...</Text>
            </View>
          ) : (
            <View style={styles.chartWrapper}>
              <View style={[styles.chartContainer, displayWeekly.isPremiumLocked ? styles.blurChart : null]}>
                {displayWeekly.trends.map((day: any, idx: number) => {
                  const barColor = getRiskColor(day.score);
                  // Height proportional to max score in range [8%, 100%]
                  const heightPct = day.score > 0
                    ? Math.max(8, Math.round((day.score / maxScore) * 100))
                    : 6;

                  return (
                    <View key={idx} style={styles.chartColumn}>
                      {/* Score label above bar */}
                      <Text style={[styles.chartScoreLabel, { color: barColor }]}>
                        {day.score > 0 ? `${day.score}%` : '—'}
                      </Text>
                      {/* Bar track */}
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.barFill,
                            { height: `${heightPct}%`, backgroundColor: barColor },
                          ]}
                        />
                      </View>
                      {/* Day label */}
                      <Text style={styles.chartDayLabel}>{day.dayName}</Text>
                    </View>
                  );
                })}
              </View>

              {displayWeekly.isPremiumLocked && (
                <View style={styles.lockOverlay}>
                  <Zap size={24} color="#F59E0B" fill="#F59E0B" style={{ marginBottom: 12 }} />
                  <Text style={styles.lockTitle}>Premium Feature</Text>
                  <Text style={styles.lockSubtitle}>
                    Unlock 7-day risk forecasts and advanced pattern analysis
                  </Text>
                  <TouchableOpacity
                    style={styles.unlockBtn}
                    onPress={async () => {
                      try {
                        const res = await apiService.subscribePremium();
                        if (res.success) {
                          // Update app context premium status
                          updatePremiumStatus(true);
                          // Re-fetch weekly reports immediately
                          onRefresh();
                          Alert.alert('VIP Premium Status', 'Thank you for subscribing! Premium features are now unlocked.');
                        }
                      } catch (err: any) {
                        Alert.alert('Subscription Failed', err.response?.data?.message || err.message);
                      }
                    }}
                  >
                    <Text style={styles.unlockBtnText}>Upgrade to Premium</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* Legend */}
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
              <Text style={styles.legendText}>Low</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
              <Text style={styles.legendText}>Medium</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
              <Text style={styles.legendText}>High</Text>
            </View>
          </View>
        </View>

        {/* Weekly Top Triggers Section */}
        <Text style={styles.sectionHeaderTitle}>WEEKLY TOP CORRELATED TRIGGERS</Text>
        <View style={styles.card}>
          {weeklyLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={styles.loadingText}>Analyzing weekly triggers...</Text>
            </View>
          ) : !displayWeekly.topTriggers || displayWeekly.topTriggers.length === 0 ? (
            <Text style={styles.emptyWeeklyTriggersText}>
              Log more symptoms and triggers to find weekly correlations.
            </Text>
          ) : (
            <View style={styles.triggersList}>
              {displayWeekly.topTriggers.map((trigger: any, idx: number) => {
                const color = getTriggerColor(trigger.confidence);
                return (
                  <View key={idx} style={styles.triggerRow}>
                    <View style={styles.triggerInfoRow}>
                      <Text style={styles.triggerLabel}>{trigger.name}</Text>
                      <Text style={[styles.triggerVal, { color }]}>{trigger.confidence}% correlation</Text>
                    </View>
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          { width: `${trigger.confidence}%`, backgroundColor: color },
                        ]}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* ── Info note ── */}
        <View style={styles.infoCard}>
          <Info size={15} color={theme.colors.secondary} />
          <Text style={styles.infoCardText}>
            Risk scores are computed from your logged triggers each day. Logging daily triggers improves prediction accuracy.
          </Text>
        </View>
      </View>
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
      }
    >
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.title}>Insights</Text>
        <Text style={styles.subtitle}>AI-powered pattern analysis</Text>
      </View>

      {/* ── Tab Switcher ── */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'intelligence' ? styles.tabActive : null]}
          onPress={() => setActiveTab('intelligence')}
        >
          <Text style={[styles.tabText, activeTab === 'intelligence' ? styles.tabTextActive : null]}>
            Trigger Intelligence
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'weekly' ? styles.tabActive : null]}
          onPress={() => setActiveTab('weekly')}
        >
          <Text style={[styles.tabText, activeTab === 'weekly' ? styles.tabTextActive : null]}>
            Weekly Report
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Tab Content ── */}
      {activeTab === 'intelligence' ? renderTriggerIntelligence() : renderWeeklyReport()}
    </ScrollView>
  );
};

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 20, paddingBottom: 56 },

  header: { marginTop: 8, marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '900', color: '#F8FAFC' },
  subtitle: { fontSize: 13, color: '#64748B', marginTop: 4, fontWeight: '500' },

  // Tab bar
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    padding: 4,
    marginBottom: 24,
    height: 48,
    alignItems: 'center',
  },
  tabButton: {
    flex: 1,
    height: '100%',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: { backgroundColor: theme.colors.primary },
  tabText: { fontSize: 13, fontWeight: '700', color: '#64748B' },
  tabTextActive: { color: '#FFFFFF', fontWeight: '800' },

  // Card base
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 20,
    marginBottom: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardTitle: { fontSize: 17, fontWeight: '800', color: '#F8FAFC' },
  durationBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.25)',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  durationBadgeText: { color: theme.colors.primary, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },

  // Triggers list
  triggersList: { gap: 18 },
  triggerRow: {},
  triggerInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  triggerLabel: { color: '#F8FAFC', fontSize: 14, fontWeight: '600', flex: 1 },
  triggerVal: { fontSize: 14, fontWeight: '800' },
  progressTrack: { height: 7, backgroundColor: theme.colors.border, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },

  // Loading
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 20,
  },
  loadingText: { color: '#64748B', fontSize: 13, fontWeight: '500' },

  // Pattern section
  sectionHeaderTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 1.5,
    marginBottom: 14,
    marginTop: 4,
  },
  patternsContainer: { gap: 12, marginBottom: 4 },
  patternCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },
  patternLeft: { flex: 1, paddingRight: 12 },
  patternHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  patternHeaderLabel: { fontSize: 10, fontWeight: '800', color: '#F59E0B', letterSpacing: 0.5 },
  patternTitle: { color: '#F8FAFC', fontSize: 14, fontWeight: '700', lineHeight: 19, marginBottom: 4 },
  patternSubText: { fontSize: 12, color: '#64748B', fontWeight: '500' },
  confBadge: {
    width: 62,
    height: 54,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  confBadgeVal: { fontSize: 16, fontWeight: '900' },
  confBadgeLabel: { fontSize: 8, fontWeight: '800', marginTop: 1 },

  // ── Weekly Report ─────────────────────────────────────────────────────────
  metricsRow: {
    flexDirection: 'row',
    marginBottom: 20,
    alignItems: 'stretch',
    gap: 16,
  },
  metricCard: {
    width: (SCREEN_WIDTH - 56) / 2, // Explicitly calculate width to split space equally inside ScrollView
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 12,
    alignItems: 'center',
    minHeight: 160,
    justifyContent: 'flex-start',
  },
  metricIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 32,
    fontWeight: '900',
    color: '#F8FAFC',
    lineHeight: 36,
  },
  metricUnit: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
    marginBottom: 8,
    textAlign: 'center',
  },
  metricLabel: {
    fontSize: 13,
    color: '#F8FAFC',
    fontWeight: '800',
    textAlign: 'center',
  },
  metricSub: {
    fontSize: 10,
    color: '#475569',
    fontWeight: '500',
    marginTop: 2,
  },

  // Chart
  chartHeader: { marginBottom: 20 },
  chartTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  chartTitle: { fontSize: 16, fontWeight: '800', color: '#F8FAFC' },
  chartSubtitle: { fontSize: 12, color: '#64748B', fontWeight: '500', marginTop: 2 },

  chartWrapper: {
    position: 'relative',
  },
  blurChart: {
    opacity: 0.15,
  },
  lockOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(21, 30, 46, 0.85)',
    borderRadius: 16,
    paddingHorizontal: 20,
  },
  lockTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  lockSubtitle: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 15,
  },
  unlockBtn: {
    backgroundColor: theme.colors.risk.medium,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    elevation: 2,
    shadowColor: theme.colors.risk.medium,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  unlockBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },

  chartContainer: {
    flexDirection: 'row',
    height: 180,
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 16,
  },
  chartColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 3,
  },
  chartScoreLabel: {
    fontSize: 9,
    fontWeight: '800',
    marginBottom: 5,
    textAlign: 'center',
  },
  barTrack: {
    width: '100%',
    maxWidth: 28,
    height: 120,
    backgroundColor: theme.colors.border,
    borderRadius: 8,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 8,
    minHeight: 6,
  },
  chartDayLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
  },

  // Legend
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    paddingTop: 4,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: '#64748B', fontWeight: '600' },

  emptyWeeklyTriggersText: {
    color: '#64748B',
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  emptyIcon: {
    marginBottom: 12,
    opacity: 0.8,
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '500',
  },
  emptyPatternCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyPatternIcon: {
    marginBottom: 10,
    opacity: 0.8,
  },
  emptyPatternText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    fontWeight: '500',
  },

  // Info card
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(20, 184, 166, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(20, 184, 166, 0.15)',
    borderRadius: 16,
    padding: 14,
    gap: 10,
    marginBottom: 8,
  },
  infoCardText: {
    flex: 1,
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
    paddingTop: 1,
  },
});
