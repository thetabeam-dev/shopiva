import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { confirmCheckoutPayment } from '../../api/buyer';
import { formatNaira } from '../../utils/formatNaira';
import { setLastOpenedChatRoomId } from '../../utils/lastOpenedChatRoom';

function normalizeAmount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, n);
}

/** @param {string} text */
function hueFromText(text) {
  let h = 0;
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) % 360;
  return Math.abs(h);
}

/**
 * Maps API chat room row to the shape ChatRoom expects (same idea as ChatList mapRoomRow).
 * @param {Record<string, unknown>} room
 */
function roomRecordToChatItem(room) {
  const roomId = String(room.id ?? '').trim();
  const orderId = String(room.order_id ?? '').trim();
  const name = orderId ? `Order #${orderId}` : 'Chat';
  return {
    id: roomId,
    roomId,
    orderId,
    name,
    avatarHue: hueFromText(roomId || name),
    unreadCount: 0,
    lastAtLabel: '',
    lastMessage: String(room.last_message ?? '').trim() || 'No messages yet',
  };
}

/**
 * @param {{ navigation: import('@react-navigation/native').NavigationProp<Record<string, object | undefined>>; route: { params?: Record<string, unknown> } }} props
 */
export default function PaymentSuccessScreen({ navigation, route }) {
  const subtotal = normalizeAmount(route?.params?.subtotal);
  const shipping = normalizeAmount(route?.params?.shipping);
  const total = normalizeAmount(route?.params?.total || subtotal + shipping);
  const itemCount = Math.max(0, Number(route?.params?.itemCount) || 0);
  const reference = String(route?.params?.reference || '').trim();

  const [confirmEntries, setConfirmEntries] = useState(
    /** @type {Array<{ room: Record<string, unknown>; vendor_user_id?: number; existing?: boolean }>} */ ([]),
  );
  const [confirmLoading, setConfirmLoading] = useState(/** @type {boolean} */ (false));
  const [confirmError, setConfirmError] = useState('');

  const hasConfirmedChats = confirmEntries.length > 0;
  const multiShopCheckout = confirmEntries.length > 1;

  const paidLabel = useMemo(() => formatNaira(total), [total]);
  const parentTabNav = navigation.getParent();
  const receiptText = useMemo(() => {
    const lines = [
      'DEEDYTE PAYMENT RECEIPT',
      '',
      `Status: Paid`,
      `Reference: ${reference || 'N/A'}`,
      `Items: ${itemCount}`,
      `Item price: ${formatNaira(subtotal)}`,
      `Shipping: ${shipping > 0 ? formatNaira(shipping) : 'Free'}`,
      `Grand total: ${paidLabel}`,
      '',
      `Generated: ${new Date().toLocaleString()}`,
    ];
    return lines.join('\n');
  }, [reference, itemCount, subtotal, shipping, paidLabel]);

  const runConfirm = useCallback(async () => {
    if (!reference) {
      setConfirmError('Missing payment reference.');
      return;
    }
    setConfirmLoading(true);
    setConfirmError('');
    try {
      const data = await confirmCheckoutPayment({
        reference,
        // order_id: route?.params?.order_id,
        shipping_naira: shipping,
      });
      const rawRooms = Array.isArray(data?.rooms) ? data.rooms : [];
      /** @type {Array<{ room: Record<string, unknown>; vendor_user_id?: number; existing?: boolean }>} */
      let entries = [];
      if (rawRooms.length) {
        entries = rawRooms
          .map((row) => {
            if (!row || typeof row !== 'object') return null;
            const r = /** @type {Record<string, unknown>} */ (row);
            const room = r.room && typeof r.room === 'object' ? /** @type {Record<string, unknown>} */ (r.room) : null;
            if (!room || !String(room.id ?? '').trim()) return null;
            return {
              room,
              vendor_user_id: typeof r.vendor_user_id === 'number' ? r.vendor_user_id : Number(r.vendor_user_id),
              existing: Boolean(r.existing),
            };
          })
          .filter((x) => x != null);
      } else if (data?.room && typeof data.room === 'object') {
        const room = /** @type {Record<string, unknown>} */ (data.room);
        if (String(room.id ?? '').trim()) {
          entries = [{ room, vendor_user_id: Number(data.vendor_user_id), existing: Boolean(data.existing) }];
        }
      }
      if (!entries.length) {
        throw new Error('Server did not return chat room(s).');
      }
      setConfirmEntries(entries);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setConfirmError(msg);
    } finally {
      setConfirmLoading(false);
    }
  }, [reference, shipping]);

  useEffect(() => {
    if (!reference) return;
    void runConfirm();
  }, [reference, shipping, runConfirm]);

  const onShareReceipt = async () => {
    try {
      await Share.share({
        title: 'Deedyte payment receipt',
        message: receiptText,
      });
    } catch (e) {
      Alert.alert('Share failed', e instanceof Error ? e.message : String(e));
    }
  };

  const onPrintReceipt = async () => {
    try {
      await Share.share({
        title: 'Print payment receipt',
        message: receiptText,
      });
      Alert.alert('Print receipt', 'Select the Print option from the share sheet.');
    } catch (e) {
      Alert.alert('Print unavailable', e instanceof Error ? e.message : String(e));
    }
  };

  const onContinueChat = async () => {
    if (!hasConfirmedChats) {
      Alert.alert(
        'Chat not ready',
        confirmError || 'We could not open your seller chat yet. Try again or open Chats from the tab bar.',
        [
          { text: 'Retry', onPress: () => void runConfirm() },
          { text: 'OK', style: 'cancel' },
        ],
      );
      return;
    }
    if (multiShopCheckout) {
      const highlightRoomIds = confirmEntries
        .map((e) => String(e.room?.id ?? '').trim())
        .filter(Boolean);
      /** Pin the last room from this checkout to the top (most recent thread for this payment). */
      const pinId = highlightRoomIds.length ? highlightRoomIds[highlightRoomIds.length - 1] : '';
      if (pinId) await setLastOpenedChatRoomId(pinId, 'customer');
      parentTabNav?.navigate('Chat', {
        screen: 'chat-list',
        params: {
          highlightRoomIds,
          highlightExpiresAt: Date.now() + 120000,
        },
      });
      return;
    }
    const chatItem = roomRecordToChatItem(confirmEntries[0].room);
    parentTabNav?.navigate('Chat', {
      screen: 'chat-room',
      params: { chat: chatItem },
    });
  };

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroWrap}>
          <View style={styles.heroGlow}>
            <View style={styles.iconCircle}>
              <Icon name="checkmark-outline" size={44} color="#FFFFFF" />
            </View>
          </View>
        </View>

        <Text style={styles.title}>Payment Successful!</Text>
        <Text style={styles.subtitle}>Successfully paid {paidLabel}</Text>

        {reference && confirmLoading ? (
          <View style={styles.statusBanner}>
            <ActivityIndicator color="#00926e" />
            <Text style={styles.statusBannerText}>Setting up your seller chats…</Text>
          </View>
        ) : null}
        {reference && confirmError ? (
          <Pressable style={styles.errorBanner} onPress={() => void runConfirm()} accessibilityRole="button">
            <Icon name="warning-outline" size={18} color="#B42318" />
            <Text style={styles.errorBannerText} numberOfLines={3}>
              {confirmError}
            </Text>
            <Text style={styles.errorRetry}>Tap to retry</Text>
          </Pressable>
        ) : null}
        {reference && !confirmLoading && !confirmError && hasConfirmedChats ? (
          <Text style={styles.readyHint}>
            {multiShopCheckout ? `Chats with ${confirmEntries.length} sellers are ready.` : 'Seller chat is ready.'}
          </Text>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Details</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Items</Text>
            <Text style={styles.value}>{itemCount}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Item price</Text>
            <Text style={styles.value}>{formatNaira(subtotal)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Shipping</Text>
            <Text style={styles.value}>{shipping > 0 ? formatNaira(shipping) : 'Free'}</Text>
          </View>
          <View style={[styles.row, styles.totalRow]}>
            <Text style={styles.totalLabel}>Grand total</Text>
            <Text style={styles.totalValue}>{paidLabel}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Status</Text>
            <View style={styles.paidPill}>
              <Text style={styles.paidPillText}>Paid</Text>
            </View>
          </View>
          {reference ? (
            <Text style={styles.referenceText} numberOfLines={2}>
              Ref: {reference}
            </Text>
          ) : null}
        </View>

        {/* <Pressable
          style={[
            styles.primaryBtn,
            (confirmLoading || Boolean(reference && !hasConfirmedChats && !confirmError)) && styles.primaryBtnDisabled,
          ]}
          onPress={() => onContinueChat()}
          accessibilityRole="button"
          disabled={confirmLoading || Boolean(reference && !hasConfirmedChats && !confirmError)}
        >
          {confirmLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryBtnText}>Continue to chat</Text>
          )}
        </Pressable> */}
        {reference && confirmError ? (
          <Text style={styles.helperMuted}>
            Your payment went through; if chat setup fails, tap the error above to retry or contact support with your reference.
          </Text>
        ) : null}
        <Pressable
          style={styles.secondaryBtn}
          onPress={() => parentTabNav?.navigate('Activities')}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryBtnText}>Continue to orders</Text>
        </Pressable>
        <View style={styles.utilityRow}>
          <Pressable style={styles.utilityBtn} onPress={() => void onPrintReceipt()} accessibilityRole="button">
            <Icon name="print-outline" size={18} color="#344054" />
            <Text style={styles.utilityBtnText}>Print receipt</Text>
          </Pressable>
          <Pressable style={styles.utilityBtn} onPress={() => void onShareReceipt()} accessibilityRole="button">
            <Icon name="share-social-outline" size={18} color="#344054" />
            <Text style={styles.utilityBtnText}>Share receipt</Text>
          </Pressable>
        </View>
        <Pressable style={styles.ghostBtn} onPress={() => navigation.goBack()} accessibilityRole="button">
          <Text style={styles.ghostBtnText}>Back To Cart</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F7F7F8',
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 28,
  },
  heroWrap: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 14,
  },
  heroGlow: {
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: '#DDF7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: '#00926e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    textAlign: 'center',
    fontSize: 33,
    fontWeight: '800',
    color: '#101828',
    marginBottom: 6,
  },
  subtitle: {
    textAlign: 'center',
    fontSize: 18,
    color: '#667085',
    marginBottom: 22,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#ECFDF3',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ABEFC6',
  },
  statusBannerText: {
    flex: 1,
    fontSize: 14,
    color: '#067647',
    fontWeight: '600',
  },
  errorBanner: {
    marginBottom: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#FEF3F2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    gap: 4,
  },
  errorBannerText: {
    fontSize: 13,
    color: '#B42318',
    marginTop: 4,
  },
  errorRetry: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B42318',
    textDecorationLine: 'underline',
  },
  readyHint: {
    textAlign: 'center',
    fontSize: 14,
    color: '#067647',
    fontWeight: '600',
    marginBottom: 12,
  },
  helperMuted: {
    fontSize: 12,
    color: '#667085',
    textAlign: 'center',
    marginBottom: 10,
    marginTop: -4,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ECEDEE',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 26,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  label: {
    fontSize: 16,
    color: '#6B7280',
  },
  value: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  totalRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
    marginTop: 4,
    paddingTop: 14,
  },
  totalLabel: {
    fontSize: 21,
    fontWeight: '800',
    color: '#111827',
  },
  totalValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },
  paidPill: {
    borderWidth: 1,
    borderColor: '#52C41A',
    backgroundColor: '#F6FFED',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  paidPillText: {
    color: '#389E0D',
    fontSize: 14,
    fontWeight: '700',
  },
  referenceText: {
    marginTop: 10,
    color: '#667085',
    fontSize: 13,
  },
  primaryBtn: {
    backgroundColor: '#00926e',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    marginBottom: 10,
  },
  primaryBtnDisabled: {
    opacity: 0.65,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  secondaryBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    marginBottom: 8,
  },
  secondaryBtnText: {
    color: '#344054',
    fontSize: 17,
    fontWeight: '700',
  },
  utilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
    marginBottom: 8,
    gap: 10,
  },
  utilityBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  utilityBtnText: {
    color: '#344054',
    fontSize: 14,
    fontWeight: '600',
  },
  ghostBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 42,
  },
  ghostBtnText: {
    color: '#667085',
    fontSize: 15,
    fontWeight: '600',
  },
});
