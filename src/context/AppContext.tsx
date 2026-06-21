import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from '../services/api';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  date: string;
  read: boolean;
  category?: 'home' | 'journal' | 'triggers';
}

interface UserProfile {
  _id: string;
  firebaseUid: string;
  email: string;
  displayName?: string;
  isPremium: boolean;
  pushToken?: string | null;
}

interface AppContextProps {
  user: UserProfile | null;
  loading: boolean;
  syncUser: (cachedProfile?: UserProfile) => Promise<void>;
  updatePremiumStatus: (status: boolean) => void;
  refreshTrigger: number;
  triggerRefresh: () => void;
  notifications: NotificationItem[];
  dismissedIds: string[];
  addNotification: (title: string, message: string, category?: 'home' | 'journal' | 'triggers') => Promise<void>;
  markAllNotificationsAsRead: () => Promise<void>;
  clearAllNotifications: () => Promise<void>;
  dismissNotification: (id: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AppContext = createContext<AppContextProps | undefined>(undefined);

// In-memory cache for mock profile keys — avoids AsyncStorage reads on every request
let _cachedMockUid: string | null = null;
let _cachedMockEmail: string | null = null;
let _cachedMockName: string | null = null;
let _profileCacheLoaded = false;

/** Preload mock profile keys into memory so subsequent reads are instant */
async function preloadMockProfileCache() {
  if (_profileCacheLoaded) return;
  const [uid, email, name] = await Promise.all([
    AsyncStorage.getItem('@auracast_mock_uid'),
    AsyncStorage.getItem('@auracast_mock_email'),
    AsyncStorage.getItem('@auracast_mock_name'),
  ]);
  _cachedMockUid = uid;
  _cachedMockEmail = email;
  _cachedMockName = name;
  _profileCacheLoaded = true;
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const syncingRef = useRef(false); // Guard: prevent parallel notification syncs
  const networkSyncDoneRef = useRef(false); // Track if background network sync ran

  // ─── Notification sync: runs in background, never blocks UI ──────────────────
  const syncDbNotifications = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;

    const userId = user?._id;
    if (!userId || userId === 'dev_local_fallback_id') {
      syncingRef.current = false;
      return;
    }

    try {
      // Fire all 3 API calls + 2 storage reads in parallel
      const [triggersResult, logsResult, predResult, readStatusStr, dismissedStr] = await Promise.all([
        apiService.getTodayTriggers().catch(() => null),
        apiService.getMigraineHistory().catch(() => null),
        apiService.getDailyPrediction().catch(() => null),
        AsyncStorage.getItem(`@auracast_read_notifications_${userId}`).catch(() => null),
        AsyncStorage.getItem(`@auracast_dismissed_notifications_${userId}`).catch(() => null),
      ]);

      const readIds: string[] = readStatusStr ? JSON.parse(readStatusStr) : [];
      const dismissedList: string[] = dismissedStr ? JSON.parse(dismissedStr) : [];
      const newNotifications: NotificationItem[] = [];

      if (triggersResult && triggersResult.success && triggersResult.data) {
        const t = triggersResult.data;
        const triggerUserId = t.userId || t.user;
        if (!triggerUserId || triggerUserId.toString() === userId.toString()) {
          newNotifications.push({
            id: `trigger_${userId}_${t._id || new Date(t.date).getTime()}`,
            title: 'Daily Triggers Logged',
            message: `Sleep: ${t.sleepHours || 0}h, Water: ${t.waterIntake || 0} glasses, Stress: ${t.stressLevel || 0}/10.`,
            date: t.date || new Date().toISOString(),
            read: false,
            category: 'triggers',
          });
        }
      }

      if (logsResult && logsResult.success && logsResult.data && logsResult.data.length > 0) {
        const latestLog = logsResult.data[0];
        const logUserId = latestLog.userId || latestLog.user;
        if (!logUserId || logUserId.toString() === userId.toString()) {
          const formattedDate = new Date(latestLog.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          newNotifications.push({
            id: `migraine_${userId}_${latestLog._id}`,
            title: 'Migraine Episode Logged',
            message: `Severity ${latestLog.painSeverity}/10 on ${formattedDate} at ${latestLog.startTime}. Symptoms: ${(latestLog.symptoms || []).slice(0, 3).join(', ')}.`,
            date: latestLog.date,
            read: false,
            category: 'journal',
          });
        }
      }

      if (predResult && predResult.success && predResult.data) {
        const p = predResult.data;
        if (p.score >= 75) {
          newNotifications.push({
            id: `pred_${userId}_${new Date().toISOString().split('T')[0]}`,
            title: '⚠️ High Migraine Risk Warning',
            message: `Risk score is ${p.score}% (${p.status}) today. Factors: ${(p.riskFactors || []).join(', ')}.`,
            date: new Date().toISOString(),
            read: false,
            category: 'home',
          });
        }
      }

      const processed = newNotifications.map(n => ({
        ...n,
        read: readIds.includes(n.id) || dismissedList.includes(n.id),
      }));
      processed.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setNotifications(processed);
      setDismissedIds(dismissedList);
    } catch (err) {
      console.warn('Failed to sync database notifications:', err);
    } finally {
      syncingRef.current = false;
    }
  }, [user?._id]);

  // ─── Notification state reset on user change ──────────────────────────────
  useEffect(() => {
    if (!user?._id) {
      setNotifications([]);
      setDismissedIds([]);
      return;
    }
    // Load dismissed IDs from storage, then fire background notification sync
    AsyncStorage.getItem(`@auracast_dismissed_notifications_${user._id}`)
      .then(stored => setDismissedIds(stored ? JSON.parse(stored) : []))
      .catch(() => { });
    // Sync notifications in background (non-blocking)
    AsyncStorage.getItem('@auracast_logged_in').then(loggedIn => {
      if (loggedIn === 'true') syncDbNotifications();
    }).catch(() => { });
  }, [user?._id, syncDbNotifications]);

  // ─── Notification actions ─────────────────────────────────────────────────
  const addNotification = useCallback(async (_title: string, _message: string, _category?: 'home' | 'journal' | 'triggers') => {
    const userId = user?._id;
    if (!userId) return;
    // Re-sync from DB after a short delay to get fresh state (avoids duplicates)
    setTimeout(() => syncDbNotifications(), 600);
  }, [user?._id, syncDbNotifications]);

  const markAllNotificationsAsRead = useCallback(async () => {
    const userId = user?._id;
    if (!userId) return;
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, read: true }));
      AsyncStorage.setItem(`@auracast_read_notifications_${userId}`, JSON.stringify(updated.map(u => u.id))).catch(console.warn);
      return updated;
    });
  }, [user?._id]);

  const clearAllNotifications = useCallback(async () => {
    const userId = user?._id;
    if (!userId) return;
    await Promise.all([
      AsyncStorage.removeItem(`@auracast_read_notifications_${userId}`),
      AsyncStorage.removeItem(`@auracast_dismissed_notifications_${userId}`),
    ]).catch(console.warn);
    setNotifications([]);
    setDismissedIds([]);
  }, [user?._id]);

  const dismissNotification = useCallback(async (id: string) => {
    const userId = user?._id;
    if (!userId) return;
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)));
    setDismissedIds(prev => {
      const updated = prev.includes(id) ? prev : [...prev, id];
      AsyncStorage.setItem(`@auracast_dismissed_notifications_${userId}`, JSON.stringify(updated)).catch(console.warn);
      AsyncStorage.getItem(`@auracast_read_notifications_${userId}`)
        .then(stored => {
          const readIds: string[] = stored ? JSON.parse(stored) : [];
          if (!readIds.includes(id)) {
            AsyncStorage.setItem(`@auracast_read_notifications_${userId}`, JSON.stringify([...readIds, id])).catch(console.warn);
          }
        }).catch(console.warn);
      return updated;
    });
  }, [user?._id]);

  // ─── Core startup: read ALL from cache simultaneously, show UI instantly ─────
  const syncUser = useCallback(async (cachedProfile?: UserProfile) => {
    try {
      // If a cached user profile is passed (e.g., during login), load it instantly
      if (cachedProfile) {
        setUser(cachedProfile);
        setLoading(false);
        // Persist cached user in background (non-blocking)
        AsyncStorage.setItem('@auracast_cached_user', JSON.stringify(cachedProfile)).catch(() => { });
        // Also ensure headers are initialized in memory immediately
        await apiService.setMockProfile(cachedProfile._id, cachedProfile.email, cachedProfile.displayName || '');
        return;
      }
      // 1. Ensure API interceptor cache is loaded from AsyncStorage first to prevent race conditions
      await apiService.ensureHeaderCacheLoaded();

      // 2. Read everything we need in ONE parallel batch — no sequential reads
      const [loggedIn, cachedUserStr, mockUid, mockEmail, mockName] = await Promise.all([
        AsyncStorage.getItem('@auracast_logged_in'),
        AsyncStorage.getItem('@auracast_cached_user'),
        AsyncStorage.getItem('@auracast_mock_uid'),
        AsyncStorage.getItem('@auracast_mock_email'),
        AsyncStorage.getItem('@auracast_mock_name'),
      ]);

      // Cache mock profile in memory so api.ts interceptor reads are instant
      _cachedMockUid = mockUid;
      _cachedMockEmail = mockEmail;
      _cachedMockName = mockName;
      _profileCacheLoaded = true;

      // Construct fallback user from mock profile if it exists, so we don't start with null/Sarah
      if (mockUid && mockEmail) {
        const fallbackUser: UserProfile = {
          _id: mockUid,
          firebaseUid: mockUid,
          email: mockEmail,
          displayName: mockName || undefined,
          isPremium: true,
        };
        setUser(fallbackUser);
      }

      // If not logged in and no real user stored, bail immediately
      if (loggedIn !== 'true' && !cachedUserStr) {
        setLoading(false);
        return;
      }

      // Show cached user IMMEDIATELY — this is what removes the loading spinner right away
      if (cachedUserStr) {
        const cached = JSON.parse(cachedUserStr);
        setUser(cached);
        setLoading(false); // UI is visible NOW — no waiting for network
      }

      // Background: fetch fresh profile from backend (does NOT block UI)
      if (loggedIn === 'true') {
        apiService.syncUser()
          .then(res => {
            if (res.success && res.data) {
              setUser(res.data);
              AsyncStorage.setItem('@auracast_cached_user', JSON.stringify(res.data)).catch(() => { });
            }
          })
          .catch(err => console.warn('Background user sync failed (non-critical):', err));
      }
    } catch (error) {
      console.warn('Failed to load user from cache:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const updatePremiumStatus = (status: boolean) => {
    if (user) setUser({ ...user, isPremium: status });
  };

  const triggerRefresh = useCallback(async () => {
    setRefreshTrigger(prev => prev + 1);
    // Kick off background notification refresh — non-blocking
    AsyncStorage.getItem('@auracast_logged_in').then(loggedIn => {
      if (loggedIn === 'true') syncDbNotifications();
    }).catch(() => { });
  }, [syncDbNotifications]);

  const logout = useCallback(async () => {
    setUser(null);
    setNotifications([]);
    setDismissedIds([]);
  }, []);

  // Run syncUser once on mount
  useEffect(() => {
    syncUser();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AppContext.Provider
      value={{
        user,
        loading,
        syncUser,
        updatePremiumStatus,
        refreshTrigger,
        triggerRefresh,
        notifications,
        dismissedIds,
        addNotification,
        markAllNotificationsAsRead,
        clearAllNotifications,
        dismissNotification,
        logout,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
