import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProfile } from '../context/ProfileContext';
import { MessagePolicyViolationModal } from '../components/MessagePolicyViolationModal';
import { MODERATION_CONFIG } from '../moderation/moderationConfig';
import {
  logMessageModerationAttempt,
  scanConversationContext,
  scanMessage,
} from '../moderation/messageModeration';
import { connectChatSocket, emitChatSocketAck, getChatSocket } from '../socket/chatSocket';
import { setLastOpenedChatRoomId } from '../utils/lastOpenedChatRoom';
import { useSelector } from 'react-redux';

const BG = '#ECE5DD';
const INCOMING = '#FFFFFF';
const OUTGOING = '#DCF8C6';
const HEADER = '#075E54';
const BLACK = '#111111';
const MUTED = '#667781';
const INPUT_BG = '#F0F0F0';
const SEND_GREEN = '#00A884';

function TodayChip() {
  return (
    <View style={styles.todayWrap}>
      <View style={styles.todayChip}>
        <Text style={styles.todayText}>Today</Text>
      </View>
    </View>
  );
}

/**
 * @param {{ item: { id: string; text: string; outgoing: boolean; timeLabel: string } }} p
 */
function Bubble({ item }) {
  const out = item.outgoing;
  return (
    <View style={[styles.bubbleRow, out ? styles.bubbleRowOut : styles.bubbleRowIn]}>
      <View style={[styles.bubble, out ? styles.bubbleOut : styles.bubbleIn]}>
        <Text style={styles.bubbleText}>{item.text}</Text>
        <View style={[styles.bubbleMetaRow, out ? styles.bubbleMetaRowOut : styles.bubbleMetaRowIn]}>
          <Text style={[styles.bubbleMeta, out && styles.bubbleMetaOut]}>{item.timeLabel}</Text>
          {out ? (
            <Icon name="checkmark-done" size={14} color="#53BDEB" style={styles.tickIcon} />
          ) : null}
        </View>
      </View>
    </View>
  );
}

