import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Base URL configuration
let BASE_URL = 'http://10.60.20.174:5000/api'; // Host PC local Wi-Fi IP (more reliable than loopback on physical device)

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 10000, // 10s timeout for MongoDB Atlas latency
  adapter: 'fetch', // Force Axios to use the native fetch API (resolves XMLHttpRequest bugs in Bridgeless mode)
});

// Keys for local storage
const MOCK_UID_KEY = '@auracast_mock_uid';
const MOCK_EMAIL_KEY = '@auracast_mock_email';
const MOCK_NAME_KEY = '@auracast_mock_name';
const BASE_URL_KEY = '@auracast_base_url';
const FIREBASE_TOKEN_KEY = '@auracast_firebase_token';

// ─── In-memory cache: loaded once on startup, updated on login ─────────────────
// This is the KEY optimization: instead of reading AsyncStorage on every request
// (which adds 5-30ms per call via the JS bridge), we cache in memory.
let _memMockUid: string = 'dev_mock_user_123';
let _memMockEmail: string = 'dev_mock@example.com';
let _memMockName: string = 'Developer Mock User';
let _memFirebaseToken: string | null = null;
let _memBaseUrl: string | null = null;
let _memCacheReady = false;
let _loadCachePromise: Promise<void> | null = null;

/** Call once at app startup to populate the in-memory header cache with proper synchronization */
function loadHeaderCache(): Promise<void> {
  if (_memCacheReady) return Promise.resolve();
  if (_loadCachePromise) return _loadCachePromise;

  _loadCachePromise = (async () => {
    try {
      const [uid, email, name, baseUrl, firebaseToken] = await Promise.all([
        AsyncStorage.getItem(MOCK_UID_KEY),
        AsyncStorage.getItem(MOCK_EMAIL_KEY),
        AsyncStorage.getItem(MOCK_NAME_KEY),
        AsyncStorage.getItem(BASE_URL_KEY),
        AsyncStorage.getItem(FIREBASE_TOKEN_KEY),
      ]);
      if (uid) _memMockUid = uid;
      if (email) _memMockEmail = email;
      if (name) _memMockName = name;
      _memBaseUrl = baseUrl;
      if (firebaseToken) _memFirebaseToken = firebaseToken;
      _memCacheReady = true;
    } catch (err) {
      console.warn('Failed to load header cache from AsyncStorage:', err);
      _memCacheReady = true; // Set to true to avoid infinite retry loops on failure
    } finally {
      _loadCachePromise = null;
    }
  })();

  return _loadCachePromise;
}

// Load cache immediately when module is imported
loadHeaderCache();

