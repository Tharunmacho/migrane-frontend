export const theme = {
  colors: {
    background: '#0B0F19',     // Soothing deep slate midnight
    surface: '#151E2E',        // Deep slate card background
    surfaceLight: '#1F2D44',   // Highlight card background
    primary: '#6366F1',        // Calming Indigo (Shadow work, intuition)
    secondary: '#14B8A6',      // Healing Teal (Pain relief, tracking)
    border: '#1E293B',         // Subtle border color
    text: '#F8FAFC',           // Primary off-white text
    textMuted: '#94A3B8',      // Soft slate text
    textSubtle: '#64748B',     // Very muted/placeholder text
    
    // Risk Indicators (soft, non-harsh tones)
    risk: {
      low: '#10B981',          // Soft Emerald
      medium: '#F59E0B',       // Warm Honey Amber
      high: '#EF4444',         // Muted Crimson Red
    },
    
    // UI Accents
    accent: '#6366F1',
    accentMuted: 'rgba(99, 102, 241, 0.1)',
    dangerMuted: 'rgba(239, 68, 68, 0.1)',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  borderRadius: {
    sm: 6,
    md: 12,
    lg: 18,
    xl: 24,
    round: 9999,
  },
  typography: {
    fontRegular: 'System',
    fontBold: 'System',
  }
};
export type Theme = typeof theme;