export default function ChatRoomScreen({ chatRoleVariant = 'customer' }) {
  const auth = useSelector(s => s.auth);
  chatRoleVariant = auth.activeRole;
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const route = useRoute();
  const { user } = useProfile();
  const chat = route.params?.chat;
  const roomId = String(chat?.roomId ?? chat?.id ?? '').trim();
  const storageScope = chatRoleVariant === 'vendor' ? 'vendor' : 'customer';
  const appRolePayload = storageScope === 'vendor' ? 'vendor' : 'customer';


  const [input, setInput] = useState('');
  /** Remount multiline TextInput after send so height collapses when cleared (RN layout quirk). */
  const [inputKey, setInputKey] = useState(0);
  const [messages, setMessages] = useState(/** @type {Array<{ id: string; text: string; outgoing: boolean; timeLabel: string }>} */([]));
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [policyModalVisible, setPolicyModalVisible] = useState(false);
  const [policyModalVariant, setPolicyModalVariant] = useState(/** @type {'single' | 'split'} */('single'));
  const [moderationLockUntil, setModerationLockUntil] = useState(/** @type {number | null} */(null));
  const [lockRemainSec, setLockRemainSec] = useState(0);
  const listRef = useRef(null);
  /** @type {React.MutableRefObject<Array<{ text: string; sentAt: number }>>} */
  const outgoingSendHistoryRef = useRef([]);
  const sessionModerationBlocksRef = useRef(0);

  const moderationComposeLocked = moderationLockUntil != null && Date.now() < moderationLockUntil;

  useEffect(() => {
    if (moderationLockUntil == null) {
      setLockRemainSec(0);
      return undefined;
    }
    const tick = () => {
      const s = Math.max(0, Math.ceil((moderationLockUntil - Date.now()) / 1000));
      setLockRemainSec(s);
      if (s <= 0) setModerationLockUntil(null);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [moderationLockUntil]);

  useEffect(() => {
    outgoingSendHistoryRef.current = [];
    sessionModerationBlocksRef.current = 0;
    setModerationLockUntil(null);
    setPolicyModalVariant('single');
  }, [roomId]);

  /**
   * @param {Record<string, unknown>} row
   */
  const mapMessage = useCallback(
    (row) => {
      const senderId = Number(row.sender);
      const userId = Number(user?.id);
      const outgoing = Number.isFinite(senderId) && Number.isFinite(userId) ? senderId === userId : false;
      const d = new Date(/** @type {string | number} */(row.created_at ?? row.updated_at ?? Date.now()));
      const timeLabel = Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      return {
        id: String(row.id ?? `msg-${Date.now()}`),
        text: String(row.content ?? '').trim(),
        outgoing,
        timeLabel,
      };
    },
    [user?.id],
  );

  const loadMessages = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    try {
      await connectChatSocket();
      const out = await emitChatSocketAck('get_room_messages', {
        room_id: roomId,
        limit: 100,
        app_role: appRolePayload,
      });
      if (!out.success) {
        setMessages([]);
        return;
      }
      const list =
        out.result && typeof out.result === 'object' && 'messages' in out.result
          ? /** @type {{ messages?: unknown }} */ (out.result).messages
          : [];
      const mapped = (Array.isArray(list) ? list : [])
        .filter((x) => x && typeof x === 'object')
        .map((x) => mapMessage(/** @type {Record<string, unknown>} */(x)))
        .filter((x) => x.text);
      setMessages(mapped);
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: false }));
    } finally {
      setLoading(false);
    }
  }, [roomId, mapMessage, appRolePayload]);

  useFocusEffect(
    useCallback(() => {
      if (!roomId) return () => { };
      void setLastOpenedChatRoomId(roomId, storageScope);
      void loadMessages();
      const socket = getChatSocket();
      const onIncoming = (payload) => {
        if (!payload || typeof payload !== 'object') return;
        const msg =
          'message' in /** @type {Record<string, unknown>} */ (payload)
            ? /** @type {Record<string, unknown>} */ (/** @type {Record<string, unknown>} */ (payload).message)
            : null;
        if (!msg || String(msg.room_id ?? '').trim() !== roomId) return;
        const mapped = mapMessage(msg);
        if (!mapped.text) return;
        setMessages((prev) => {
          if (prev.some((p) => p.id === mapped.id)) return prev;
          return [...prev, mapped];
        });
        requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
      };
      socket?.on('message_created', onIncoming);
      return () => {
        socket?.off('message_created', onIncoming);
      };
    }, [roomId, loadMessages, mapMessage, storageScope]),
  );

  const bumpModerationLockIfNeeded = useCallback(() => {
    if (sessionModerationBlocksRef.current >= MODERATION_CONFIG.SESSION_BLOCKS_FOR_LOCK) {
      setModerationLockUntil(Date.now() + MODERATION_CONFIG.CHAT_LOCK_DURATION_MS);
    }
  }, []);

  const onSend = useCallback(() => {
    const t = input.trim();
    if (!t || !roomId || sending) return;
    if (moderationLockUntil != null && Date.now() < moderationLockUntil) return;

    const single = scanMessage(t);
    if (!single.isAllowed) {
      sessionModerationBlocksRef.current += 1;
      setPolicyModalVariant('single');
      logMessageModerationAttempt({
        violations: single.violations,
        severityScore: single.severityScore,
        preview: t.slice(0, 64),
        roomId,
        role: appRolePayload,
        fromContext: false,
      });
      setPolicyModalVisible(true);
      bumpModerationLockIfNeeded();
      return;
    }

    const hist = outgoingSendHistoryRef.current;
    const prevTexts = hist.map((h) => h.text);
    const prevTs = hist.map((h) => h.sentAt);
    const ctx = scanConversationContext(t, prevTexts, {
      messageTimestamps: prevTs,
      now: Date.now(),
      sessionBlockCount: sessionModerationBlocksRef.current,
    });
    if (!ctx.isAllowed) {
      sessionModerationBlocksRef.current += 1;
      setPolicyModalVariant('split');
      logMessageModerationAttempt({
        violations: ctx.violations,
        severityScore: ctx.severityScore,
        riskScore: ctx.riskScore,
        preview: t.slice(0, 64),
        roomId,
        role: appRolePayload,
        fromContext: true,
      });
      setPolicyModalVisible(true);
      bumpModerationLockIfNeeded();
      return;
    }

    setSending(true);
    void (async () => {
      try {
        const out = await emitChatSocketAck('create_message', {
          room_id: roomId,
          type: 'text',
          content: t,
          app_role: appRolePayload,
        });
        if (!out.success) {
          if (out.error === 'message_moderation_failed') {
            sessionModerationBlocksRef.current += 1;
            setPolicyModalVariant('split');
            setPolicyModalVisible(true);
            bumpModerationLockIfNeeded();
          } else {
            Alert.alert('Message not sent', out.message || 'Try again.');
          }
          return;
        }
        const resultMsg =
          out.result && typeof out.result === 'object' && 'message' in out.result
            ? /** @type {Record<string, unknown>} */ (/** @type {{ message: unknown }} */ (out.result).message)
            : null;
        if (resultMsg) {
          const mapped = mapMessage(resultMsg);
          if (mapped.text) {
            setMessages((prev) => (prev.some((p) => p.id === mapped.id) ? prev : [...prev, mapped]));
          }
        }
        const entry = { text: t, sentAt: Date.now() };
        outgoingSendHistoryRef.current = [...outgoingSendHistoryRef.current, entry].slice(
          -MODERATION_CONFIG.HISTORY_MAX_MESSAGES,
        );
        setInput('');
        setInputKey((k) => k + 1);
        requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
      } finally {
        setSending(false);
      }
    })();
  }, [
    input,
    roomId,
    sending,
    mapMessage,
    appRolePayload,
    moderationLockUntil,
    bumpModerationLockIfNeeded,
  ]);

  const renderItem = useCallback(({ item }) => <Bubble item={item} />, []);
  const keyExtractor = useCallback((m) => m.id, []);

  const listHeader = useMemo(() => <TodayChip />, []);

  const listContentStyle = useMemo(
    () => [
      styles.listPad,
      {
        flexGrow: 1,
        paddingTop: 8,
        paddingBottom: 12 + insets.bottom,
      },
    ],
    [insets.bottom],
  );

  const inputBarStyle = useMemo(
    () => [
      styles.inputBar,
      {
        paddingBottom: Math.max(insets.bottom, 8),
        paddingTop: 6,
      },
    ],
    [insets.bottom],
  );

  const canSend = input.trim().length > 0 && !moderationComposeLocked;

  if (!chat) {
    return (
      <SafeAreaView style={styles.empty} edges={['top', 'left', 'right']}>
        <Text style={styles.emptyText}>Chat not found.</Text>
      </SafeAreaView>
    );
  }

  return (
    <>
    {
      Platform.OS === 'andorid' &&
      <SafeAreaView style={styles.flex} edges={['top', 'left', 'right', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : insets.bottom}
        >
          <View style={styles.flex}>
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={keyExtractor}
              renderItem={renderItem}
              ListHeaderComponent={messages.length > 0 ? listHeader : null}
              contentContainerStyle={listContentStyle}
              onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyMessagesWrap}>
                  {loading ? (
                    <>
                      <ActivityIndicator size="small" color="#00926e" />
                      <Text style={styles.emptyMessagesText}>Loading messages…</Text>
                    </>
                  ) : (
                    <Text style={styles.emptyMessagesText}>No messages yet. Say hello.</Text>
                  )}
                </View>
              }
            />

            <View style={inputBarStyle}>
              {moderationComposeLocked ? (
                <Text style={styles.moderationLockBanner}>
                  Messaging paused after repeated policy blocks. Unlocks in {lockRemainSec}s.
                </Text>
              ) : null}
              <View style={styles.inputRow}>
                {/* <Pressable
                style={({ pressed }) => [styles.sideBtn, pressed && styles.sideBtnPressed]}
                onPress={() => Alert.alert('Attach', 'Photos, documents and location will be available when connected.')}
                accessibilityLabel="Attach"
              >
                <Icon name="add" size={28} color={MUTED} />
              </Pressable> */}
                <View style={styles.inputWrap}>
                  <TextInput
                    key={inputKey}
                    style={styles.input}
                    placeholder="Message"
                    placeholderTextColor={MUTED}
                    value={input}
                    onChangeText={setInput}
                    multiline
                    maxLength={4000}
                    accessibilityLabel="Message text"
                    editable={!moderationComposeLocked}
                  />
                  {/* <Pressable
                  style={({ pressed }) => [styles.inlineIcon, pressed && styles.sideBtnPressed]}
                  onPress={() => Alert.alert('Stickers', 'Emoji and stickers picker will open here.')}
                  accessibilityLabel="Emoji"
                >
                  <Icon name="happy-outline" size={24} color={MUTED} />
                </Pressable> */}
                </View>
                <Pressable
                  onPress={onSend}
                  style={({ pressed }) => [
                    styles.sendBtn,
                    (pressed || sending || moderationComposeLocked) && styles.sendBtnPressed,
                    moderationComposeLocked && styles.sendBtnDisabled,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Send message"
                  disabled={sending || moderationComposeLocked}
                >
                  {sending ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Icon name="send" size={20} color="#FFFFFF" />}
                </Pressable>
                {/* {canSend ? (
                <Pressable
                onPress={onSend}
                style={({ pressed }) => [styles.sendBtn, (pressed || sending) && styles.sendBtnPressed]}
                accessibilityRole="button"
                accessibilityLabel="Send message"
                disabled={sending}
              >
                {sending ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Icon name="send" size={20} color="#FFFFFF" />}
              </Pressable>
              ) : (
                <Pressable
                  style={({ pressed }) => [styles.sendBtn, styles.micBtn, pressed && styles.sendBtnPressed]}
                  onPress={() => Alert.alert('Voice message', 'Hold to record will be available when connected.')}
                  accessibilityLabel="Voice message"
                >
                  <Icon name="mic" size={22} color="#FFFFFF" />
                </Pressable>
              )} */}
              </View>
            </View>
          </View>
          <MessagePolicyViolationModal
            visible={policyModalVisible}
            variant={policyModalVariant}
            onDismiss={() => {
              setPolicyModalVisible(false);
              setPolicyModalVariant('single');
            }}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
    }
    {
      Platform.OS === 'ios' &&
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : insets.bottom}
      >
        <View style={styles.flex}>
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            ListHeaderComponent={messages.length > 0 ? listHeader : null}
            contentContainerStyle={listContentStyle}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyMessagesWrap}>
                {loading ? (
                  <>
                    <ActivityIndicator size="small" color="#00926e" />
                    <Text style={styles.emptyMessagesText}>Loading messages…</Text>
                  </>
                ) : (
                  <Text style={styles.emptyMessagesText}>No messages yet. Say hello.</Text>
                )}
              </View>
            }
          />

          <View style={inputBarStyle}>
            {moderationComposeLocked ? (
              <Text style={styles.moderationLockBanner}>
                Messaging paused after repeated policy blocks. Unlocks in {lockRemainSec}s.
              </Text>
            ) : null}
            <View style={styles.inputRow}>
              {/* <Pressable
              style={({ pressed }) => [styles.sideBtn, pressed && styles.sideBtnPressed]}
              onPress={() => Alert.alert('Attach', 'Photos, documents and location will be available when connected.')}
              accessibilityLabel="Attach"
            >
              <Icon name="add" size={28} color={MUTED} />
            </Pressable> */}
              <View style={styles.inputWrap}>
                <TextInput
                  key={inputKey}
                  style={styles.input}
                  placeholder="Message"
                  placeholderTextColor={MUTED}
                  value={input}
                  onChangeText={setInput}
                  multiline
                  maxLength={4000}
                  accessibilityLabel="Message text"
                  editable={!moderationComposeLocked}
                />
                {/* <Pressable
                style={({ pressed }) => [styles.inlineIcon, pressed && styles.sideBtnPressed]}
                onPress={() => Alert.alert('Stickers', 'Emoji and stickers picker will open here.')}
                accessibilityLabel="Emoji"
              >
                <Icon name="happy-outline" size={24} color={MUTED} />
              </Pressable> */}
              </View>
              <Pressable
                onPress={onSend}
                style={({ pressed }) => [
                  styles.sendBtn,
                  (pressed || sending || moderationComposeLocked) && styles.sendBtnPressed,
                  moderationComposeLocked && styles.sendBtnDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Send message"
                disabled={sending || moderationComposeLocked}
              >
                {sending ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Icon name="send" size={20} color="#FFFFFF" />}
              </Pressable>
              {/* {canSend ? (
              <Pressable
              onPress={onSend}
              style={({ pressed }) => [styles.sendBtn, (pressed || sending) && styles.sendBtnPressed]}
              accessibilityRole="button"
              accessibilityLabel="Send message"
              disabled={sending}
            >
              {sending ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Icon name="send" size={20} color="#FFFFFF" />}
            </Pressable>
            ) : (
              <Pressable
                style={({ pressed }) => [styles.sendBtn, styles.micBtn, pressed && styles.sendBtnPressed]}
                onPress={() => Alert.alert('Voice message', 'Hold to record will be available when connected.')}
                accessibilityLabel="Voice message"
              >
                <Icon name="mic" size={22} color="#FFFFFF" />
              </Pressable>
            )} */}
            </View>
          </View>
        </View>
        <MessagePolicyViolationModal
          visible={policyModalVisible}
          variant={policyModalVariant}
          onDismiss={() => {
            setPolicyModalVisible(false);
            setPolicyModalVariant('single');
          }}
        />
      </KeyboardAvoidingView>
    }
    </>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: BG,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 4,
    gap: 2,
  },
  headerIconBtn: {
    padding: 8,
  },
  empty: {
    flex: 1,
    backgroundColor: BG,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: MUTED,
  },
  todayWrap: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  todayChip: {
    backgroundColor: 'rgba(228, 228, 228, 0.92)',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 10,
  },
  todayText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#54656F',
  },
  listPad: {
    paddingHorizontal: 8,
  },
  bubbleRow: {
    marginBottom: 4,
    flexDirection: 'row',
  },
  bubbleRowIn: {
    justifyContent: 'flex-start',
  },
  bubbleRowOut: {
    justifyContent: 'flex-end',
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 0.5 },
        shadowOpacity: 0.1,
        shadowRadius: 1.5,
      },
      android: { elevation: 1 },
    }),
  },
  bubbleIn: {
    backgroundColor: INCOMING,
    borderTopLeftRadius: 2,
  },
  bubbleOut: {
    backgroundColor: OUTGOING,
    borderTopRightRadius: 2,
  },
  bubbleText: {
    fontSize: 16,
    color: BLACK,
    lineHeight: 21,
  },
  bubbleMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 4,
  },
  bubbleMetaRowIn: {
    justifyContent: 'flex-start',
  },
  bubbleMetaRowOut: {
    justifyContent: 'flex-end',
  },
  bubbleMeta: {
    fontSize: 11,
    color: MUTED,
  },
  bubbleMetaOut: {
    color: MUTED,
  },
  tickIcon: {
    marginBottom: -1,
  },
  inputBar: {
    backgroundColor: INPUT_BG,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#D0D0D0',
    paddingHorizontal: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  sideBtn: {
    width: 40,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  sideBtnPressed: {
    opacity: 0.65,
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingLeft: 12,
    paddingRight: 4,
    paddingVertical: 4,
    minHeight: 46,
    maxHeight: 120,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: BLACK,
    maxHeight: 110,
    paddingVertical: 8,
    minHeight: 38,
  },
  inlineIcon: {
    padding: 6,
    marginBottom: 2,
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: SEND_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  micBtn: {
    backgroundColor: SEND_GREEN,
  },
  sendBtnPressed: {
    opacity: 0.88,
  },
  sendBtnDisabled: {
    opacity: 0.45,
  },
  moderationLockBanner: {
    fontSize: 13,
    lineHeight: 18,
    color: '#92400E',
    paddingHorizontal: 8,
    paddingBottom: 6,
    textAlign: 'center',
  },
  emptyMessagesWrap: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyMessagesText: {
    marginTop: 8,
    fontSize: 14,
    color: MUTED,
    textAlign: 'center',
  },
});