// Set headers before each request — PURELY from memory, no AsyncStorage I/O
client.interceptors.request.use(
  (config) => {
    // Use dynamic base URL if configured
    if (_memBaseUrl) config.baseURL = _memBaseUrl;

    console.log('[Axios Request]', config.method?.toUpperCase(), (config.baseURL || '') + (config.url || ''));

    // Attach Firebase bearer token if present
    if (_memFirebaseToken) {
      config.headers.Authorization = `Bearer ${_memFirebaseToken}`;
    } else {
      // Attach mock auth headers from memory cache (instant — no async I/O)
      config.headers['x-mock-user-uid'] = _memMockUid;
      config.headers['x-mock-user-email'] = _memMockEmail;
      config.headers['x-mock-user-name'] = _memMockName;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

export const apiService = {
  // Base config helpers
  getBaseUrl: async () => _memBaseUrl || BASE_URL,
  setBaseUrl: async (url: string) => {
    _memBaseUrl = url;
    await AsyncStorage.setItem(BASE_URL_KEY, url);
  },

  // Ensure header cache is fully loaded before continuing (guards against race conditions)
  ensureHeaderCacheLoaded: async () => {
    await loadHeaderCache();
  },

  // Firebase token helpers
  getFirebaseAuthToken: () => _memFirebaseToken,
  setFirebaseAuthToken: async (token: string | null) => {
    _memFirebaseToken = token;
    if (token) {
      await AsyncStorage.setItem(FIREBASE_TOKEN_KEY, token);
    } else {
      await AsyncStorage.removeItem(FIREBASE_TOKEN_KEY);
    }
  },

  // Clear mock profile on logout
  clearMockProfile: async () => {
    _memMockUid = 'dev_mock_user_123';
    _memMockEmail = 'dev_mock@example.com';
    _memMockName = 'Developer Mock User';
    _memFirebaseToken = null;
    _memCacheReady = true;
    await Promise.all([
      AsyncStorage.removeItem(MOCK_UID_KEY),
      AsyncStorage.removeItem(MOCK_EMAIL_KEY),
      AsyncStorage.removeItem(MOCK_NAME_KEY),
      AsyncStorage.removeItem(FIREBASE_TOKEN_KEY),
    ]);
  },

  // Developer Auth helpers — update both memory and storage
  getMockProfile: () => ({
    uid: _memMockUid,
    email: _memMockEmail,
    name: _memMockName,
  }),
  setMockProfile: async (uid: string, email: string, name: string) => {
    // Update memory cache immediately
    _memMockUid = uid;
    _memMockEmail = email;
    _memMockName = name;
    _memCacheReady = true;
    // Persist to storage in background
    await Promise.all([
      AsyncStorage.setItem(MOCK_UID_KEY, uid),
      AsyncStorage.setItem(MOCK_EMAIL_KEY, email),
      AsyncStorage.setItem(MOCK_NAME_KEY, name),
    ]);
  },

  // --- Backend Endpoints ---

  // Auth
  signUp: async (data: { displayName: string; email: string; password?: string }) => {
    const response = await client.post('/auth/signup', data);
    return response.data;
  },
  signIn: async (data: { email: string; password?: string }) => {
    const response = await client.post('/auth/signin', data);
    return response.data;
  },
  syncUser: async () => {
    const response = await client.get('/auth/sync');
    return response.data;
  },
  subscribePremium: async () => {
    const response = await client.post('/auth/subscribe');
    return response.data;
  },
  updatePushToken: async (pushToken: string) => {
    const response = await client.post('/auth/pushtoken', { pushToken });
    return response.data;
  },

  // Daily Prediction / Risk
  getDailyPrediction: async () => {
    const response = await client.get('/triggers/prediction');
    return response.data;
  },

  // Daily Triggers
  getTodayTriggers: async () => {
    const response = await client.get('/triggers/today');
    return response.data;
  },
  logTriggers: async (data: {
    date: string;
    sleepHours: number | null;
    waterIntake: number | null;
    screenTime: number | null;
    stressLevel: number | null;
    physicalActivity: boolean;
    foodTriggers: string[];
    environmentalTriggers: string[];
    healthTriggers: string[];
  }) => {
    const response = await client.post('/triggers', data);
    return response.data;
  },

  // Migraine Journal Logs
  getMigraineHistory: async () => {
    const response = await client.get('/logs/history');
    return response.data;
  },
  createMigraineLog: async (data: {
    date: string;
    startTime: string;
    endTime?: string;
    painSeverity: number;
    symptoms: string[];
    notes: string;
    isVoiceLog?: boolean;
    audioFileUrl?: string;
  }) => {
    const response = await client.post('/logs/migraine', data);
    return response.data;
  },

  // Voice Logging
  uploadVoiceLog: async (audioUri: string) => {
    const formData = new FormData();
    const uriParts = audioUri.split('/');
    const filename = uriParts[uriParts.length - 1] || 'audio-log.m4a';
    const extension = filename.split('.').pop() || 'm4a';
    formData.append('audio', {
      uri: audioUri,
      name: filename,
      type: `audio/${extension === 'mp3' ? 'mpeg' : extension}`,
    } as any);

    const baseUrl = await apiService.getBaseUrl();
    const token = apiService.getFirebaseAuthToken();

    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    } else {
      // Fallback mock headers
      const mockProfile = apiService.getMockProfile();
      headers['x-mock-user-uid'] = mockProfile.uid;
      headers['x-mock-user-email'] = mockProfile.email;
      headers['x-mock-user-name'] = mockProfile.name;
    }

    const response = await fetch(`${baseUrl}/logs/voice`, {
      method: 'POST',
      headers: headers,
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload failed: ${response.status} - ${errorText || response.statusText}`);
    }

    return await response.json();
  },

  // Trigger Intelligence
  getTriggerIntelligence: async () => {
    const response = await client.get('/triggers/intelligence');
    return response.data;
  },

  // Weekly Report Insights
  getWeeklyInsights: async () => {
    const response = await client.get('/insights/weekly');
    return response.data;
  },

  // SOS Emergency Contacts
  getContacts: async () => {
    const response = await client.get('/contacts');
    return response.data;
  },
  addContact: async (contact: { name: string; relationship: string; phoneNumber: string }) => {
    const response = await client.post('/contacts', contact);
    return response.data;
  },
  deleteContact: async (contactId: string) => {
    const response = await client.delete(`/contacts/${contactId}`);
    return response.data;
  },
  triggerSOS: async () => {
    const response = await client.post('/contacts/trigger');
    return response.data;
  },
  sendMessageToAI: async (message: string) => {
    const response = await client.post('/chat', { message });
    return response.data;
  },
};
