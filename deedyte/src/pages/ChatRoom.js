import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Keyboard,
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
import ChatShippingModal from '../components/ChatShippingModal';
import ChatQuantityModal from '../components/ChatQuantityModal';
import ChatInvoiceModal from '../components/ChatInvoiceModal';
import { MODERATION_CONFIG } from '../moderation/moderationConfig';
import {
  logMessageModerationAttempt,
  scanConversationContext,
  scanMessage,
} from '../moderation/messageModeration';
import { connectChatSocket, emitChatSocketAck, getChatSocket } from '../socket/chatSocket';
import { setLastOpenedChatRoomId } from '../utils/lastOpenedChatRoom';
import {
  hasSeenBuyerInvoiceTip,
  markBuyerInvoiceTipSeen,
} from '../utils/buyerChatTips';
import { refreshUnreadChats } from '../components/UnreadMessageBadge';
import { useSelector } from 'react-redux';
import { fetchOrderIdByReference } from '../api/buyer';
import { ProductCardMedia } from '../components/ProductCardMedia';
import { isGibberishMessage } from '../utils/gibberish';

const BG = '#ECE5DD';
const INCOMING = '#FFFFFF';
const OUTGOING = '#DCF8C6';
const HEADER = '#075E54';
const BLACK = '#111111';
const MUTED = '#667781';
const INPUT_BG = '#F0F0F0';
const SEND_GREEN = '#00926E';
const BRAND = '#00926E';
const CARD_RADIUS = 7;

function parseCardContent(content) {
  const raw = String(content ?? '').trim();
  if (!raw) return null;
  const json = raw.startsWith('{') ? raw : raw.replace(/^(INVOICE|SHIPPING)\n/i, '').trim();
  try {
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object') return null;
    const kind = String(parsed.kind ?? parsed.type ?? '').toLowerCase();
    if (kind === 'invoice' || kind === 'shipping' || kind === 'inquiry' || kind === 'invoice_cancelled' || kind === 'invoice_paid' || kind === 'invoice_request' || kind === 'invoice_request_declined') return parsed;
  } catch {
    return null;
  }
  return null;
}

const NUMBER_SUFFIXES = [
  [1e9, 'B'],
  [1e6, 'M'],
  [1e3, 'k'],
];

/**
 * 4000 -> 4k, 2,500,000 -> 2.5M, 1500000000 -> 1.5B.
 * Only abbreviates when exact to 2 decimals, so prices are never rounded (2026 stays 2026).
 * Skips numbers starting with 0 (phone numbers), longer than 12 digits, glued to letters, or after `#` (order ids).
 */
