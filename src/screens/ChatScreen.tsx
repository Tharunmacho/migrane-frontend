import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { theme } from '../theme/theme';
import { apiService } from '../services/api';
import { Send, Sparkles, Trash2, Bot } from 'lucide-react-native';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

const ONBOARDING_SUGGESTIONS = [
  {
    title: "Dealing with a migraine",
    desc: "Get emergency relief techniques",
    prompt: "Dealing with a migraine now",
    icon: "🌊",
  },
  {
    title: "What is shadow work?",
    desc: "Learn about suppressed stress",
    prompt: "What is shadow work?",
    icon: "🕯️",
  },
  {
    title: "Quick stress relief",
    desc: "Calm your nervous system",
    prompt: "Quick stress relief exercise",
    icon: "🧘",
  },
  {
    title: "Sleep and migraines",
    desc: "Analyze sleep trigger connection",
    prompt: "How sleep affects migraines",
    icon: "💤",
  }
];

export const ChatScreen: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      text: "Hello! I am your Orlese Wellness Assistant. I am here to help you trace the connections between your emotional stress (shadow work) and physical migraine triggers. Ask me anything, or pick a suggestion below.",
      sender: 'ai',
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  // Typing animation dot opacities
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    let anim1: Animated.CompositeAnimation;
    let anim2: Animated.CompositeAnimation;
    let anim3: Animated.CompositeAnimation;

    if (sending) {
      const animate = (dotVal: Animated.Value, delay: number) => {
        return Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(dotVal, {
              toValue: 1,
              duration: 350,
              useNativeDriver: true,
            }),
            Animated.timing(dotVal, {
              toValue: 0.3,
              duration: 350,
              useNativeDriver: true,
            })
          ])
        );
      };
      
      anim1 = animate(dot1, 0);
      anim2 = animate(dot2, 100);
      anim3 = animate(dot3, 200);

      anim1.start();
      anim2.start();
      anim3.start();
    } else {
      dot1.setValue(0.3);
      dot2.setValue(0.3);
      dot3.setValue(0.3);
    }

    return () => {
      if (anim1) anim1.stop();
      if (anim2) anim2.stop();
      if (anim3) anim3.stop();
    };
  }, [sending]);

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim()) return;
    
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      text: textToSend.trim(),
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setSending(true);
    
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const res = await apiService.sendMessageToAI(userMsg.text);
      if (res.success && res.data) {
        const aiMsg: Message = {
          id: `ai-${Date.now()}`,
          text: res.data.reply,
          sender: 'ai',
          timestamp: new Date(res.data.timestamp || Date.now())
        };
        setMessages(prev => [...prev, aiMsg]);
      }
    } catch (err: any) {
      console.warn("AI Chat API failed:", err);
      const fallbackReply = "I'm having a small connectivity issue, but remember: physical pain often mirrors emotional congestion. Focus on slow, diaphragmatic breathing and rest your eyes in a dim room.";
      const errorMsg: Message = {
        id: `ai-err-${Date.now()}`,
        text: fallbackReply,
        sender: 'ai',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setSending(false);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: 'welcome',
        text: "Hello! I am your Orlese Wellness Assistant. I am here to help you trace the connections between your emotional stress (shadow work) and physical migraine triggers. Ask me anything, or pick a suggestion below.",
        sender: 'ai',
        timestamp: new Date()
      }
    ]);
  };

  // Determine if we should show the beautiful onboarding grid
  const showOnboarding = messages.filter(m => m.sender === 'user').length === 0;

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Premium Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatarPulseBg} />
            <Bot size={22} color={theme.colors.primary} />
            <View style={styles.statusIndicator} />
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={styles.title}>Orlese AI Companion</Text>
            <View style={styles.onlineBadge}>
              <Text style={styles.onlineText}>Wellness Companion • Active</Text>
            </View>
          </View>
        </View>
        {messages.length > 1 && (
          <TouchableOpacity 
            style={styles.clearBtn} 
            onPress={handleClearChat}
            activeOpacity={0.7}
          >
            <Trash2 size={18} color={theme.colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView 
        style={styles.messageArea}
        contentContainerStyle={[
          styles.messageAreaContent,
          showOnboarding && styles.onboardingContainerStyle
        ]}
        ref={scrollViewRef}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        showsVerticalScrollIndicator={false}
      >
        {showOnboarding ? (
          /* Beautiful Onboarding UI */
          <View style={styles.onboardingWrapper}>
            <View style={styles.botIconLargeContainer}>
              <View style={styles.botIconLargePulse} />
              <Bot size={44} color={theme.colors.primary} />
              <Sparkles size={18} color={theme.colors.secondary} style={styles.sparkleIconAbsolute} />
            </View>

            <Text style={styles.onboardingGreeting}>Empathetic Mind-Body Support</Text>
            <Text style={styles.onboardingDescription}>
              Ask me about tracing emotional tension (shadow work), establishing coping strategies, or managing your personal migraine triggers.
            </Text>

            <Text style={styles.sectionTitle}>Get Started with a Topic</Text>
            <View style={styles.onboardingGrid}>
              {ONBOARDING_SUGGESTIONS.map((item, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.onboardingCard}
                  onPress={() => handleSend(item.prompt)}
                  activeOpacity={0.8}
                >
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardIcon}>{item.icon}</Text>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                  </View>
                  <Text style={styles.cardDesc}>{item.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          /* Conversation Thread */
          messages.map((msg) => (
            <View 
              key={msg.id} 
              style={[
                styles.bubbleContainer,
                msg.sender === 'user' ? styles.bubbleContainerUser : styles.bubbleContainerAI
              ]}
            >
              <View 
                style={[
                  styles.bubble,
                  msg.sender === 'user' ? styles.bubbleUser : styles.bubbleAI
                ]}
              >
                {msg.sender === 'ai' && (
                  <View style={styles.aiTag}>
                    <Sparkles size={11} color={theme.colors.secondary} />
                    <Text style={styles.aiTagText}>ORLESE AI</Text>
                  </View>
                )}
                <Text style={[
                  styles.bubbleText,
                  msg.sender === 'user' ? styles.bubbleTextUser : styles.bubbleTextAI
                ]}>
                  {msg.text}
                </Text>
              </View>
              <Text style={[
                styles.bubbleTime,
                msg.sender === 'user' ? styles.bubbleTimeUser : styles.bubbleTimeAI
              ]}>
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          ))
        )}

        {sending && (
          <View style={[styles.bubbleContainer, styles.bubbleContainerAI]}>
            <View style={[styles.bubble, styles.bubbleAI, styles.typingBubble]}>
              <View style={styles.aiTag}>
                <Sparkles size={11} color={theme.colors.secondary} />
                <Text style={styles.aiTagText}>ORLESE AI IS TYPING</Text>
              </View>
              <View style={styles.typingIndicatorContainer}>
                <Animated.View style={[styles.typingDot, { opacity: dot1 }]} />
                <Animated.View style={[styles.typingDot, { opacity: dot2 }]} />
                <Animated.View style={[styles.typingDot, { opacity: dot3 }]} />
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Suggestion Pills - Only visible during active conversation */}
      {!showOnboarding && (
        <View style={styles.suggestionsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionsScroll}>
            {ONBOARDING_SUGGESTIONS.map((item, idx) => (
              <TouchableOpacity 
                key={idx} 
                style={styles.suggestionChip}
                onPress={() => handleSend(item.prompt)}
                activeOpacity={0.7}
              >
                <Sparkles size={10} color={theme.colors.secondary} style={styles.suggestionChipIcon} />
                <Text style={styles.suggestionText}>{item.title}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Input Row */}
      <View style={styles.inputRow}>
        <View style={[
          styles.inputContainer,
          isFocused && styles.inputContainerFocused
        ]}>
          <TextInput
            style={styles.input}
            placeholder="Explore shadow work, migraine tips..."
            placeholderTextColor={theme.colors.textSubtle}
            value={inputText}
            onChangeText={setInputText}
            multiline
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
          />
          <TouchableOpacity 
            style={[
              styles.sendBtn, 
              !inputText.trim() ? styles.sendBtnDisabled : null
            ]}
            onPress={() => handleSend(inputText)}
            disabled={!inputText.trim() || sending}
            activeOpacity={0.8}
          >
            <Send size={16} color={theme.colors.background} />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
    position: 'relative',
  },
  avatarPulseBg: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 19,
    backgroundColor: 'rgba(99, 102, 241, 0.05)',
    transform: [{ scale: 1.15 }],
  },
  statusIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.risk.low,
    borderWidth: 1.5,
    borderColor: theme.colors.surface,
  },
  headerTextContainer: {
    gap: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  onlineText: {
    fontSize: 10,
    color: theme.colors.textMuted,
    fontWeight: '500',
  },
  clearBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  messageArea: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
  },
  messageAreaContent: {
    paddingVertical: theme.spacing.lg,
    gap: 16,
  },
  onboardingContainerStyle: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  onboardingWrapper: {
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
  },
  botIconLargeContainer: {
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
  botIconLargePulse: {
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
  onboardingGreeting: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  onboardingDescription: {
    fontSize: 13,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: theme.spacing.md,
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: theme.colors.secondary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  onboardingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    width: '100%',
    justifyContent: 'center',
  },
  onboardingCard: {
    width: '47%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardIcon: {
    fontSize: 16,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.text,
    flexShrink: 1,
  },
  cardDesc: {
    fontSize: 10,
    color: theme.colors.textSubtle,
    lineHeight: 13,
  },
  bubbleContainer: {
    maxWidth: '82%',
    gap: 4,
  },
  bubbleContainerUser: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  bubbleContainerAI: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  bubble: {
    borderRadius: 18,
    paddingVertical: 11,
    paddingHorizontal: 15,
    borderWidth: 1,
  },
  bubbleUser: {
    backgroundColor: theme.colors.primary,
    borderColor: 'rgba(99, 102, 241, 0.4)',
    borderBottomRightRadius: 3,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  bubbleAI: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderBottomLeftRadius: 3,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.secondary,
  },
  aiTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
  },
  aiTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: theme.colors.secondary,
    letterSpacing: 1.2,
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 21,
  },
  bubbleTextUser: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  bubbleTextAI: {
    color: theme.colors.text,
  },
  bubbleTime: {
    fontSize: 9,
    color: theme.colors.textSubtle,
    marginTop: 2,
    paddingHorizontal: 4,
  },
  bubbleTimeUser: {
    alignSelf: 'flex-end',
  },
  bubbleTimeAI: {
    alignSelf: 'flex-start',
  },
  typingBubble: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  typingIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 12,
    marginTop: 4,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.textMuted,
  },
  suggestionsContainer: {
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.background,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  suggestionsScroll: {
    paddingHorizontal: theme.spacing.md,
    gap: 8,
  },
  suggestionChip: {
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    borderColor: 'rgba(99, 102, 241, 0.25)',
    borderWidth: 1,
    borderRadius: theme.borderRadius.round,
    paddingVertical: 7,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
  },
  suggestionChipIcon: {
    marginRight: 6,
  },
  suggestionText: {
    fontSize: 12,
    color: theme.colors.text,
    fontWeight: '600',
  },
  inputRow: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    paddingTop: theme.spacing.sm,
    backgroundColor: theme.colors.background,
  },
  inputContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 5,
    alignItems: 'center',
  },
  inputContainerFocused: {
    borderColor: theme.colors.primary,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  input: {
    flex: 1,
    color: theme.colors.text,
    paddingVertical: 8,
    maxHeight: 120,
    fontSize: 14,
    minHeight: 40,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0084FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.35,
  }
});