function abbreviateNumbers(text) {
  return String(text ?? '').replace(
    /(^|[^\w#.,])(\d{1,3}(?:,\d{3})+|[1-9]\d{3,11})(?:\.(\d+))?(?![\w.,]*\d)(?![A-Za-z])/g,
    (match, lead, whole, decimals) => {
      const n = Number(`${whole.replace(/,/g, '')}${decimals ? `.${decimals}` : ''}`);
      if (!Number.isFinite(n)) return match;
      const hit = NUMBER_SUFFIXES.find(([size]) => n >= size);
      if (!hit) return match;
      const scaled = n / hit[0];
      if (Math.round(scaled * 100) / 100 !== scaled) return match;
      return `${lead}${scaled}${hit[1]}`;
    },
  );
}

function formatShippingAddress(shipping) {
  if (!shipping || typeof shipping !== 'object') return '';
  return [
    shipping.street,
    shipping.area1 ?? shipping.junction,
    shipping.area2,
    shipping.city,
    shipping.state,
    shipping.zip,
  ]
    .map((v) => String(v ?? '').trim())
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .join(', ');
}

function shippingDetailLines(shipping) {
  if (!shipping || typeof shipping !== 'object') return [];
  const area1 = String(shipping.area1 ?? shipping.junction ?? '').trim();
  const area2 = String(shipping.area2 ?? '').trim();
  return [
    ['state', String(shipping.state ?? '').trim()],
    ['city', String(shipping.city ?? '').trim()],
    ['street', String(shipping.street ?? '').trim()],
    ['Area 1 (junction)', area1],
    ['Area 2 (any other details)', area2],
  ].filter(([, value]) => Boolean(value));
}

function productFromCard(card) {
  if (!card || typeof card !== 'object') return null;
  const productId = Number(card.productId ?? card.product_id) || 0;
  const itemAmount = Number(card.itemAmount ?? card.productAmount) || 0;
  const itemTitle = String(card.itemTitle ?? card.productTitle ?? card.title ?? '').trim();
  const itemImage = String(card.itemImage ?? card.productImage ?? card.image ?? '').trim();
  if (!productId && !itemAmount && !itemTitle && !itemImage) return null;
  return { productId, itemAmount, itemTitle, itemImage };
}

function formatInvoiceMoney(value) {
  const n = Number(value) || 0;
  return `₦${n.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
}

function MonitoringNotice() {
  return (
    <View style={styles.monitorNotice}>
      <Icon name="shield-checkmark-outline" size={16} color="#92400E" style={styles.monitorIcon} />
      <Text style={styles.monitorText}>
        All messages in this chat are monitored and may be moderated to keep Deedyte scam-free.
        Never pay or share personal details outside the app.
      </Text>
    </View>
  );
}

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
 * @param {{ item: { id: string; text: string; outgoing: boolean; timeLabel: string; isRead?: boolean; invoice?: Record<string, unknown> | null }; onOpenInvoice?: (invoice: Record<string, unknown>) => void; canPay?: boolean }} p
 */
function HeaderActionCard({ title, subtitle, onPress, alertLabel = '', disabled = false, highlight = false }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.headerActionCard,
        highlight && styles.headerActionCardHighlight,
        pressed && styles.sendBtnPressed,
        disabled && styles.headerActionCardDisabled,
      ]}
    >
      <View style={styles.headerActionCopy}>
        {alertLabel ? (
          <View style={styles.headerActionAlert}>
            <Icon name="alert-circle" size={12} color="#FFFFFF" />
            <Text style={styles.headerActionAlertText}>{alertLabel}</Text>
          </View>
        ) : null}
        <Text style={styles.headerActionTitle}>{title}</Text>
        <Text style={styles.headerActionSubtitle} numberOfLines={2}>{subtitle}</Text>
      </View>
      <Icon name={disabled ? 'checkmark-circle' : 'chevron-forward'} size={18} color={BRAND} />
    </Pressable>
  );
}

function BuyerInvoiceTip({ visible, onDismiss }) {
  if (!visible) return null;
  return (
    <View style={styles.buyerTipWrap} pointerEvents="box-none">
      <View style={styles.buyerTipArrow} />
      <View style={styles.buyerTipCard}>
        <View style={styles.buyerTipIconWrap}>
          <Icon name="bulb-outline" size={18} color="#FFFFFF" />
        </View>
        <View style={styles.buyerTipCopy}>
          <Text style={styles.buyerTipTitle}>How to get an invoice</Text>
          <Text style={styles.buyerTipBody}>
            Tap Request checkout invoice above. Add your shipping address if asked, then the vendor can send your invoice to pay.
          </Text>
          <Pressable
            onPress={onDismiss}
            style={({ pressed }) => [styles.buyerTipBtn, pressed && styles.sendBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel="Got it"
          >
            <Text style={styles.buyerTipBtnText}>Got it</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function VariantDetails({ source }) {
  const details = Array.isArray(source?.variantDetails) ? source.variantDetails : [];
  const label = String(source?.variantLabel ?? '').trim();
  if (!details.length && !label) return null;
  const price = Number(source?.itemAmount ?? source?.amount) || 0;
  return (
    <View style={styles.variantBox}>
      <Text style={styles.variantBoxTitle}>
        {`Selected option${source?.variantName ? ` · ${source.variantName}` : ''}`}
      </Text>
      {details.length ? (
        details.map((d) => (
          <Text key={`${d?.label}-${d?.value}`} style={styles.variantBoxLine}>
            <Text style={styles.variantBoxLabel}>{`${String(d?.label ?? '')}: `}</Text>
            {String(d?.value ?? '')}
          </Text>
        ))
      ) : (
        <Text style={styles.variantBoxLine}>{label}</Text>
      )}
      {price > 0 ? (
        <Text style={styles.variantBoxLine}>
          <Text style={styles.variantBoxLabel}>Price: </Text>
          {formatInvoiceMoney(price)}
        </Text>
      ) : null}
    </View>
  );
}

function Bubble({
  item,
  onOpenInvoice,
  onCancelInvoice,
  onViewOrder,
  onCreateInvoice,
  onDeclineInvoice,
  canPay,
  outdated = false,
  cancelled = false,
  paid = false,
  declined = false,
  viewerIsVendor = false,
  pendingRequest = false,
}) {
  const out = item.outgoing;
  const request = item.invoiceRequest;
  if (request) {
    const image = String(request.itemImage ?? '').trim();
    const destination = formatShippingAddress(request.shippingAddress);
    const showVendorActions = viewerIsVendor && pendingRequest && !declined;
    return (
      <View style={[styles.bubbleRow, out ? styles.bubbleRowOut : styles.bubbleRowIn]}>
        <View style={[styles.waTpl, out ? styles.bubbleOut : styles.bubbleIn]}>
          <View style={styles.waTplBody}>
            <Text style={[styles.invoiceKicker, styles.requestKicker]}>
              {viewerIsVendor ? 'Buyer requested a checkout invoice' : 'You requested a checkout invoice'}
            </Text>
            {showVendorActions ? (
              <Text style={styles.requestActionHint}>
                Next step: create an invoice for this buyer, or decline the request.
              </Text>
            ) : null}
            {(Array.isArray(request.items) && request.items.length
              ? request.items
              : [{
                  itemTitle: request.itemTitle,
                  itemImage: request.itemImage,
                  itemAmount: request.itemAmount,
                  qty: request.qty,
                }]
            ).map((row, idx) => {
              const rowImage = String(row.itemImage ?? (idx === 0 ? image : '') ?? '').trim();
              const unit = Number(row.itemAmount ?? row.unitPrice) || 0;
              const rowQty = Math.max(1, Number(row.qty) || 1);
              return (
                <View key={`${row.productId ?? row.itemTitle ?? 'item'}-${idx}`} style={styles.paidProductRow}>
                  {rowImage ? <ProductCardMedia uri={rowImage} style={styles.paidProductImage} /> : null}
                  <View style={styles.paidProductCopy}>
                    <Text style={styles.paidProductTitle} numberOfLines={2}>
                      {String(row.itemTitle || request.itemTitle || 'Product')}
                    </Text>
                    <Text style={styles.paidProductMeta}>
                      Qty {rowQty}
                      {unit > 0 ? ` · ${formatInvoiceMoney(unit)} each` : ''}
                    </Text>
                  </View>
                </View>
              );
            })}
            <VariantDetails source={request} />
            {destination ? <Text style={styles.invoiceLine}>{`Ship to: ${destination}`}</Text> : null}
            {declined ? (
              <View style={styles.invoiceOutdated}>
                <Icon name="close-circle" size={16} color="#B91C1C" />
                <Text style={[styles.invoiceOutdatedText, styles.invoiceCancelledText]}>
                  {viewerIsVendor ? 'You declined this invoice request.' : 'Vendor declined this invoice request.'}
                </Text>
              </View>
            ) : null}
            <Text style={[styles.bubbleMeta, styles.waTplTime]}>{item.timeLabel}</Text>
          </View>
          {showVendorActions ? (
            <>
              <View style={styles.waTplRule} />
              <Pressable
                onPress={() => onCreateInvoice?.()}
                style={({ pressed }) => [styles.waTplAction, styles.waTplActionPrimary, pressed && styles.sendBtnPressed]}
                accessibilityRole="button"
                accessibilityLabel="Create Invoice"
              >
                <Icon name="document-text-outline" size={18} color="#FFFFFF" />
                <Text style={[styles.waTplActionText, styles.waTplActionTextOnPrimary]}>Create Invoice</Text>
              </Pressable>
              <View style={styles.waTplRule} />
              <Pressable
                onPress={() => onDeclineInvoice?.(item)}
                style={({ pressed }) => [styles.waTplAction, pressed && styles.sendBtnPressed]}
                accessibilityRole="button"
                accessibilityLabel="Decline Invoice"
              >
                <Icon name="close-circle-outline" size={18} color="#B91C1C" />
                <Text style={[styles.waTplActionText, styles.waTplActionDanger]}>Decline Invoice</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      </View>
    );
  }
  const paidCard = item.invoicePaid;
  if (paidCard) {
    const qty = Math.max(1, Number(paidCard.qty) || 1);
    const image = String(paidCard.itemImage ?? '').trim();
    return (
      <View style={[styles.bubbleRow, out ? styles.bubbleRowOut : styles.bubbleRowIn]}>
        <View style={[styles.waTpl, out ? styles.bubbleOut : styles.bubbleIn]}>
          <View style={styles.waTplBody}>
            <View style={styles.paidBadge}>
              <Icon name="checkmark-circle" size={14} color="#FFFFFF" />
              <Text style={styles.paidBadgeText}>Order placed · Paid</Text>
            </View>
            <View style={styles.paidProductRow}>
              {image ? <ProductCardMedia uri={image} style={styles.paidProductImage} /> : null}
              <View style={styles.paidProductCopy}>
                <Text style={styles.paidProductTitle} numberOfLines={2}>{String(paidCard.itemTitle || 'Product')}</Text>
                <Text style={styles.paidProductMeta}>
                  Qty {qty} · {formatInvoiceMoney(paidCard.total)}
                </Text>
              </View>
            </View>
            <Text style={[styles.bubbleMeta, styles.waTplTime]}>{item.timeLabel}</Text>
          </View>
          {(
            <>
              <View style={styles.waTplRule} />
              <Pressable
                onPress={() => onViewOrder?.(paidCard)}
                style={({ pressed }) => [styles.waTplAction, pressed && styles.sendBtnPressed]}
                accessibilityRole="button"
                accessibilityLabel="View order"
              >
                <Icon name="receipt-outline" size={18} color={BRAND} />
                <Text style={styles.waTplActionText}>View order</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    );
  }
  const invoice = item.invoice;
  const shipping = item.shipping;
  if (shipping) {
    const lines = shippingDetailLines(shipping);
    return (
      <View style={[styles.bubbleRow, out ? styles.bubbleRowOut : styles.bubbleRowIn]}>
        <View style={[styles.invoiceBubble, out && styles.invoiceBubbleOut]}>
          <Text style={styles.invoiceKicker}>{out ? 'Shipping details sent' : 'Buyer shipping details'}</Text>
          {lines.map(([label, value]) => (
            <Text key={label} style={styles.invoiceLine}>
              {`${label}: ${value}`}
            </Text>
          ))}
          <Text style={[styles.bubbleMeta, styles.invoiceMeta]}>{item.timeLabel}</Text>
        </View>
      </View>
    );
  }
  if (invoice) {
    const invoiceQty = Math.max(1, Number(invoice.qty) || 1);
    const unitAmount = Number(invoice.amount) || 0;
    const amount = unitAmount * invoiceQty;
    const shippingFee = Number(invoice.shipping) || 0;
    const total = amount + shippingFee;
    const logistics = String(invoice.logistics ?? '').trim();
    const delivery = String(invoice.deliveryTime ?? invoice.delivery_time ?? '').trim();
    const destination = String(invoice.destination ?? '').trim() || formatShippingAddress(invoice.shippingAddress);
    const itemsValue =
      invoiceQty > 1
        ? `${invoiceQty} × ${formatInvoiceMoney(unitAmount)} = ${formatInvoiceMoney(amount)}`
        : formatInvoiceMoney(amount);
    const invoiceRows = [
      ['Total', formatInvoiceMoney(total)],
      destination ? ['Ship to', destination] : null,
      ['Items', itemsValue],
      ['Shipping', formatInvoiceMoney(shippingFee)],
      logistics ? ['Logistics', logistics] : null,
      delivery ? ['Delivery', delivery] : null,
    ].filter(Boolean);
    return (
      <View style={[styles.bubbleRow, out ? styles.bubbleRowOut : styles.bubbleRowIn]}>
        <View style={[styles.waTpl, out ? styles.bubbleOut : styles.bubbleIn]}>
          <View style={styles.waTplBody}>
            <Text style={styles.invoiceKicker}>Checkout invoice</Text>
            {invoiceRows.map(([label, value]) => (
              <View key={label} style={styles.invoiceFieldRow}>
                <Text style={styles.invoiceFieldLabel}>{label}</Text>
                <Text
                  style={[
                    styles.invoiceFieldValue,
                    label === 'Total' && styles.invoiceFieldValueStrong,
                  ]}
                >
                  {value}
                </Text>
              </View>
            ))}
            <VariantDetails source={invoice} />
            <Text style={[styles.bubbleMeta, styles.waTplTime]}>{item.timeLabel}</Text>
          </View>
          {paid ? (
            <>
              <View style={styles.waTplRule} />
              <View style={styles.invoiceOutdated}>
                <Icon name="checkmark-circle" size={16} color={BRAND} />
                <Text style={[styles.invoiceOutdatedText, styles.invoicePaidText]}>Paid</Text>
              </View>
            </>
          ) : cancelled ? (
            <>
              <View style={styles.waTplRule} />
              <View style={styles.invoiceOutdated}>
                <Icon name="close-circle-outline" size={16} color="#B91C1C" />
                <Text style={[styles.invoiceOutdatedText, styles.invoiceCancelledText]}>
                  {viewerIsVendor ? 'Buyer cancelled this invoice.' : 'You cancelled this invoice.'}
                </Text>
              </View>
            </>
          ) : outdated ? (
            <>
              <View style={styles.waTplRule} />
              <View style={styles.invoiceOutdated}>
                <Icon name="alert-circle-outline" size={16} color="#B45309" />
                <Text style={styles.invoiceOutdatedText}>
                  {viewerIsVendor
                    ? 'Buyer changed the shipping address. Send a new invoice.'
                    : 'Shipping address changed. Waiting for the vendor to send a new invoice.'}
                </Text>
              </View>
            </>
          ) : canPay ? (
            <>
              <View style={styles.waTplRule} />
              <Pressable
                onPress={() => onOpenInvoice?.(invoice)}
                style={({ pressed }) => [styles.waTplAction, pressed && styles.sendBtnPressed]}
                accessibilityRole="button"
                accessibilityLabel="Pay now"
              >
                <Icon name="card-outline" size={18} color={BRAND} />
                <Text style={styles.waTplActionText}>Pay now</Text>
              </Pressable>
              <View style={styles.waTplRule} />
              <Pressable
                onPress={() => onCancelInvoice?.(item)}
                style={({ pressed }) => [styles.waTplAction, pressed && styles.sendBtnPressed]}
                accessibilityRole="button"
                accessibilityLabel="Cancel order"
              >
                <Icon name="close-circle-outline" size={18} color="#B91C1C" />
                <Text style={[styles.waTplActionText, styles.waTplActionDanger]}>Cancel order</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      </View>
    );
  }
  return (
    <View style={[styles.bubbleRow, out ? styles.bubbleRowOut : styles.bubbleRowIn]}>
      <View style={[styles.bubble, out ? styles.bubbleOut : styles.bubbleIn]}>
        <Text style={styles.bubbleText}>{abbreviateNumbers(item.text)}</Text>
        <View style={[styles.bubbleMetaRow, out ? styles.bubbleMetaRowOut : styles.bubbleMetaRowIn]}>
          <Text style={[styles.bubbleMeta, out && styles.bubbleMetaOut]}>{item.timeLabel}</Text>
          {out ? (
            <Icon
              name="checkmark-done"
              size={14}
              color={item.isRead ? '#53BDEB' : '#FFFFFF'}
              style={styles.tickIcon}
            />
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
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardOpen(true);
      if (Platform.OS !== 'android') return;
      const screenY = Number(event?.endCoordinates?.screenY);
      const windowHeight = Dimensions.get('window').height;
      const overlap = Number.isFinite(screenY) ? Math.max(0, windowHeight - screenY) : Number(event?.endCoordinates?.height) || 0;
      setKeyboardInset(overlap);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardOpen(false);
      setKeyboardInset(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);
  const route = useRoute();
  const { user } = useProfile();
  const chat = route.params?.chat;
  const pendingShopId = Number(chat?.shopId ?? chat?.shop_id) || 0;
  const [shopId, setShopId] = useState(() => pendingShopId);
  const [shopSlug, setShopSlug] = useState(() => String(chat?.shopSlug ?? chat?.shop_slug ?? '').trim());
  const [roomId, setRoomId] = useState(() => String(chat?.roomId ?? chat?.id ?? '').trim());
  const storageScope = chatRoleVariant === 'vendor' ? 'vendor' : 'customer';
  const appRolePayload = storageScope === 'vendor' ? 'vendor' : 'customer';
  const [headerTitle, setHeaderTitle] = useState(() => {
    const raw = String(chat?.name ?? '').trim();
    if (!raw || /^order\s*#/i.test(raw) || /^inbox$/i.test(raw) || /^chat$/i.test(raw)) return '';
    return raw;
  });


  const [input, setInput] = useState('');
  /** Remount multiline TextInput after send so height collapses when cleared (RN layout quirk). */
  const [inputKey, setInputKey] = useState(0);
  const [messages, setMessages] = useState(/** @type {Array<{ id: string; text: string; outgoing: boolean; timeLabel: string }>} */([]));
  const [loading, setLoading] = useState(() => Boolean(String(chat?.roomId ?? chat?.id ?? '').trim()));
  const [sending, setSending] = useState(false);
  const [shippingSending, setShippingSending] = useState(false);
  const [shippingEditOpen, setShippingEditOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceSending, setInvoiceSending] = useState(false);
  const [policyModalVisible, setPolicyModalVisible] = useState(false);
  const [policyModalVariant, setPolicyModalVariant] = useState(/** @type {'single' | 'split'} */('single'));
  const [moderationLockUntil, setModerationLockUntil] = useState(/** @type {number | null} */(null));
  const [lockRemainSec, setLockRemainSec] = useState(0);
  const listRef = useRef(null);
  /** @type {React.MutableRefObject<Array<{ text: string; sentAt: number }>>} */
  const outgoingSendHistoryRef = useRef([]);
  const sessionModerationBlocksRef = useRef(0);
  const inquiryPostedRef = useRef(false);

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

  const openVendorShop = useCallback(() => {
    if (appRolePayload !== 'customer' || !(shopId > 0)) return;
    const params = {
      vendor: {
        id: shopId,
        shop_id: shopId,
        name: headerTitle || chat?.name || 'Shop',
        slug: shopSlug || undefined,
      },
      category: '__all__',
    };
    const names = navigation.getState()?.routeNames ?? [];
    if (names.includes('Vendor')) {
      navigation.navigate('Vendor', params);
      return;
    }
    navigation.getParent()?.navigate('Home', { screen: 'Vendor', params });
  }, [appRolePayload, shopId, shopSlug, navigation, headerTitle, chat?.name]);

  useLayoutEffect(() => {
    const title = headerTitle || 'Chat';
    navigation.setOptions({
      title,
      headerTitle: () => (
        <Text numberOfLines={1} style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '600', maxWidth: 240 }}>
          {title}
        </Text>
      ),
      headerRight: () =>
        appRolePayload === 'customer' && shopId > 0 ? (
          <Pressable
            onPress={openVendorShop}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Open shop"
            style={{ marginRight: 4, paddingHorizontal: 6, paddingVertical: 4 }}
          >
            <Icon name="storefront-outline" size={22} color="#FFFFFF" />
          </Pressable>
        ) : null,
    });
  }, [navigation, headerTitle, appRolePayload, shopId, openVendorShop]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await connectChatSocket();
        const out = await emitChatSocketAck('get_rooms', { app_role: appRolePayload });
        const rooms = Array.isArray(out?.result?.rooms) ? out.result.rooms : [];
        if (roomId) {
          const room = rooms.find((row) => String(row?.id ?? row?.roomId ?? '').trim() === roomId);
          const next = String(
            room?.counterpart_name ?? room?.counterpartName ?? room?.name ?? '',
          ).trim();
          if (!cancelled && next && !/^order\s*#/i.test(next) && !/^chat$/i.test(next)) {
            setHeaderTitle(next);
          }
          const sid = Number(room?.shop_id ?? room?.shopId) || 0;
          if (!cancelled && sid > 0) setShopId(sid);
          const nextSlug = String(room?.shop_slug ?? room?.shopSlug ?? '').trim();
          if (!cancelled && nextSlug) setShopSlug(nextSlug);
          return;
        }
        if (pendingShopId <= 0) return;
        const shopKey = String(headerTitle || chat?.name || '').trim().toLowerCase();
        const shopIdStr = String(pendingShopId);
        const match = rooms.find((row) => {
          const name = String(row?.counterpart_name ?? row?.counterpartName ?? '').trim().toLowerCase();
          const rowShop = String(row?.shop_id ?? row?.shopId ?? '').trim();
          return (shopKey && name === shopKey) || (shopIdStr && rowShop === shopIdStr);
        });
        const foundId = String(match?.id ?? match?.roomId ?? '').trim();
        if (!cancelled && foundId) {
          setRoomId(foundId);
          const sid = Number(match?.shop_id ?? match?.shopId) || pendingShopId;
          if (sid > 0) setShopId(sid);
          const nextSlug = String(match?.shop_slug ?? match?.shopSlug ?? '').trim();
          if (nextSlug) setShopSlug(nextSlug);
        }
      } catch {
        /* keep pending composer */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [roomId, pendingShopId, appRolePayload, headerTitle, chat?.name]);

  useEffect(() => {
    outgoingSendHistoryRef.current = [];
    sessionModerationBlocksRef.current = 0;
    inquiryPostedRef.current = false;
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
      const card = parseCardContent(row.content);
      const invoice = card?.kind === 'invoice' || card?.type === 'invoice' ? card : null;
      const shippingCard = card?.kind === 'shipping' || card?.type === 'shipping' ? card : null;
      const inquiry = card?.kind === 'inquiry' || card?.type === 'inquiry' ? card : null;
      const invoiceRequest = card?.kind === 'invoice_request' ? card : null;
      if (invoiceRequest) {
        return {
          id: String(row.id ?? `msg-${Date.now()}`),
          text: 'Checkout invoice requested',
          invoice: null,
          shipping: null,
          inquiry: null,
          invoiceRequest,
          outgoing,
          timeLabel,
          sentAt: Number.isNaN(d.getTime()) ? Date.now() : d.getTime(),
          isRead: Boolean(row.is_read ?? row.isRead ?? row.read),
        };
      }
      const invoicePaid = card?.kind === 'invoice_paid' ? card : null;
      if (invoicePaid) {
        return {
          id: String(row.id ?? `msg-${Date.now()}`),
          text: 'Order placed',
          invoice: null,
          shipping: null,
          inquiry: null,
          invoicePaid,
          outgoing,
          timeLabel,
          sentAt: Number.isNaN(d.getTime()) ? Date.now() : d.getTime(),
          isRead: Boolean(row.is_read ?? row.isRead ?? row.read),
        };
      }
      const invoiceCancel = card?.kind === 'invoice_cancelled' ? card : null;
      if (invoiceCancel) {
        return {
          id: String(row.id ?? `msg-${Date.now()}`),
          text: outgoing ? 'You cancelled the checkout invoice.' : 'Buyer cancelled the checkout invoice.',
          invoice: null,
          shipping: null,
          inquiry: null,
          invoiceCancel,
          outgoing,
          timeLabel,
          sentAt: Number.isNaN(d.getTime()) ? Date.now() : d.getTime(),
          isRead: Boolean(row.is_read ?? row.isRead ?? row.read),
        };
      }
      const invoiceRequestDeclined = card?.kind === 'invoice_request_declined' ? card : null;
      if (invoiceRequestDeclined) {
        return {
          id: String(row.id ?? `msg-${Date.now()}`),
          text: outgoing ? 'You declined the invoice request.' : 'Vendor declined the invoice request.',
          invoice: null,
          shipping: null,
          inquiry: null,
          invoiceRequestDeclined,
          outgoing,
          timeLabel,
          sentAt: Number.isNaN(d.getTime()) ? Date.now() : d.getTime(),
          isRead: Boolean(row.is_read ?? row.isRead ?? row.read),
        };
      }
      return {
        id: String(row.id ?? `msg-${Date.now()}`),
        text: invoice
          ? 'Checkout invoice'
          : shippingCard
            ? 'Shipping details'
            : inquiry
              ? ''
              : String(row.content ?? '').trim(),
        invoice,
        shipping: shippingCard,
        inquiry,
        outgoing,
        timeLabel,
        sentAt: Number.isNaN(d.getTime()) ? Date.now() : d.getTime(),
        isRead: Boolean(row.is_read ?? row.isRead ?? row.read),
      };
    },
    [user?.id],
  );

  const loadMessages = useCallback(async () => {
    if (!roomId) {
      setLoading(false);
      setMessages([]);
      return;
    }
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
      const result = out.result && typeof out.result === 'object' ? out.result : {};
      const recipient = String(result.counterpart_name ?? result.counterpartName ?? '').trim();
      if (recipient && !/^order\s*#/i.test(recipient) && !/^chat$/i.test(recipient)) {
        setHeaderTitle(recipient);
      }
      const sid = Number(result.shop_id ?? result.shopId) || 0;
      if (sid > 0) setShopId(sid);
      const nextSlug = String(result.shop_slug ?? result.shopSlug ?? '').trim();
      if (nextSlug) setShopSlug(nextSlug);
      const list = 'messages' in result ? result.messages : [];
      const mapped = (Array.isArray(list) ? list : [])
        .filter((x) => x && typeof x === 'object')
        .map((x) => mapMessage(/** @type {Record<string, unknown>} */(x)))
        .filter((x) => x.text || x.invoice || x.shipping || x.inquiry);
      setMessages(mapped);
      outgoingSendHistoryRef.current = mapped
        .filter((row) => row.outgoing && row.text && !row.invoice && !row.shipping)
        .slice(-MODERATION_CONFIG.HISTORY_MAX_MESSAGES)
        .map((row) => ({ text: row.text, sentAt: row.sentAt ?? Date.now() }));
      refreshUnreadChats(appRolePayload).catch(() => {});
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
        if (!mapped.text && !mapped.invoice && !mapped.shipping && !mapped.inquiry) return;
        setMessages((prev) => {
          if (prev.some((p) => p.id === mapped.id)) return prev;
          return [...prev, mapped];
        });
        if (!mapped.outgoing && mapped.id) {
          emitChatSocketAck('mark_message_as_read', {
            message_id: mapped.id,
            app_role: appRolePayload,
          }).catch(() => {});
        }
        requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
      };
      const onMessagesRead = (payload) => {
        if (!payload || String(payload.room_id ?? '') !== roomId) return;
        setMessages((prev) =>
          prev.map((row) => (row.outgoing ? { ...row, isRead: true } : row)),
        );
      };
      const onMessageRead = (payload) => {
        if (!payload || String(payload.room_id ?? '') !== roomId) return;
        const mid = String(payload.message_id ?? '');
        if (!mid) return;
        setMessages((prev) =>
          prev.map((row) => (row.id === mid ? { ...row, isRead: true } : row)),
        );
      };
      socket?.on('message_created', onIncoming);
      socket?.on('messages_read', onMessagesRead);
      socket?.on('message_read', onMessageRead);
      return () => {
        socket?.off('message_created', onIncoming);
        socket?.off('messages_read', onMessagesRead);
        socket?.off('message_read', onMessageRead);
      };
    }, [roomId, loadMessages, mapMessage, storageScope, appRolePayload]),
  );

  const latestBuyerShipping = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i]?.shipping) return messages[i].shipping;
    }
    return null;
  }, [messages]);
  /** Invoices sent before the buyer's latest address are stale: distance changes the shipping price. */
  const outdatedInvoiceIds = useMemo(() => {
    let lastShippingIdx = -1;
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i]?.shipping) { lastShippingIdx = i; break; }
    }
    const ids = new Set();
    for (let i = 0; i < lastShippingIdx; i += 1) {
      if (messages[i]?.invoice) ids.add(messages[i].id);
    }
    return ids;
  }, [messages]);
  const paidInvoiceIds = useMemo(() => {
    const ids = new Set();
    messages.forEach((row) => {
      const ref = String(row?.invoicePaid?.invoiceMessageId ?? '').trim();
      if (ref) ids.add(ref);
    });
    return ids;
  }, [messages]);
  const cancelledInvoiceIds = useMemo(() => {
    const ids = new Set();
    messages.forEach((row) => {
      const ref = String(row?.invoiceCancel?.invoiceMessageId ?? '').trim();
      if (ref) ids.add(ref);
    });
    return ids;
  }, [messages]);
  const declinedRequestIds = useMemo(() => {
    const ids = new Set();
    messages.forEach((row) => {
      const ref = String(row?.invoiceRequestDeclined?.requestMessageId ?? '').trim();
      if (ref) ids.add(ref);
    });
    return ids;
  }, [messages]);
  /** The vendor may only invoice in answer to a buyer request that has no invoice yet. */
  const pendingRequestId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i]?.invoiceRequestDeclined) return '';
      if (messages[i]?.invoice) return '';
      if (messages[i]?.invoiceRequest) return messages[i].id;
    }
    return '';
  }, [messages]);
  const invoiceAlreadySent = !pendingRequestId;
  const pendingRequest = useMemo(
    () => messages.find((m) => m.id === pendingRequestId)?.invoiceRequest ?? null,
    [messages, pendingRequestId],
  );
  const requestedQty = Math.max(1, Number(pendingRequest?.qty) || 1);
  const openInvoicePending = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const row = messages[i];
      if (row?.invoiceRequest) return false;
      if (row?.invoice) {
        return !paidInvoiceIds.has(row.id) && !cancelledInvoiceIds.has(row.id) && !outdatedInvoiceIds.has(row.id);
      }
    }
    return false;
  }, [messages, paidInvoiceIds, cancelledInvoiceIds, outdatedInvoiceIds]);
  const buyerDestination = useMemo(
    () => formatShippingAddress(latestBuyerShipping),
    [latestBuyerShipping],
  );
  const hasBuyerShipping = Boolean(latestBuyerShipping);
  const inquiryItemAmount = Number(chat?.itemAmount ?? chat?.productAmount) || 0;
  const inquiryItemTitle = String(chat?.itemTitle ?? chat?.productTitle ?? '').trim();
  const inquiryItemImage = String(chat?.itemImage ?? chat?.productImage ?? '').trim();
  const inquiryProductId = Number(chat?.productId) || 0;
  const inquiryOrderLines = Array.isArray(chat?.orderLines) ? chat.orderLines : [];
  const latestProduct = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const row = messages[i];
      const fromInvoice = row?.invoice
        ? productFromCard({
            productId: row.invoice.productId,
            itemAmount: row.invoice.amount,
            itemTitle: row.invoice.itemTitle,
            itemImage: row.invoice.itemImage,
          })
        : null;
      const snap = productFromCard(row?.inquiry) || productFromCard(row?.shipping) || fromInvoice;
      if (snap && (snap.productId > 0 || snap.itemTitle)) return snap;
    }
    return {
      productId: inquiryProductId,
      itemAmount: inquiryItemAmount,
      itemTitle: inquiryItemTitle,
      itemImage: inquiryItemImage,
    };
  }, [messages, inquiryProductId, inquiryItemAmount, inquiryItemTitle, inquiryItemImage]);
  const itemAmount = Number(latestProduct?.itemAmount) || inquiryItemAmount;
  const itemTitle = String(latestProduct?.itemTitle || inquiryItemTitle).trim();
  const itemImage = String(latestProduct?.itemImage || inquiryItemImage).trim();
  const productId = Number(latestProduct?.productId) || inquiryProductId;
  const visibleMessages = useMemo(
    () => messages.filter((row) => row.text || row.invoice || row.shipping),
    [messages],
  );
  const composeLocked = moderationComposeLocked;

  useEffect(() => {
    if (appRolePayload !== 'customer') return;
    if (inquiryPostedRef.current) return;
    if (!roomId || loading) return;
    if (!(inquiryProductId > 0) && !(inquiryItemAmount > 0) && !inquiryOrderLines.length) return;
    let lastPaidIdx = -1;
    messages.forEach((row, idx) => {
      if (row?.invoicePaid) lastPaidIdx = idx;
    });
    const already = messages.slice(lastPaidIdx + 1).some((row) => {
      const amount = Number(row?.inquiry?.itemAmount ?? row?.shipping?.itemAmount) || 0;
      const pid = Number(row?.inquiry?.productId ?? row?.shipping?.productId) || 0;
      if (inquiryProductId > 0 && pid === inquiryProductId) return true;
      return inquiryItemAmount > 0 && amount === inquiryItemAmount;
    });
    if (already) {
      inquiryPostedRef.current = true;
      return;
    }
    inquiryPostedRef.current = true;
    void emitChatSocketAck('create_message', {
      room_id: roomId,
      type: 'system',
      content: JSON.stringify({
        kind: 'inquiry',
        itemAmount: inquiryItemAmount,
        itemTitle: inquiryItemTitle,
        itemImage: inquiryItemImage || undefined,
        productId: inquiryProductId || undefined,
        items: inquiryOrderLines.length
          ? inquiryOrderLines.map((row) => ({
              productId: Number(row.productId) || undefined,
              itemTitle: row.title || row.itemTitle,
              itemImage: row.image || row.itemImage,
              itemAmount: Number(row.unitPrice ?? row.itemAmount) || 0,
              qty: Math.max(1, Number(row.qty) || 1),
              variantId: Number(row.variantId) || undefined,
              variantLabel: row.variantLabel || undefined,
            }))
          : undefined,
      }),
      app_role: 'customer',
    }).then((out) => {
      if (!out?.success) {
        inquiryPostedRef.current = false;
        return;
      }
      const resultMsg =
        out.result && typeof out.result === 'object' && 'message' in out.result
          ? /** @type {Record<string, unknown>} */ (/** @type {{ message: unknown }} */ (out.result).message)
          : null;
      if (resultMsg) {
        const mapped = mapMessage(resultMsg);
        setMessages((prev) => (prev.some((p) => p.id === mapped.id) ? prev : [...prev, mapped]));
      }
    }).catch(() => {
      inquiryPostedRef.current = false;
    });
  }, [
    appRolePayload,
    roomId,
    loading,
    inquiryItemAmount,
    inquiryItemTitle,
    inquiryItemImage,
    inquiryProductId,
    inquiryOrderLines,
    messages,
    mapMessage,
  ]);

  const ensureRoomId = useCallback(async () => {
    if (roomId) return roomId;
    if (!(pendingShopId > 0)) return '';
    const created = await emitChatSocketAck('create_room', {
      shop_id: pendingShopId,
      app_role: appRolePayload,
      initiator_role: 'buyer',
      recipient_role: 'seller',
    });
    const room =
      created?.result && typeof created.result === 'object' ? created.result.room : null;
    const activeRoomId = String(room?.id ?? room?.roomId ?? '').trim();
    if (!created?.success || !activeRoomId) {
      Alert.alert('Chat unavailable', created?.message || 'Could not start this chat.');
      return '';
    }
    const name = String(room?.counterpart_name ?? room?.counterpartName ?? '').trim();
    if (name && !/^order\s*#/i.test(name) && !/^chat$/i.test(name)) {
      setHeaderTitle(name);
    }
    setRoomId(activeRoomId);
    navigation.setParams({
      chat: {
        ...(chat && typeof chat === 'object' ? chat : {}),
        roomId: activeRoomId,
        name: name || headerTitle || chat?.name,
      },
    });
    void setLastOpenedChatRoomId(activeRoomId, storageScope);
    return activeRoomId;
  }, [roomId, pendingShopId, appRolePayload, navigation, chat, headerTitle, storageScope]);

  const [requestSending, setRequestSending] = useState(false);
  const postInvoiceRequest = useCallback(async (shippingAddress, qty, variant) => {
    const activeRoomId = await ensureRoomId();
    if (!activeRoomId) return false;
    const lines = inquiryOrderLines;
    const firstLine = lines[0];
    const unitPrice =
      Number(variant?.price) ||
      Number(firstLine?.unitPrice ?? firstLine?.itemAmount) ||
      Number(itemAmount) ||
      0;
    const requestQty =
      lines.length === 1
        ? Math.max(1, Number(firstLine?.qty) || 1)
        : lines.length > 1
          ? 1
          : Math.max(1, Number(qty) || 1);
    const out = await emitChatSocketAck('create_message', {
      room_id: activeRoomId,
      type: 'system',
      content: JSON.stringify({
        kind: 'invoice_request',
        qty: requestQty,
        shippingAddress: shippingAddress || undefined,
        inventoryId: variant?.inventoryId || firstLine?.inventoryId || undefined,
        variantLabel: variant?.label || firstLine?.variantLabel || undefined,
        variantName: variant?.name || undefined,
        variantDetails: variant?.details?.length ? variant.details : undefined,
        itemAmount: unitPrice || undefined,
        itemTitle: itemTitle || undefined,
        itemImage: itemImage || undefined,
        productId: productId || undefined,
        items: lines.length
          ? lines.map((row) => ({
              productId: Number(row.productId) || undefined,
              itemTitle: row.title || row.itemTitle,
              itemImage: row.image || row.itemImage,
              itemAmount: Number(row.unitPrice ?? row.itemAmount) || 0,
              qty: Math.max(1, Number(row.qty) || 1),
              variantLabel: row.variantLabel || undefined,
            }))
          : undefined,
      }),
      app_role: 'customer',
    });
    if (!out.success) {
      Alert.alert('Request not sent', out.message || 'Try again.');
      return false;
    }
    const resultMsg =
      out.result && typeof out.result === 'object' && 'message' in out.result
        ? /** @type {Record<string, unknown>} */ (/** @type {{ message: unknown }} */ (out.result).message)
        : null;
    if (resultMsg) {
      const mapped = mapMessage(resultMsg);
      setMessages((prev) => (prev.some((p) => p.id === mapped.id) ? prev : [...prev, mapped]));
    }
    return true;
  }, [ensureRoomId, mapMessage, itemAmount, itemTitle, itemImage, productId, inquiryOrderLines]);

  const [qtyOpen, setQtyOpen] = useState(false);
  const requestShippingRef = useRef(null);
  const [showBuyerInvoiceTip, setShowBuyerInvoiceTip] = useState(false);

  const dismissBuyerInvoiceTip = useCallback(() => {
    setShowBuyerInvoiceTip(false);
    void markBuyerInvoiceTipSeen(user?.id);
  }, [user?.id]);

  useEffect(() => {
    if (appRolePayload !== 'customer') {
      setShowBuyerInvoiceTip(false);
      return undefined;
    }
    let active = true;
    hasSeenBuyerInvoiceTip(user?.id).then((seen) => {
      if (active && !seen) setShowBuyerInvoiceTip(true);
    });
    return () => {
      active = false;
    };
  }, [appRolePayload, user?.id]);

  const onRequestInvoice = useCallback(() => {
    if (requestSending) return;
    dismissBuyerInvoiceTip();
    if (!latestBuyerShipping) {
      setShippingEditOpen(true);
      return;
    }
    requestShippingRef.current = latestBuyerShipping;
    if (inquiryOrderLines.length) {
      void postInvoiceRequest(
        latestBuyerShipping,
        inquiryOrderLines.reduce((sum, row) => sum + Math.max(1, Number(row.qty) || 1), 0),
        null,
      );
      return;
    }
    setQtyOpen(true);
  }, [requestSending, latestBuyerShipping, dismissBuyerInvoiceTip, inquiryOrderLines, postInvoiceRequest]);

  const onSubmitQty = useCallback(async (qty, variant) => {
    if (requestSending) return;
    setRequestSending(true);
    try {
      const sent = await postInvoiceRequest(requestShippingRef.current || latestBuyerShipping, qty, variant);
      if (sent) setQtyOpen(false);
    } finally {
      setRequestSending(false);
    }
  }, [requestSending, postInvoiceRequest, latestBuyerShipping]);

  const onSubmitShipping = useCallback(async (payload) => {
    if (shippingSending) return;
    setShippingSending(true);
    try {
      const activeRoomId = await ensureRoomId();
      if (!activeRoomId) return;
      const out = await emitChatSocketAck('create_message', {
        room_id: activeRoomId,
        type: 'system',
        content: JSON.stringify({
          kind: 'shipping',
          ...payload,
          itemAmount: inquiryItemAmount || undefined,
          itemTitle: inquiryItemTitle || undefined,
          itemImage: inquiryItemImage || undefined,
          productId: inquiryProductId || undefined,
        }),
        app_role: 'customer',
      });
      if (!out.success) {
        Alert.alert('Address not sent', out.message || 'Try again.');
        return;
      }
      const resultMsg =
        out.result && typeof out.result === 'object' && 'message' in out.result
          ? /** @type {Record<string, unknown>} */ (/** @type {{ message: unknown }} */ (out.result).message)
          : null;
      if (resultMsg) {
        const mapped = mapMessage(resultMsg);
        setMessages((prev) => (prev.some((p) => p.id === mapped.id) ? prev : [...prev, mapped]));
      }
      setShippingEditOpen(false);
      requestShippingRef.current = { kind: 'shipping', ...payload };
      if (inquiryOrderLines.length) {
        await postInvoiceRequest(
          { kind: 'shipping', ...payload },
          inquiryOrderLines.reduce((sum, row) => sum + Math.max(1, Number(row.qty) || 1), 0),
          null,
        );
        return;
      }
      setTimeout(() => setQtyOpen(true), Platform.OS === 'ios' ? 400 : 0);
    } finally {
      setShippingSending(false);
    }
  }, [shippingSending, ensureRoomId, mapMessage, inquiryItemAmount, inquiryItemTitle, inquiryItemImage, inquiryProductId, inquiryOrderLines, postInvoiceRequest]);

  const onSubmitInvoice = useCallback(async (payload) => {
    if (invoiceSending) return;
    if (invoiceAlreadySent) {
      setInvoiceOpen(false);
      Alert.alert('No invoice request', 'You can send an invoice once the buyer requests one.');
      return;
    }
    if (!roomId) {
      Alert.alert('Chat unavailable', 'This conversation is not ready yet.');
      return;
    }
    if (!(shopId > 0)) {
      Alert.alert('Shop unavailable', 'Could not identify your shop for this chat.');
      return;
    }
    setInvoiceSending(true);
    try {
      const out = await emitChatSocketAck('create_message', {
        room_id: roomId,
        type: 'system',
        content: JSON.stringify({
          kind: 'invoice',
          amount: payload.amount,
          qty: requestedQty,
          inventoryId: pendingRequest?.inventoryId || undefined,
          variantLabel: pendingRequest?.variantLabel || undefined,
          variantName: pendingRequest?.variantName || undefined,
          variantDetails: pendingRequest?.variantDetails || undefined,
          shipping: payload.shipping,
          deliveryTime: payload.deliveryTime,
          deliveryTimeKey: payload.deliveryTimeKey,
          destination: payload.destination,
          shippingAddress: latestBuyerShipping,
          productId: payload.productId || productId || undefined,
          itemTitle: payload.itemTitle || itemTitle || undefined,
          itemImage: payload.itemImage || itemImage || undefined,
          shopId,
        }),
        app_role: 'vendor',
      });
      if (!out.success) {
        Alert.alert('Invoice not sent', out.message || 'Try again.');
        return;
      }
      const resultMsg =
        out.result && typeof out.result === 'object' && 'message' in out.result
          ? /** @type {Record<string, unknown>} */ (/** @type {{ message: unknown }} */ (out.result).message)
          : null;
      if (resultMsg) {
        const mapped = mapMessage(resultMsg);
        setMessages((prev) => (prev.some((p) => p.id === mapped.id) ? prev : [...prev, mapped]));
      }
      setInvoiceOpen(false);
    } finally {
      setInvoiceSending(false);
    }
  }, [invoiceSending, roomId, shopId, latestBuyerShipping, mapMessage, productId, itemTitle, itemImage, invoiceAlreadySent, requestedQty, pendingRequest]);

  const openInvoiceCheckout = useCallback((invoice) => {
    if (appRolePayload !== 'customer' || !invoice) return;
    const amount = Number(invoice.amount) || 0;
    const shipping = Number(invoice.shipping) || 0;
    const sid = Number(invoice.shopId ?? invoice.shop_id ?? shopId) || 0;
    const shippingAddress = invoice.shippingAddress && typeof invoice.shippingAddress === 'object'
      ? invoice.shippingAddress
      : latestBuyerShipping;
    const params = {
      checkoutSource: 'chat_invoice',
      chatRoomId: roomId || chat?.roomId || undefined,
      invoiceMessageId: messages.find((m) => m.invoice === invoice)?.id,
      returnChat: {
        routeKey: route.key,
        routeName: route.name,
        tab: (() => {
          const parentState = navigation.getParent()?.getState();
          return parentState?.routes?.[parentState.index]?.name;
        })(),
        chat: { ...(chat && typeof chat === 'object' ? chat : {}), roomId: roomId || chat?.roomId },
      },
      invoiceShipping: shipping,
      invoiceDeliveryTime: String(invoice.deliveryTimeKey || invoice.deliveryTime || invoice.delivery_time || ''),
      invoiceShippingAddress: shippingAddress || undefined,
      checkoutLines: [
        {
          key: `invoice-${invoice.productId || productId || Date.now()}`,
          title: String(invoice.itemTitle || itemTitle || 'Product').trim() || 'Product',
          image: String(invoice.itemImage || itemImage || '').trim(),
          unitPrice: amount,
          qty: Math.max(1, Number(invoice.qty) || 1),
          shop_id: sid || undefined,
          productId: Number(invoice.productId || productId) || undefined,
          inventoryId: Number(invoice.inventoryId) || undefined,
          variantLabel: String(invoice.variantLabel || '').trim(),
        },
      ],
    };
    const names = navigation.getState()?.routeNames ?? [];
    if (names.includes('Cart-checkout')) {
      navigation.navigate('Cart-checkout', params);
      return;
    }
    navigation.getParent()?.navigate('Chat', { screen: 'Cart-checkout', params, initial: false });
  }, [appRolePayload, shopId, navigation, latestBuyerShipping, productId, itemTitle, itemImage, route.key, chat, roomId, messages]);

  const bumpModerationLockIfNeeded = useCallback(() => {
    if (sessionModerationBlocksRef.current >= MODERATION_CONFIG.SESSION_BLOCKS_FOR_LOCK) {
      setModerationLockUntil(Date.now() + MODERATION_CONFIG.CHAT_LOCK_DURATION_MS);
    }
  }, []);

  const onSend = useCallback(() => {
    const t = input.trim();
    if (!t || sending) return;
    if (!roomId && pendingShopId <= 0) return;
    if (moderationLockUntil != null && Date.now() < moderationLockUntil) return;
    if (isGibberishMessage(t)) {
      Alert.alert('Message unclear', 'This message doesn\'t look like readable text. Please type a clear message.');
      return;
    }

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
        const activeRoomId = await ensureRoomId();
        if (!activeRoomId) {
          Alert.alert('Chat unavailable', 'This conversation is not ready yet.');
          return;
        }
        const out = await emitChatSocketAck('create_message', {
          room_id: activeRoomId,
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
    ensureRoomId,
    mapMessage,
    appRolePayload,
    moderationLockUntil,
    bumpModerationLockIfNeeded,
  ]);

  const onViewOrder = useCallback(async (paidCard) => {
    const reference = String(paidCard?.reference ?? '').trim();
    let orderId = Number(paidCard?.orderId) || 0;
    if (!orderId && reference) {
      try {
        orderId = await fetchOrderIdByReference(reference);
      } catch {
        orderId = 0;
      }
    }
    if (!orderId) {
      Alert.alert('Order not ready', 'This order is still being confirmed. Check Orders in Activities in a moment.');
      return;
    }
    navigation.navigate('Order-detail', { orderId, fromChatRoomId: roomId });
  }, [navigation]);

  const onCancelInvoice = useCallback((item) => {
    if (!roomId || !item?.id) return;
    Alert.alert(
      'Cancel order?',
      'This cancels the checkout invoice. The vendor can send you a new one.',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel order',
          style: 'destructive',
          onPress: async () => {
            const out = await emitChatSocketAck('create_message', {
              room_id: roomId,
              type: 'system',
              content: JSON.stringify({ kind: 'invoice_cancelled', invoiceMessageId: item.id }),
              app_role: 'customer',
            });
            if (!out?.success) {
              Alert.alert('Could not cancel', out?.message || 'Try again.');
              return;
            }
            const resultMsg =
              out.result && typeof out.result === 'object' && 'message' in out.result
                ? /** @type {Record<string, unknown>} */ (/** @type {{ message: unknown }} */ (out.result).message)
                : null;
            if (resultMsg) {
              const mapped = mapMessage(resultMsg);
              setMessages((prev) => (prev.some((p) => p.id === mapped.id) ? prev : [...prev, mapped]));
            }
          },
        },
      ],
    );
  }, [roomId, mapMessage]);

  const onDeclineInvoice = useCallback((item) => {
    if (!roomId || !item?.id || appRolePayload !== 'vendor') return;
    Alert.alert(
      'Decline invoice request?',
      'The buyer will be told you declined. They can send a new request later.',
      [
        { text: 'Keep request', style: 'cancel' },
        {
          text: 'Decline Invoice',
          style: 'destructive',
          onPress: async () => {
            const out = await emitChatSocketAck('create_message', {
              room_id: roomId,
              type: 'system',
              content: JSON.stringify({
                kind: 'invoice_request_declined',
                requestMessageId: item.id,
              }),
              app_role: 'vendor',
            });
            if (!out?.success) {
              Alert.alert('Could not decline', out?.message || 'Try again.');
              return;
            }
            const resultMsg =
              out.result && typeof out.result === 'object' && 'message' in out.result
                ? /** @type {Record<string, unknown>} */ (/** @type {{ message: unknown }} */ (out.result).message)
                : null;
            if (resultMsg) {
              const mapped = mapMessage(resultMsg);
              setMessages((prev) => (prev.some((p) => p.id === mapped.id) ? prev : [...prev, mapped]));
            }
          },
        },
      ],
    );
  }, [roomId, mapMessage, appRolePayload]);

  const renderItem = useCallback(
    ({ item }) => (
      <Bubble
        item={item}
        canPay={appRolePayload === 'customer' && Boolean(item.invoice)}
        outdated={outdatedInvoiceIds.has(item.id)}
        cancelled={cancelledInvoiceIds.has(item.id)}
        paid={paidInvoiceIds.has(item.id)}
        declined={declinedRequestIds.has(item.id)}
        onViewOrder={onViewOrder}
        onCancelInvoice={onCancelInvoice}
        onDeclineInvoice={onDeclineInvoice}
        viewerIsVendor={appRolePayload === 'vendor'}
        pendingRequest={item.id === pendingRequestId}
        onCreateInvoice={() => setInvoiceOpen(true)}
        onOpenInvoice={openInvoiceCheckout}
      />
    ),
    [
      appRolePayload,
      openInvoiceCheckout,
      outdatedInvoiceIds,
      cancelledInvoiceIds,
      paidInvoiceIds,
      declinedRequestIds,
      onCancelInvoice,
      onDeclineInvoice,
      onViewOrder,
      pendingRequestId,
    ],
  );

  const openShippingEditParam = route.params?.openShippingEdit;
  useEffect(() => {
    if (!openShippingEditParam || appRolePayload !== 'customer') return;
    if (!hasBuyerShipping) return;
    setShippingEditOpen(true);
    navigation.setParams({ openShippingEdit: undefined });
  }, [openShippingEditParam, appRolePayload, hasBuyerShipping, navigation]);

  const buyerNeedsInvoiceTip =
    appRolePayload === 'customer' &&
    showBuyerInvoiceTip &&
    !pendingRequestId &&
    !openInvoicePending;

  const headerActionCard =
    appRolePayload === 'vendor' ? (
      <HeaderActionCard
        title={pendingRequestId ? 'Create checkout invoice' : 'No invoice requested'}
        alertLabel={pendingRequestId ? 'Invoice requested · Action needed' : ''}
        subtitle={pendingRequestId
          ? 'The buyer is waiting for an invoice'
          : 'You can send an invoice once the buyer requests one'}
        disabled={!pendingRequestId}
        onPress={() => setInvoiceOpen(true)}
      />
    ) : appRolePayload === 'customer' ? (
      <HeaderActionCard
        title={pendingRequestId ? 'Checkout invoice requested' : 'Request checkout invoice'}
        subtitle={pendingRequestId
          ? 'Waiting for the vendor to send your invoice'
          : openInvoicePending
            ? 'Pay or cancel the invoice below first'
            : hasBuyerShipping
              ? `Ship to ${buyerDestination}`
              : 'Add your shipping address to get an invoice'}
        disabled={Boolean(pendingRequestId) || openInvoicePending || requestSending}
        highlight={buyerNeedsInvoiceTip}
        onPress={onRequestInvoice}
      />
    ) : null;
  const keyExtractor = useCallback((m) => m.id, []);

  const listHeader = useMemo(() => <TodayChip />, []);
  const [topOverlayHeight, setTopOverlayHeight] = useState(0);
  const topOverlay = (
    <View
      style={styles.topOverlay}
      pointerEvents="box-none"
      onLayout={(e) => setTopOverlayHeight(e.nativeEvent.layout.height)}
    >
      <MonitoringNotice />
      {headerActionCard}
      <BuyerInvoiceTip visible={buyerNeedsInvoiceTip} onDismiss={dismissBuyerInvoiceTip} />
    </View>
  );

  const listContentStyle = useMemo(
    () => [
      styles.listPad,
      {
        flexGrow: 1,
        paddingTop: 8 + topOverlayHeight,
        paddingBottom: 12 + insets.bottom,
      },
    ],
    [insets.bottom, topOverlayHeight],
  );

  const inputBarStyle = useMemo(
    () => [
      styles.inputBar,
      {
        paddingBottom: keyboardOpen ? 8 : Math.max(insets.bottom, 8),
        paddingTop: 8,
      },
    ],
    [insets.bottom, keyboardOpen],
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
      Platform.OS === 'android' &&
      <SafeAreaView style={[styles.flex, keyboardInset > 0 && { paddingBottom: keyboardInset }]} edges={['left', 'right']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 56 : 0}
        >
          <View style={styles.flex}>
            {topOverlay}
            <FlatList
              ref={listRef}
              data={visibleMessages}
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
                      <ActivityIndicator size="small" color={BRAND} />
                      <Text style={styles.emptyMessagesText}>Loading messages…</Text>
                    </>
                  ) : (
                    <Text style={styles.emptyMessagesText}>
                      {appRolePayload === 'customer'
                        ? 'No messages yet. Tap Request checkout invoice above to start buying, or say hello.'
                        : 'No messages yet. Say hello.'}
                    </Text>
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
                    editable={!composeLocked}
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
                    (pressed || sending || composeLocked) && styles.sendBtnPressed,
                    composeLocked && styles.sendBtnDisabled,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Send message"
                  disabled={sending || composeLocked}
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
        behavior="padding"
        keyboardVerticalOffset={insets.top + 56}
      >
        <View style={styles.flex}>
          {topOverlay}
          <FlatList
            ref={listRef}
            data={visibleMessages}
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
                    <ActivityIndicator size="small" color={BRAND} />
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
                  editable={!composeLocked}
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
                  (pressed || sending || composeLocked) && styles.sendBtnPressed,
                  composeLocked && styles.sendBtnDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Send message"
                disabled={sending || composeLocked}
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
      <ChatShippingModal
        visible={shippingEditOpen}
        sending={shippingSending || requestSending}
        initialValue={latestBuyerShipping}
        onCancel={() => setShippingEditOpen(false)}
        onSubmit={onSubmitShipping}
      />
      <ChatQuantityModal
        visible={qtyOpen}
        sending={requestSending}
        itemTitle={itemTitle}
        itemImage={itemImage}
        itemAmount={itemAmount}
        productId={productId}
        initialVariantId={Number(productId) === Number(chat?.productId) ? Number(chat?.variantId) || 0 : 0}
        shippingDestination={hasBuyerShipping ? buyerDestination : ''}
        onEditShipping={() => {
          setQtyOpen(false);
          setTimeout(() => setShippingEditOpen(true), Platform.OS === 'ios' ? 350 : 0);
        }}
        onCancel={() => setQtyOpen(false)}
        onSubmit={onSubmitQty}
      />
      <ChatInvoiceModal
        visible={invoiceOpen}
        sending={invoiceSending}
        destination={buyerDestination}
        itemAmount={
          Array.isArray(pendingRequest?.items) && pendingRequest.items.length > 1
            ? pendingRequest.items.reduce(
                (sum, row) =>
                  sum +
                  (Number(row.itemAmount ?? row.unitPrice) || 0) *
                    Math.max(1, Number(row.qty) || 1),
                0,
              )
            : Number(
                pendingRequest?.items?.[0]?.itemAmount ??
                  pendingRequest?.items?.[0]?.unitPrice ??
                  pendingRequest?.itemAmount,
              ) || itemAmount
        }
        lockedPrice={
          (Array.isArray(pendingRequest?.items) && pendingRequest.items.length > 0) ||
          Number(pendingRequest?.itemAmount) > 0
        }
        itemTitle={itemTitle}
        itemImage={itemImage}
        productId={productId}
        quantity={
          Array.isArray(pendingRequest?.items) && pendingRequest.items.length > 1
            ? 1
            : Math.max(
                1,
                Number(pendingRequest?.items?.[0]?.qty ?? pendingRequest?.qty) || 1,
              )
        }
        onCancel={() => setInvoiceOpen(false)}
        onSubmit={onSubmitInvoice}
      />
    </>
  );
}

const styles = StyleSheet.create({
  variantBox: {
    marginTop: 8,
    padding: 8,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#D7E8E2',
    backgroundColor: '#F3F8F6',
  },
  variantBoxTitle: { marginBottom: 4, fontSize: 12, fontWeight: '800', color: BRAND, letterSpacing: 0.3 },
  variantBoxLine: { fontSize: 14, lineHeight: 20, color: '#111111' },
  variantBoxLabel: { fontWeight: '700' },
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
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    elevation: 4,
    paddingBottom: 6
  },
  monitorNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: 0,
    marginTop: 0,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#FEF3C7',
  },
  monitorIcon: { marginRight: 8, marginTop: 1 },
  monitorText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
    color: '#92400E',
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
    alignItems: 'flex-end',
    gap: 8,
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
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D8D8D8',
    paddingLeft: 14,
    paddingRight: 8,
    minHeight: 48,
    maxHeight: 120,
  },
  input: {
    flex: 1,
    fontSize: 16,
    lineHeight: 20,
    color: BLACK,
    maxHeight: 100,
    minHeight: 40,
    paddingTop: Platform.OS === 'ios' ? 10 : 8,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  inlineIcon: {
    padding: 6,
    marginBottom: 2,
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: SEND_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
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
  headerActionAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: '#DC2626',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 4,
  },
  headerActionAlertText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  headerActionCardDisabled: { backgroundColor: '#F3F4F6', borderColor: '#E5E7EB' },
  headerActionCardHighlight: {
    borderColor: BRAND,
    backgroundColor: '#E8F8F2',
    borderWidth: 2,
  },
  headerActionCard: {
    marginHorizontal: 0,
    marginTop: 0,
    marginBottom: 0,
    minHeight: 72,
    backgroundColor: '#FFF8E8',
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: '#F0E4C8',
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  buyerTipWrap: {
    marginTop: 8,
    paddingHorizontal: 2,
  },
  buyerTipArrow: {
    alignSelf: 'center',
    width: 0,
    height: 0,
    marginBottom: -1,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: BRAND,
  },
  buyerTipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: BRAND,
    paddingHorizontal: 12,
    paddingVertical: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
      },
      android: { elevation: 3 },
    }),
  },
  buyerTipIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: BRAND,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  buyerTipCopy: {
    flex: 1,
    minWidth: 0,
  },
  buyerTipTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: BLACK,
  },
  buyerTipBody: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: MUTED,
  },
  buyerTipBtn: {
    alignSelf: 'flex-start',
    marginTop: 10,
    backgroundColor: BRAND,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  buyerTipBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  headerActionCopy: {
    flex: 1,
  },
  headerActionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: BLACK,
  },
  headerActionSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: MUTED,
  },
  invoiceOutdated: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  invoiceOutdatedText: { flex: 1, fontSize: 12, lineHeight: 16, color: '#B45309', fontWeight: '600' },
  invoiceCancelledText: { color: '#B91C1C' },
  invoicePaidText: { color: BRAND },
  requestKicker: { marginBottom: 8 },
  paidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: BRAND,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 8,
  },
  paidBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  paidProductRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  paidProductImage: { width: 52, height: 52, borderRadius: 8 },
  paidProductCopy: { flex: 1, minWidth: 0 },
  paidProductTitle: { fontSize: 15, fontWeight: '700', color: '#111' },
  paidProductMeta: { marginTop: 2, fontSize: 13, color: '#4B5563' },
  waTplActionDanger: { color: '#B91C1C' },
  invoiceBubble: {
    maxWidth: '84%',
    backgroundColor: '#FFFFFF',
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: '#D7E8E2',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  invoiceBubbleOut: {
    backgroundColor: '#E7F4EF',
  },
  invoiceKicker: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  invoiceLine: {
    marginTop: 3,
    fontSize: 13,
    color: BLACK,
  },
  invoiceFieldRow: {
    marginTop: 8,
  },
  invoiceFieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: MUTED,
    marginBottom: 2,
  },
  invoiceFieldValue: {
    fontSize: 15,
    lineHeight: 20,
    color: BLACK,
  },
  invoiceFieldValueStrong: {
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
  },
  invoiceMeta: {
    marginTop: 8,
    textAlign: 'right',
  },
  waTpl: {
    maxWidth: '84%',
    minWidth: 220,
    overflow: 'hidden',
  },
  waTplBody: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
  },
  waTplText: {
    fontSize: 16,
    lineHeight: 22,
    color: BLACK,
  },
  waTplLead: {
    fontWeight: '800',
    color: BLACK,
  },
  waTplTime: {
    marginTop: 6,
    textAlign: 'right',
  },
  waTplRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  waTplAction: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  waTplActionPrimary: {
    backgroundColor: BRAND,
    marginHorizontal: 10,
    marginVertical: 8,
    borderRadius: 10,
  },
  waTplActionText: {
    fontSize: 15,
    fontWeight: '700',
    color: BRAND,
  },
  waTplActionTextOnPrimary: {
    color: '#FFFFFF',
  },
  requestActionHint: {
    marginTop: 6,
    marginBottom: 8,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: '#047857',
  },
});
