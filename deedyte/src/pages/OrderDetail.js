import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatNaira } from '../utils/formatNaira';
import {
  fetchBuyerOrder,
  fetchOwnerShops,
  fetchShopOrderDetail,
  fetchShopOwner,
} from '../api';
import { useDispatch, useSelector } from 'react-redux';
import { getStoredUser } from '../auth/session';
import { connectChatSocket } from '../socket/chatSocket';
import { set_orderInfo } from '../../redux/order';
import {
  ESCROW_STATUS_THEME,
  STATUS_THEME,
  PAY_THEME,
  COLOR,
} from '../utils/statusTheme';
import { set_disputeInfo } from '../../redux/dispute';

function parseEventMeta(meta) {
  if (meta == null) return {};
  if (typeof meta === 'object')
    return /** @type {Record<string, unknown>} */ (meta);
  if (typeof meta === 'string') {
    try {
      const parsed = JSON.parse(meta);
      return parsed && typeof parsed === 'object'
        ? /** @type {Record<string, unknown>} */ (parsed)
        : {};
    } catch {
      return {};
    }
  }
  return {};
}

function initialsOf(name) {
  const parts = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '—';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function pickStr(obj, keys) {
  if (!obj || typeof obj !== 'object') return '';
  for (const k of keys) {
    const v = /** @type {Record<string, unknown>} */ (obj)[k];
    if (v == null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return '';
}

function parseShippingAddress(input) {
  let obj = null;

  if (input && typeof input === 'object') {
    obj = /** @type {Record<string, unknown>} */ (input);
  } else if (typeof input === 'string') {
    const s = input.trim();
    if (!s || s === '—') {
      return emptyAddress();
    }
    if (s.startsWith('{') || s.startsWith('[')) {
      try {
        const parsed = JSON.parse(s);
        if (parsed && typeof parsed === 'object') {
          obj = /** @type {Record<string, unknown>} */ (parsed);
        }
      } catch {
        /* fall through to plain string */
      }
    }
    if (!obj) {
      return { ...emptyAddress(), text: s };
    }
  } else {
    return emptyAddress();
  }

  // Some payloads wrap a flat string: { address: "..." }
  const flat = pickStr(obj, ['address', 'summary']);
  const recipient = pickStr(obj, ['fullName', 'name', 'recipient', 'receiver']);
  const phone = pickStr(obj, ['phone', 'phoneNumber', 'mobile']);
  const email = pickStr(obj, ['email']);
  const street = pickStr(obj, [
    'street',
    'address1',
    'addressLine1',
    'line1',
    'street1',
  ]);
  const street2 = pickStr(obj, [
    'address2',
    'addressLine2',
    'line2',
    'apartment',
    'suite',
  ]);
  const city = pickStr(obj, ['city', 'town', 'locality']);
  const state = pickStr(obj, ['state', 'region', 'province', 'stateName']);
  const zip = pickStr(obj, [
    'zip',
    'postalCode',
    'postcode',
    'zipcode',
    'postal_code',
  ]);
  const country = pickStr(obj, ['country', 'countryName']);

  const cityStateZip = [city, state, zip].filter(Boolean).join(', ');
  const lines = [street, street2, cityStateZip, country].filter(Boolean);
  const text = lines.length > 0 ? lines.join('\n') : flat || '—';

  return {
    recipient,
    phone,
    email,
    street,
    street2,
    city,
    state,
    zip,
    country,
    text,
  };
}

function emptyAddress() {
  return {
    recipient: '',
    phone: '',
    email: '',
    street: '',
    street2: '',
    city: '',
    state: '',
    zip: '',
    country: '',
    text: '—',
  };
}

function StatusPill({ theme, label }) {
  return (
    <View style={[styles.pill, { backgroundColor: theme.bg }]}>
      <View style={[styles.pillDot, { backgroundColor: theme.dot }]} />
      <Text style={[styles.pillText, { color: theme.text }]}>
        {label ?? theme.label}
      </Text>
    </View>
  );
}

function SectionLabel({ children }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

function SummaryRow({ icon, label, value, last }) {
  return (
    <View style={[styles.summaryRow, last && styles.summaryRowLast]}>
      <Icon
        name={icon}
        size={18}
        color={COLOR.MUTED}
        style={styles.summaryIcon}
      />
      <Text style={styles.summaryLabel}>{label}</Text>
      <View style={styles.summaryValue}>
        {typeof value === 'string' || typeof value === 'number' ? (
          <Text style={styles.summaryValueText} numberOfLines={1}>
            {String(value)}
          </Text>
        ) : (
          value
        )}
      </View>
    </View>
  );
}

function MoneyRow({ label, value, bold, muted }) {
  return (
    <View style={styles.moneyRow}>
      <Text style={[styles.moneyLabel, muted && styles.moneyLabelMuted]}>
        {label}
      </Text>
      <Text style={[styles.moneyValue, bold && styles.moneyValueBold]}>
        {value}
      </Text>
    </View>
  );
}

export default function OrderDetailScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const route = useRoute();
  const auth = useSelector(s => s.auth);
  const order = route.params?.order;
  const orderIdParam =
    route.params?.orderId ??
    route.params?.order_id ??
    order?.order_id ??
    order?.orderId ??
    order?.id ??
    null;
  const [statusKey, setStatusKey] = useState(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [cancelledModalOpen, setCancelledModalOpen] = useState(false);
  const [statusInfoOpen, setStatusInfoOpen] = useState(false);
  const { orderInfo } = useSelector(s => s.orderInfo);
  const dispatch = useDispatch();

  useEffect(() => {
    connectChatSocket();
  }, []);

  const isOrderCancelled = statusKey === 'order_cancelled';

  const cancellationDetails = useMemo(() => {
    if (!isOrderCancelled) return null;

    const events = Array.isArray(orderInfo?.order_events)
      ? orderInfo.order_events
      : [];
    const cancelEvent = [...events].reverse().find(e => {
      const stage = String(e?.stage ?? '').toLowerCase();
      const type = String(e?.event_type ?? '').toLowerCase();
      return (
        stage === 'order_cancelled' ||
        type === 'cancellation' ||
        stage.includes('cancel')
      );
    });

    const meta = parseEventMeta(cancelEvent?.meta);
    const actor = String(cancelEvent?.actor_type ?? '').toLowerCase();
    const cancelledBy =
      meta.cancelled_by === 'vendor' || meta.cancelled_by === 'customer'
        ? String(meta.cancelled_by)
        : actor === 'vendor' || actor === 'customer'
          ? actor
          : null;

    const reason =
      meta.reason != null && String(meta.reason).trim()
        ? String(meta.reason).trim()
        : cancelEvent?.notes != null && String(cancelEvent.notes).trim()
          ? String(cancelEvent.notes).trim()
          : null;

    let message;
    if (cancelledBy === 'customer') {
      message =
        auth.activeRole === 'customer'
          ? 'You cancelled this order. No further actions are available.'
          : 'The buyer cancelled this order. No further actions are available.';
    } else if (cancelledBy === 'vendor') {
      message =
        auth.activeRole === 'vendor'
          ? 'You cancelled this order. No further actions are available.'
          : 'The vendor cancelled this order. No further actions are available.';
    } else {
      message =
        'This order has been cancelled. No further actions are available.';
    }

    return { cancelledBy, message, reason };
  }, [auth.activeRole, isOrderCancelled, orderInfo?.order_events]);

  const showCancelledModal = useCallback(() => {
    setCancelledModalOpen(true);
  }, []);

  const blockIfCancelled = useCallback(() => {
    if (!isOrderCancelled) return false;
    showCancelledModal();
    return true;
  }, [isOrderCancelled, showCancelledModal]);

  const openActions = useCallback(() => {
    if (blockIfCancelled()) return;
    setActionsOpen(true);
  }, [blockIfCancelled]);
  const closeActions = useCallback(() => setActionsOpen(false), []);

  const orderNumber = useMemo(() => {
    const n = order?.orderId ?? order?.order_id ?? '';
    return String(n).replace(/^ORD-/i, '');
  }, [order]);

  useEffect(() => {
    if (!orderInfo) return;
    setStatusKey(orderInfo?.order?.fulfillment_status);
  }, [orderInfo]);

  useEffect(() => {
    if (orderIdParam == null || orderIdParam === '') return;

    const loadedId =
      orderInfo?.order?.id ??
      orderInfo?.order?.order_id ??
      null;
    const sameOrderLoaded =
      loadedId != null && String(loadedId) === String(orderIdParam);

    if (!sameOrderLoaded) {
      dispatch(set_orderInfo(null));
    }

    if (auth.activeRole === 'customer') {
      (async () => {
        await connectChatSocket();
        fetchBuyerOrder(orderIdParam)
          .then(({ order: detail }) => {
            dispatch(set_orderInfo(detail));
          })
          .catch(err => console.log(err));
      })();
    } else {
      (async () => {
        await connectChatSocket();
        let { id: userId } = await getStoredUser();
        let shop = await fetchOwnerShops(userId);
        let sid = shop[0].id;
        fetchShopOrderDetail(sid, orderIdParam, userId)
          .then(({ order: detail }) => {
            dispatch(set_orderInfo(detail));
          })
          .catch(err => console.log(err));
      })();
    }
  }, [orderIdParam, auth.activeRole, dispatch]);

  const payKey = String(order?.paymentStatus ?? 'paid').toLowerCase();
  const payTheme = PAY_THEME[payKey] ?? PAY_THEME.paid;

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <Pressable
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          onPress={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
              return;
            }
            navigation.navigate('Activities');
          }}
          style={({ pressed }) => [
            styles.headerBackButton,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Icon name="chevron-back" size={24} color={COLOR.TEXT} />
        </Pressable>
      ),
      headerTitle: () => (
        <View
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontWeight: 700, fontSize: 18 }}>
            Order #{orderNumber}
          </Text>
          <StatusPill theme={payTheme} />
        </View>
      ),
      headerRight: () => (
        <Pressable
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          onPress={openActions}
          style={({ pressed }) => [
            styles.headerEllipsis,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="More order actions"
        >
          <Icon name="ellipsis-horizontal" size={22} color={COLOR.TEXT} />
        </Pressable>
      ),
    });
  }, [navigation, orderNumber, openActions, payTheme]);
  const statusTheme =
    STATUS_THEME[orderInfo?.order?.fulfillment_status] ?? 'Not Available';
  const isNaira = order && 'valueRupees' in order;
  const fmt = useCallback(
    n => {
      if (typeof n === 'string') return n;
      if (!Number.isFinite(Number(n))) return '—';
      if (isNaira) return formatNaira(Number(n));
      return `₦${Number(n).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    },
    [isNaira],
  );

  const escrowInfo = useMemo(() => {
    const raw = orderInfo?.order?.escrow_status;
    const key = String(raw ?? 'held')
      .trim()
      .toLowerCase();
    let theme;
    if (key === 'held' || key === 'released' || key === 'refunded') {
      theme = ESCROW_STATUS_THEME[key];
    } else {
      theme = {
        ...ESCROW_STATUS_THEME.held,
        label:
          raw != null && String(raw).trim()
            ? String(raw).trim().replace(/_/g, ' ')
            : '—',
        caption: 'Escrow status for this order.',
      };
    }
    const amountLabel =
      key === 'released'
        ? 'Amount released'
        : key === 'refunded'
          ? 'Amount refunded'
          : key === 'held'
            ? 'Amount held'
            : 'Escrow amount';
    const rawTotal =
      orderInfo?.order?.total_paid ?? orderInfo?.order?.amount_paid;
    const num = Number(rawTotal);
    const valueText = Number.isFinite(num) ? fmt(num) : '—';
    const cur = orderInfo?.order?.currency;
    const suffix =
      cur != null && String(cur).trim() ? ` ${String(cur).trim()}` : '';
    return { theme, amountLabel, amountValue: `${valueText}${suffix}` };
  }, [
    fmt,
    orderInfo?.order?.escrow_status,
    orderInfo?.order?.total_paid,
    orderInfo?.order?.amount_paid,
    orderInfo?.order?.currency,
  ]);

  /** Vendor: delivery address from order + user. Customer: shop premises from {@link orderInfo.shop.location}. */
  const displayShipping = useMemo(() => {
    if (auth.activeRole === 'vendor') {
      const raw =
        orderInfo?.order?.shipping_address ??
        orderInfo?.payment_info?.metadata?.shipping_address ??
        '';
      let parsed = parseShippingAddress(raw);
      const loc = orderInfo?.user?.location || orderInfo?.customer?.location;
      if (loc && typeof loc === 'object') {
        parsed = {
          ...parsed,
          city: parsed.city || pickStr(loc, ['city']),
          state: parsed.state || pickStr(loc, ['state']),
          zip:
            parsed.zip ||
            pickStr(loc, ['zipcode', 'zip', 'postalCode', 'postcode']),
          country: parsed.country || pickStr(loc, ['country', 'countryName']),
        };
      }
      if (
        !parsed.street &&
        !parsed.street2 &&
        parsed.text &&
        parsed.text !== '—'
      ) {
        return { ...parsed, street: parsed.text };
      }
      return parsed;
    }

    if (auth.activeRole !== 'customer') {
      return emptyAddress();
    }

    /** @type {unknown} */
    let locRaw = orderInfo?.shop?.location;
    if (typeof locRaw === 'string') {
      const s = locRaw.trim();
      if (!s) {
        locRaw = null;
      } else if (s.startsWith('{')) {
        try {
          const parsed = JSON.parse(s);
          locRaw = parsed && typeof parsed === 'object' ? parsed : null;
        } catch {
          locRaw = null;
        }
      } else {
        locRaw = { address: s };
      }
    }

    const loc =
      locRaw && typeof locRaw === 'object'
        ? /** @type {Record<string, unknown>} */ (locRaw)
        : null;
    if (!loc) {
      return emptyAddress();
    }
    const street = pickStr(loc, ['address', 'street', 'line1', 'addressLine1']);
    const street2 = pickStr(loc, [
      'address2',
      'street2',
      'line2',
      'addressLine2',
    ]);
    const city = pickStr(loc, ['city', 'town', 'locality']);
    const state = pickStr(loc, ['state', 'region', 'province', 'stateName']);
    const zip = pickStr(loc, ['zipcode', 'zip', 'postalCode', 'postcode']);
    const country = pickStr(loc, ['country', 'countryName']);
    const cityStateZip = [city, state, zip].filter(Boolean).join(', ');
    const lines = [street, street2, cityStateZip, country].filter(Boolean);
    const text = lines.length > 0 ? lines.join('\n') : '—';
    return {
      ...emptyAddress(),
      street,
      street2,
      city,
      state,
      zip,
      country,
      text,
    };
  }, [orderInfo, auth.activeRole]);

  const counterpartEmail = useMemo(() => {
    if (auth.activeRole === 'vendor') {
      const u = orderInfo?.user;
      if (u && typeof u === 'object') {
        const e = pickStr(/** @type {Record<string, unknown>} */(u), [
          'email',
        ]);
        if (e) return e;
      }
      const pe = orderInfo?.payment_info?.customer_email;
      if (pe != null && String(pe).trim()) return String(pe).trim();
      return '';
    }
    if (auth.activeRole === 'customer') {
      const s = orderInfo?.shop;
      if (s && typeof s === 'object') {
        const so = /** @type {Record<string, unknown>} */ (s);
        const e1 = pickStr(so, ['contactemail', 'contactEmail', 'email']);
        if (e1) return e1;
        const owner = so.owner;
        if (owner && typeof owner === 'object') {
          const e2 = pickStr(/** @type {Record<string, unknown>} */(owner), [
            'email',
          ]);
          if (e2) return e2;
        }
      }
      return '';
    }
    return '';
  }, [orderInfo, auth.activeRole]);


  const onMail = () => {
    console.log('counterpartEmail:', orderInfo);
    if (blockIfCancelled()) return;
    navigation.navigate('Inbox', {
      chat: { roomId: orderInfo.room.id, name: `Order #${orderInfo.order.id}` }
    });
  };

  const onDownloadInvoice = () => {
    if (blockIfCancelled()) return;
    Alert.alert(
      'Download invoice',
      'Invoice will be generated and downloaded.',
    );
  };

  const onRefund = () => {
    if (blockIfCancelled()) return;
    Alert.alert('Refund order', `Refund order #${orderNumber}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Refund', style: 'destructive', onPress: () => { } },
    ]);
  };

  const onCancelDelivery = useCallback(async () => {
    if (!statusKey) return;
    if (statusKey === 'order_delivered') {
      Alert.alert(
        'Cannot cancel order after delivery',
        'This order has already been delivered. If there is an issue with the item, please raise a dispute instead.',
        [
          {
            text: 'Close',
            style: 'cancel',
          },
          !orderInfo?.dispute && {
            text: 'Raise Dispute',
            onPress: () => {
              navigation.navigate('Open-dispute', {
                orderId: order.id,
              });
            },
          },
        ],
      );
      return;
    }
    if (blockIfCancelled()) return;
    if (!orderInfo?.order) return;

    if (auth.activeRole === 'customer') {
      const u = await getStoredUser();
      const owners = await fetchShopOwner(orderInfo.order.shop_id);
      const vendorId = owners[0]?.id;
      if (vendorId == null) {
        Alert.alert(
          'Cannot cancel',
          'Unable to load the vendor for this order. Try again later.',
        );
        return;
      }

      const totalPaid = Number(
        orderInfo.order.total_paid ?? orderInfo.order.amount_paid ?? 0,
      );
      const postShipment = (orderInfo.order_events?.length ?? 0) > 3;
      const restockingFee = orderInfo.order.shipping_fee;

      navigation.navigate('Order-action', {
        action: 'cancellation',
        data: {
          order_id: orderInfo.order.id,
          event_type: 'cancellation',
          stage: 'order_cancelled',
          actor_type: 'customer',
          actor_id: u.id,
          outcome: 'success',
          notes: '',
          recipient: vendorId,
          post_shipment: true,
          order_total: totalPaid,
          restocking_fee: restockingFee,
        },
      });
    } else {
      const u = await getStoredUser();

      navigation.navigate('Order-action', {
        action: 'cancellation',
        data: {
          order_id: orderInfo.order.id,
          event_type: 'cancellation',
          stage: 'order_cancelled',
          actor_type: 'vendor',
          actor_id: u.id,
          outcome: 'success',
          notes: '',
          recipient: orderInfo.order.customer_id,
        },
      });
    }
  }, [
    auth.activeRole,
    blockIfCancelled,
    navigation,
    order.id,
    orderInfo,
    statusKey,
  ]);

  const onOpenDispute = useCallback(async () => {
    if (orderInfo?.dispute) {
      const [vendor] = await fetchShopOwner(orderInfo.shop.id);
      console.log('vendor:', vendor);
      dispatch(
        set_disputeInfo({
          ...orderInfo.dispute,
          order: orderInfo.order,
          vendor,
          customer: orderInfo.customer,
          order_event: orderInfo.order_event,
          order_items: orderInfo.order_items,
        }),
      );
      // Alert.alert(JSON.stringify(orderInfo.dispute));
      navigation.navigate('Dispute-detail', {
        dispute: orderInfo.dispute,
        disputeId: orderInfo.dispute.id,
      });
      return;
    }
    if (blockIfCancelled()) return;
    if (auth.activeRole === 'customer') {
      if (statusKey !== 'order_delivered') {
        Alert.alert(
          'Cannot open dispute at this stage',
          'To dispute this order, you must confirm you received the order from the vendor first',
          [{ text: 'OK' }],
        );
      } else if (statusKey === 'order_delivered') {
        const oid =
          orderInfo?.order?.id ??
          orderInfo?.order?.order_id ??
          order?.orderId ??
          order?.order_id;
        navigation.navigate('Open-dispute', { orderId: oid });
      }
    } else {
      if (statusKey !== 'order_delivered') {
        Alert.alert(
          'Cannot open dispute at this stage',
          'To dispute this order, the buyer must confirm he/she received the order from   you (vendor) first',
          [{ text: 'OK' }],
        );
      } else if (statusKey === 'order_delivered') {
        Alert.alert(
          'Buyer dispute',
          'Disputes are opened by the buyer from their account after delivery is confirmed.',
          [{ text: 'OK' }],
        );
      }
    }
  }, [
    auth.activeRole,
    blockIfCancelled,
    navigation,
    order,
    orderInfo,
    statusKey,
  ]);

  const onUpdateStatus = async () => {
    if (blockIfCancelled()) return;
    if (!orderInfo?.order) return;
    if (statusKey === 'order_disputed') {
      const [vendor] = await fetchShopOwner(orderInfo.shop.id);
      console.log('vendor:', vendor);
      dispatch(
        set_disputeInfo({
          ...orderInfo.dispute,
          order: orderInfo.order,
          vendor,
          customer: orderInfo.customer,
          order_event: orderInfo.order_event,
          order_items: orderInfo.order_items,
        }),
      );
      // Alert.alert(JSON.stringify(orderInfo.dispute));
      navigation.navigate('Dispute-detail', {
        dispute: orderInfo.dispute,
        disputeId: orderInfo.dispute.id,
      });
      return;
    }
    const u = await getStoredUser();
    const base = {
      order_id: orderInfo.order.id,
      actor_type: 'vendor',
      actor_id: u.id,
      outcome: 'pending',
      notes: '',
      recipient:
        auth.activeRole === 'vendor'
          ? orderInfo?.order?.customer_id
          : orderInfo?.shop?.ownerid,
      meta: {},
    };

    if (auth.activeRole === 'vendor') {
      if (statusKey === 'order_accepted') {
        navigation.navigate('Order-action', {
          action: 'processing',
          data: {
            ...base,
            event_type: 'processing',
            stage: 'order_processing',
          },
        });
        return;
      }

      if (statusKey === 'order_processing') {
        navigation.navigate('Order-action', {
          action: 'shipping',
          data: {
            ...base,
            event_type: 'shipping',
            stage: 'order_shipping',
          },
        });
        return;
      }

      if (statusKey === 'order_shipping') {
        navigation.navigate('Order-action', {
          action: 'out_for_delivery',
          data: {
            ...base,
            event_type: 'delivery',
            stage: 'order_out_for_delivery',
          },
        });
        return;
      }

      if (statusKey === 'order_out_for_delivery') {
        navigation.navigate('Order-action', {
          action: 'delivered',
          data: {
            ...base,
            event_type: 'delivered',
            stage: 'order_delivered',
          },
        });
      }
    } else {
      if (statusKey === 'order_delivered') {
        navigation.navigate('Order-action', {
          action: 'confirmation',
          data: {
            ...base,
            recipient: orderInfo?.shop?.ownerid,
            actor_type: 'customer',
            event_type: 'confirmation',
            stage: 'order_confirmed',
          },
        });
        return;
      }
    }
  };

  const ORDER_ACTIONS = [
    {
      key: 'Message',
      label:
        auth.activeRole === 'vendor' ? 'Message customer' : 'Message vendor',
      icon: 'mail-outline',
      onPress: () => {
        closeActions();
        onMail();
      },
    },
    // {
    //   key: 'status',
    //   label: 'Update status',
    //   icon: 'refresh-outline',
    //   onPress: () => {
    //     closeActions();
    //     onUpdateStatus();
    //   },
    // },
    // {
    //   key: 'invoice',
    //   label: 'Download invoice',
    //   icon: 'download-outline',
    //   onPress: () => {
    //     closeActions();
    //     onDownloadInvoice();
    //   },
    // },
    // {
    //   key: 'refund',
    //   label: 'Refund order',
    //   icon: 'return-up-back-outline',
    //   onPress: () => {
    //     closeActions();
    //     onRefund();
    //   },
    //   destructive: true,
    // },
    ...(auth.activeRole === 'vendor' &&
      orderInfo?.order_events?.length > 1 &&
      !isOrderCancelled
      ? [
        {
          key: 'cancel-order',
          label: 'Cancel order',
          icon: 'close-circle-outline',
          onPress: () => {
            closeActions();
            onCancelDelivery();
          },
          destructive: true,
        },
      ]
      : []),
  ];

  if (orderInfo === null) {
    return (
      <>
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ActivityIndicator color={'#0D8A4A'} size={'large'} />
        </View>
      </>
    );
  }

  const actionBtn = () => {
    // return (
    //   (auth.activeRole === 'vendor')
    //     ? statusKey === 'order_accepted'
    //       ? 'Start Processing Order'
    //       : statusKey === 'order_processing'
    //       ? 'Start Shipping Order'
    //       : statusKey === 'order_shipping'
    //       ? 'Notify Buyer For Pickup'
    //       : statusKey === 'order_out_for_delivery'
    //       ? 'Confirm Buyer Has Received The Order'
    //       : statusKey === 'order_confirmed' ? 'Your payout will be processed within 48 hours.'
    //       : "Awaiting Buyer's Confirmation"
    //     :
    //   (auth.activeRole === 'customer')
    //   ? 'Confirm delivery' : ''
    // );

    let message;
    if (auth.activeRole === 'vendor') {
      switch (statusKey) {
        case 'order_accepted':
          message = 'Start processing';
          break;
        case 'order_processing':
          message = 'Start shipping';
          break;
        case 'order_shipping':
          message = 'Ready for pickup';
          break;
        case 'order_out_for_delivery':
          message = 'Confirm delivery';
          break;
        case 'order_confirmed':
          message = 'Payment pending';
          break;
        case 'order_cancelled':
          message = 'Order cancelled';
          break;
        case 'order_rejected':
          message = 'Order rejected';
          break;
        case 'order_delivered':
          message = 'Awaiting review';
          break;
        default:
          message = 'Awaiting review';
      }
    } else {
      switch (statusKey) {
        case 'order_accepted':
          message = 'Processing order';
          break;
        case 'order_processing':
          message = 'Shipping in progress';
          break;
        case 'order_shipping':
          message = 'Order shipped';
          break;
        case 'order_out_for_delivery':
          message = 'Out for delivery';
          break;
        case 'order_confirmed':
          message = 'Payment releasing';
          break;
        case 'order_cancelled':
          message = 'Order cancelled';
          break;
        case 'order_rejected':
          message = 'Order rejected';
          break;
        default:
          message = 'Confirm delivery';
      }
    }

    return message;
  };

  return (
    <View style={[styles.root, { paddingTop: 0 }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 110 + Math.max(insets.bottom, 16) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <SectionLabel>Order Summary</SectionLabel>
          <SummaryRow
            icon="time-outline"
            label="Order Date"
            value={new Date(orderInfo?.order?.created_at).toLocaleString()}
          />
          <SummaryRow
            icon="checkmark-circle-outline"
            label="Order Status"
            value={<StatusPill theme={statusTheme} />}
          />
          <SummaryRow
            icon="location-outline"
            label="Shipping Address"
            value={String(orderInfo?.order?.shipping_address)}
          />

          <SummaryRow
            icon="cube-outline"
            label="Shipping Method"
            value={String(
              orderInfo?.order?.shipping_method?.split('_').join(' ') ||
              'Awaiting shipment',
            )}
          />
          <SummaryRow
            icon="calendar-outline"
            label="Estimated Delivery Date"
            value={String(
              orderInfo?.order?.estimated_delivery_date?.split('_').join(' ') ||
              'Not Available',
            )}
          />
          <SummaryRow
            icon="pricetag-outline"
            label="Tracking Number"
            value={String(
              orderInfo?.order?.tracking_number || 'Awaiting shipment',
            )}
            last
          />
        </View>

        {orderInfo?.order_events?.length > 1 && (
          <View style={styles.card}>
            <SectionLabel>Escrow summary</SectionLabel>
            <View style={styles.escrowStatusRow}>
              <Text style={styles.escrowStatusLabel}>Escrow status</Text>
              <StatusPill theme={escrowInfo.theme} />
            </View>
            <View style={styles.escrowAmountRow}>
              <Text style={styles.escrowAmountLabel}>
                {escrowInfo.amountLabel}
              </Text>
              <Text style={styles.escrowAmountValue}>
                {escrowInfo.amountValue}
              </Text>
            </View>
            <Text style={styles.escrowCaption}>{escrowInfo.theme.caption}</Text>
            {isOrderCancelled ? (
              <View style={styles.cancelledBanner}>
                <Icon name="close-circle-outline" size={20} color="#C62828" />
                <Text style={styles.cancelledBannerText}>
                  {cancellationDetails?.message ??
                    'This order has been cancelled.'}
                </Text>
              </View>
            ) : null}
            {!isOrderCancelled &&
              statusKey !== 'order_confirmed' &&
              statusKey !== 'order_rejected' ? (
              <View style={styles.escrowActions}>
                {statusKey !== 'order_disputed' && (
                  <Pressable
                    onPress={onCancelDelivery}
                    style={({ pressed }) => [
                      styles.escrowBtn,
                      styles.escrowBtnCancel,
                      pressed && styles.pressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Cancel delivery"
                  >
                    <Text style={styles.escrowBtnCancelText}>Cancel order</Text>
                  </Pressable>
                )}
                <Pressable
                  onPress={onOpenDispute}
                  style={({ pressed }) => [
                    styles.escrowBtn,
                    styles.escrowBtnSecondary,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Open dispute"
                >
                  <Text style={styles.escrowBtnSecondaryText}>
                    {orderInfo?.dispute ? 'View dispute' : 'Open dispute'}
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        )}

        <View style={styles.card}>
          <SectionLabel>
            {auth.activeRole === 'vendor' ? 'Customer Info' : 'Shop detail'}
          </SectionLabel>
          {auth.activeRole === 'vendor' && (
            <View style={styles.customerHead}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {initialsOf(
                    `${orderInfo?.user?.fname || orderInfo?.customer?.fname} ${orderInfo?.user?.lname || orderInfo?.customer?.lname
                    }`,
                  )}
                </Text>
              </View>
              <View style={styles.customerTitleRow}>
                <View style={styles.customerNameCol}>
                  <Text style={styles.customerName} numberOfLines={1}>
                    {`${orderInfo?.user?.fname || orderInfo?.customer?.fname} ${orderInfo?.user?.lname || orderInfo?.customer?.lname
                      }`}
                  </Text>
                </View>
                <Pressable
                  onPress={onMail}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={({ pressed }) => [
                    styles.headMessageBtn,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Message customer"
                >
                  <Icon
                    name="mail-outline"
                    size={22}
                    color={COLOR.BRAND_COLOR}
                  />
                </Pressable>
              </View>
            </View>
          )}
          {auth.activeRole !== 'vendor' && (
            <View style={styles.customerHead}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {initialsOf(`${orderInfo?.shop?.name}`)}
                </Text>
              </View>
              <View style={styles.customerTitleRow}>
                <View style={styles.customerNameCol}>
                  <Text style={styles.customerName} numberOfLines={1}>
                    {`${orderInfo?.shop?.name}`}
                  </Text>
                </View>
                <Pressable
                  onPress={onMail}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={({ pressed }) => [
                    styles.headMessageBtn,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Message vendor"
                >
                  <Icon
                    name="mail-outline"
                    size={22}
                    color={COLOR.BRAND_COLOR}
                  />
                </Pressable>
              </View>
            </View>
          )}

          <View style={styles.shippingBlock}>
            <Text style={styles.shippingHeader}>
              {auth.activeRole === 'vendor'
                ? 'Shipping address'
                : 'Shop location'}
            </Text>

            {[displayShipping.street, displayShipping.street2]
              .filter(Boolean)
              .join('\n') ? (
              <View style={[styles.kvRow, styles.kvRowAlignTop]}>
                <Text style={styles.kvLabel}>Street</Text>
                <Text style={[styles.kvValue, styles.kvAddress]}>
                  {[displayShipping.street, displayShipping.street2]
                    .filter(Boolean)
                    .join('\n')}
                </Text>
              </View>
            ) : null}

            {displayShipping.city ? (
              <View style={styles.kvRow}>
                <Text style={styles.kvLabel}>City</Text>
                <Text style={styles.kvValue} numberOfLines={1}>
                  {displayShipping.city}
                </Text>
              </View>
            ) : null}
            {displayShipping.state ? (
              <View style={styles.kvRow}>
                <Text style={styles.kvLabel}>State</Text>
                <Text style={styles.kvValue} numberOfLines={1}>
                  {displayShipping.state}
                </Text>
              </View>
            ) : null}
            {displayShipping.zip ? (
              <View style={styles.kvRow}>
                <Text style={styles.kvLabel}>ZIP / Postal</Text>
                <Text style={styles.kvValue} numberOfLines={1}>
                  {displayShipping.zip}
                </Text>
              </View>
            ) : null}
            {displayShipping.country ? (
              <View style={styles.kvRow}>
                <Text style={styles.kvLabel}>Country</Text>
                <Text style={styles.kvValue} numberOfLines={1}>
                  {displayShipping.country}
                </Text>
              </View>
            ) : null}
            {!displayShipping.street &&
              !displayShipping.street2 &&
              !displayShipping.city &&
              !displayShipping.state &&
              !displayShipping.country &&
              !displayShipping.zip ? (
              <View style={[styles.kvRow, styles.kvRowAlignTop]}>
                <Text style={styles.kvLabel}>Address</Text>
                <Text style={[styles.kvValue, styles.kvAddress]}>
                  {displayShipping.text}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* <SectionLabel>Items</SectionLabel> */}
        <View style={styles.card}>
          {Array.isArray(orderInfo?.order_items) &&
            orderInfo.order_items.map((it, i) => (
              <View
                key={String(it.id ?? i)}
                style={[
                  styles.itemRow,
                  i === orderInfo.order_items.length - 1 && styles.itemRowLast,
                ]}
              >
                <View style={styles.itemThumb}>
                  {it.product.thumbnail_url ? (
                    <Image
                      source={{ uri: String(it.product.thumbnail_url) }}
                      style={styles.itemImg}
                    />
                  ) : (
                    <Icon
                      name="phone-portrait-outline"
                      size={26}
                      color="#5C5C66"
                    />
                  )}
                </View>
                <View style={styles.itemBody}>
                  <Text style={styles.itemName} numberOfLines={2}>
                    {String(it?.product?.name ?? '—')}
                  </Text>
                  {/* {it.variant ? (
                  <Text style={styles.itemVariant} numberOfLines={1}>
                    {String(it.product.specifications.variants.map(item => item))}
                  </Text>
                ) : null} */}
                </View>
                <View style={styles.itemRight}>
                  <View style={styles.qtyChip}>
                    <Text style={styles.qtyChipLabel}>Quantity</Text>
                    <Text style={styles.qtyChipValue}>
                      {Number(it.units ?? 1)}
                    </Text>
                  </View>
                  <Text style={styles.itemPrice}>
                    {fmt(Number(it.unit_price ?? 0) * Number(it.qty ?? 1))}
                  </Text>
                </View>
              </View>
            ))}
        </View>

        <View style={styles.card}>
          <SectionLabel>Payment</SectionLabel>

          <MoneyRow
            label="Subtotal"
            value={
              Array.isArray(orderInfo?.order_items) &&
              orderInfo?.order_items?.reduce(
                (acc, curr) => acc + parseInt(curr.total_price),
                0,
              )
            }
            muted
          />
          <MoneyRow label="Discount" value={fmt(0)} muted />
          <MoneyRow
            label="Shipping Cost"
            value={
              orderInfo?.order?.shipping_fee &&
              fmt(orderInfo.order.shipping_fee)
            }
            muted
          />
          <MoneyRow label="Tax" value={fmt(0)} muted />
          <View style={styles.moneyDivider} />
          <MoneyRow
            label="Total"
            value={fmt(
              orderInfo?.order?.shipping_fee &&
              orderInfo.order_items.reduce(
                (acc, curr) => acc + parseInt(curr.total_price),
                0,
              ) + Number(orderInfo?.order?.shipping_fee || 0),
            )}
            bold
          />
        </View>
      </ScrollView>

      <View
        style={[
          styles.actionBar,
          { paddingBottom: Math.max(insets.bottom, 12) },
        ]}
      >
        {!isOrderCancelled &&
          orderInfo?.order_events?.length === 1 &&
          auth.activeRole === 'vendor' && (
            <>
              <Pressable
                // onPress={onRefund}
                onPress={e => {
                  if (blockIfCancelled()) return;
                  const u = getStoredUser();
                  navigation.navigate('Order-action', {
                    action: 'acceptance',
                    data: {
                      order_id: orderInfo.order.id,
                      shipping_address: orderInfo.order.shipping_address,
                      event_type: 'acceptance',
                      stage: 'order_accepted',
                      actor_type: 'vendor',
                      actor_id: u.id,
                      outcome: 'success',
                      notes: '',
                      recipient: orderInfo.order.customer_id,
                      meta: {},
                    },
                  });
                }}
                style={({ pressed }) => [
                  styles.btnAccept,
                  pressed && styles.btnAcceptPressed,
                ]}
              >
                <Text style={styles.btnAcceptText}>Accept</Text>
              </Pressable>

              <Pressable
                // onPress={onResendInvoice}
                onPress={e => {
                  if (blockIfCancelled()) return;
                  const u = getStoredUser();
                  navigation.navigate('Order-action', {
                    action: 'acceptance',
                    data: {
                      order_id: orderInfo.order.id,
                      event_type: 'acceptance',
                      stage: 'order_rejected',
                      actor_type: 'vendor',
                      actor_id: u.id,
                      outcome: 'failure',
                      notes: '',
                      recipient: orderInfo.order.customer_id,
                      meta: {},
                    },
                  });
                }}
                style={({ pressed }) => [
                  styles.btnReject,
                  pressed && styles.btnRejectPressed,
                ]}
              >
                <Text style={styles.btnRejectText}>Reject</Text>
              </Pressable>
            </>
          )}
        {orderInfo?.order_events?.length > 1 &&
          (statusKey !== 'order_delivered' &&
            statusKey !== 'order_disputed' &&
            auth.activeRole === 'customer' ? (
            ''
          ) : (
            <Pressable
              onPress={() => {
                if (blockIfCancelled()) return;
                // Terminal / waiting statuses — explain instead of navigating.
                if (
                  auth.activeRole === 'vendor' &&
                  (statusKey === 'order_delivered' ||
                    statusKey === 'order_confirmed' ||
                    statusKey === 'order_cancelled' ||
                    statusKey === 'order_rejected')
                ) {
                  setStatusInfoOpen(true);
                  return;
                }
                if (
                  auth.activeRole === 'customer' &&
                  (statusKey === 'order_confirmed' ||
                    statusKey === 'order_cancelled' ||
                    statusKey === 'order_rejected')
                ) {
                  setStatusInfoOpen(true);
                  return;
                }
                onUpdateStatus();
              }}
              style={({ pressed }) => [
                styles.btnPrimary,
                pressed && styles.btnPrimaryPressed,
                {
                  backgroundColor: STATUS_THEME[statusKey]?.dot,
                },
              ]}
            >
              <Text style={styles.btnPrimaryText} numberOfLines={1}>
                {statusKey === 'order_disputed'
                  ? 'View dispute'
                  : actionBtn()}
              </Text>
            </Pressable>
          ))}

        {auth.activeRole === 'customer' &&
          statusKey !== 'order_delivered' &&
          statusKey !== 'order_disputed' ? (
          <Pressable
            onPress={e => {
              if (blockIfCancelled()) return;
              setStatusInfoOpen(true);
            }}
            style={({ pressed }) => [
              styles.btnPrimary,
              pressed && styles.btnPrimaryPressed,
              {
                backgroundColor: STATUS_THEME[statusKey]?.dot,
              },
            ]}
          >
            <Text
              style={styles.btnPrimaryText}
              numberOfLines={1}
            >
              {statusKey === 'payment_received'
                ? 'Awaiting approval'
                : actionBtn()}
            </Text>
          </Pressable>
        ) : (
          ''
        )}
      </View>

      <Modal
        visible={actionsOpen}
        transparent
        animationType="slide"
        onRequestClose={closeActions}
      >
        <View style={styles.sheetRoot}>
          <Pressable style={styles.sheetDismiss} onPress={closeActions} />
          <View
            style={[
              styles.sheet,
              { paddingBottom: Math.max(insets.bottom, 16) + 8 },
            ]}
          >
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Order actions</Text>
            {ORDER_ACTIONS.map(action => (
              <Pressable
                key={action.key}
                onPress={() => {
                  if (blockIfCancelled()) return;
                  action.onPress();
                }}
                style={({ pressed }) => [
                  styles.sheetRow,
                  pressed && styles.sheetRowPressed,
                ]}
              >
                <Icon
                  name={action.icon}
                  size={22}
                  color={action.destructive ? '#C62828' : COLOR.TEXT}
                  style={styles.sheetRowIcon}
                />
                <Text
                  style={[
                    styles.sheetRowText,
                    action.destructive && styles.sheetRowTextDestructive,
                  ]}
                >
                  {action.label}
                </Text>
              </Pressable>
            ))}
            <Pressable
              onPress={closeActions}
              style={({ pressed }) => [
                styles.sheetCloseRow,
                pressed && styles.sheetRowPressed,
              ]}
            >
              <Text style={styles.sheetCloseText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={cancelledModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCancelledModalOpen(false)}
      >
        <View style={styles.cancelledModalRoot}>
          <Pressable
            style={styles.sheetDismiss}
            onPress={() => setCancelledModalOpen(false)}
          />
          <View style={styles.cancelledModalCard}>
            <Icon name="close-circle-outline" size={44} color="#C62828" />
            <Text style={styles.cancelledModalTitle}>Order cancelled</Text>
            <Text style={styles.cancelledModalBody}>
              {cancellationDetails?.message ??
                'This order has been cancelled. No further actions are available.'}
            </Text>
            {cancellationDetails?.reason ? (
              <Text style={styles.cancelledModalReason}>
                Reason: {cancellationDetails.reason}
              </Text>
            ) : null}
            <Pressable
              onPress={() => setCancelledModalOpen(false)}
              style={({ pressed }) => [
                styles.cancelledModalBtn,
                pressed && styles.btnPrimaryPressed,
              ]}
            >
              <Text style={styles.cancelledModalBtnText}>OK</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={statusInfoOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setStatusInfoOpen(false)}
      >
        <View style={styles.cancelledModalRoot}>
          <Pressable
            style={styles.sheetDismiss}
            onPress={() => setStatusInfoOpen(false)}
          />
          <View style={styles.cancelledModalCard}>
            <Icon
              name="information-circle-outline"
              size={44}
              color={STATUS_THEME[statusKey]?.dot ?? COLOR.BRAND_COLOR}
            />
            <Text style={styles.cancelledModalTitle}>
              {STATUS_THEME[statusKey]?.label ?? 'Order status'}
            </Text>
            <Text style={styles.cancelledModalBody}>
              {statusKey === 'payment_received'
                ? "Payment was received. The vendor still needs to accept this order before fulfillment can begin."
                : statusKey === 'order_delivered' && auth.activeRole === 'vendor'
                  ? 'This order has been delivered. Waiting for the customer to confirm they received it. Escrow will release funds after confirmation.'
                  : statusKey === 'order_confirmed'
                    ? auth.activeRole === 'vendor'
                      ? 'The customer confirmed delivery. Your payout is being processed and should arrive within 24 hours.'
                      : 'You confirmed delivery. Escrow will release the funds to the vendor shortly.'
                    : `${actionBtn()}. No action is available for you at this step — the current status is "${STATUS_THEME[statusKey]?.label ?? statusKey}".`}
            </Text>
            <Pressable
              onPress={() => setStatusInfoOpen(false)}
              style={({ pressed }) => [
                styles.cancelledModalBtn,
                pressed && styles.btnPrimaryPressed,
                {
                  backgroundColor:
                    STATUS_THEME[statusKey]?.dot ?? COLOR.BRAND_COLOR,
                },
              ]}
            >
              <Text style={styles.cancelledModalBtnText}>OK</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLOR.NEUTRAL,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLOR.DARK,
    letterSpacing: -0.4,
  },
  headerDate: {
    fontSize: 13,
    color: COLOR.MUTED,
    paddingHorizontal: 16,
    marginTop: 4,
    marginBottom: 12,
  },
  headerDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E2E2E6',
    marginHorizontal: 0,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLOR.NEUTRAL,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E2E6',
  },
  pressed: {
    opacity: 0.85,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 8,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLOR.DARK,
    marginTop: 16,
    marginBottom: 10,
  },
  sectionHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    marginBottom: 10,
  },
  linkText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLOR.BRAND_COLOR,
  },
  linkArrow: {
    transform: [{ rotate: '45deg' }],
  },
  card: {
    backgroundColor: COLOR.NEUTRAL,
    borderRadius: 5,
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E8E8EC',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
      },
      android: { elevation: 1 },
    }),
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  pillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    // borderBottomWidth: StyleSheet.hairlineWidth,
    // borderBottomColor: COLOR.HAIR,
  },
  summaryRowLast: {
    borderBottomWidth: 0,
  },
  summaryIcon: {
    width: 22,
    marginRight: 8,
  },
  summaryLabel: {
    flex: 1,
    fontSize: 11,
    color: COLOR.TEXT,
  },
  summaryValue: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  summaryValueText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLOR.DARK,
    textTransform: 'capitalize',
  },
  escrowStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
    // borderBottomWidth: StyleSheet.hairlineWidth,
    // borderBottomColor: COLOR.HAIR,
  },
  escrowAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 12,
    paddingBottom: 2,
  },
  escrowAmountLabel: {
    fontSize: 13,
    color: COLOR.MUTED,
    fontWeight: '600',
  },
  escrowAmountValue: {
    fontSize: 15,
    fontWeight: '700',
    color: COLOR.DARK,
    flexShrink: 0,
  },
  escrowStatusLabel: {
    fontSize: 13,
    color: COLOR.TEXT,
    fontWeight: '600',
  },
  escrowCaption: {
    fontSize: 12,
    color: COLOR.MUTED,
    lineHeight: 17,
    marginTop: 6,
    marginBottom: 4,
  },
  escrowActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    marginBottom: 6,
  },
  escrowBtn: {
    flex: 1,
    height: 44,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  escrowBtnCancel: {
    borderColor: '#F2B8B5',
    backgroundColor: '#FFF8F7',
  },
  escrowBtnCancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#C62828',
  },
  escrowBtnSecondary: {
    borderColor: '#D6D6DC',
    backgroundColor: COLOR.NEUTRAL,
  },
  escrowBtnSecondaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLOR.TEXT,
  },
  cancelledBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 12,
    marginBottom: 6,
    padding: 12,
    borderRadius: 5,
    backgroundColor: '#FFF8F7',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#F2B8B5',
  },
  cancelledBannerText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: '#9F1818',
    fontWeight: '500',
  },
  cancelledModalRoot: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  cancelledModalCard: {
    backgroundColor: COLOR.NEUTRAL,
    borderRadius: 8,
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  cancelledModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLOR.DARK,
    marginTop: 4,
  },
  cancelledModalBody: {
    fontSize: 14,
    lineHeight: 21,
    color: COLOR.MUTED,
    textAlign: 'center',
  },
  cancelledModalReason: {
    fontSize: 13,
    lineHeight: 19,
    color: COLOR.TEXT,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  cancelledModalBtn: {
    marginTop: 8,
    width: '100%',
    height: 48,
    borderRadius: 5,
    backgroundColor: COLOR.BRAND_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelledModalBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLOR.NEUTRAL,
  },
  customerHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 12,
    marginBottom: 4,
    // borderBottomWidth: StyleSheet.hairlineWidth,
    // borderBottomColor: COLOR.HAIR,
  },
  customerTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    gap: 8,
  },
  headMessageBtn: {
    padding: 4,
    flexShrink: 0,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 5,
    backgroundColor: '#EAEAEE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#5C5C66',
  },
  customerNameCol: {
    flex: 1,
    minWidth: 0,
  },
  customerName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLOR.DARK,
  },
  customerEmail: {
    fontSize: 12,
    color: COLOR.MUTED,
    marginTop: 2,
  },
  headIcon: {
    width: 32,
    height: 32,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headIconDot: {
    position: 'absolute',
    top: 6,
    right: 7,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#E5484D',
    borderWidth: 1,
    borderColor: COLOR.NEUTRAL,
  },
  kvRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  kvRowAlignTop: {
    alignItems: 'flex-start',
  },
  kvLabel: {
    flex: 1,
    fontSize: 13,
    color: COLOR.MUTED,
  },
  kvValueWrap: {
    flex: 1.4,
    alignItems: 'flex-end',
  },
  kvValue: {
    flex: 1.4,
    fontSize: 13,
    fontWeight: '600',
    color: COLOR.TEXT,
    textAlign: 'right',
  },
  kvAddress: {
    lineHeight: 18,
  },
  shippingBlock: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLOR.HAIR,
  },
  shippingHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: COLOR.MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 6,
    marginBottom: 2,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    // borderBottomWidth: StyleSheet.hairlineWidth,
    // borderBottomColor: COLOR.HAIR,
  },
  itemRowLast: {
    borderBottomWidth: 0,
  },
  itemThumb: {
    width: 56,
    height: 56,
    borderRadius: 5,
    backgroundColor: '#F4F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  itemImg: {
    width: '100%',
    height: '100%',
  },
  itemBody: {
    flex: 1,
    minWidth: 0,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLOR.DARK,
  },
  itemVariant: {
    fontSize: 12,
    color: COLOR.MUTED,
    marginTop: 2,
  },
  itemRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  qtyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F4F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
  },
  qtyChipLabel: {
    fontSize: 11,
    color: COLOR.MUTED,
    fontWeight: '600',
  },
  qtyChipValue: {
    fontSize: 12,
    fontWeight: '700',
    color: COLOR.DARK,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: COLOR.DARK,
  },
  moneyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
  },
  moneyLabel: {
    fontSize: 13,
    color: COLOR.TEXT,
  },
  moneyLabelMuted: {
    color: COLOR.MUTED,
  },
  moneyValue: {
    fontSize: 13,
    fontWeight: '600',
    color: COLOR.TEXT,
  },
  moneyValueBold: {
    fontSize: 15,
    fontWeight: '800',
    color: COLOR.DARK,
  },
  moneyDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E2E2E6',
    marginVertical: 6,
  },
  tlRow: {
    flexDirection: 'row',
    minHeight: 56,
  },
  tlTrack: {
    width: 22,
    alignItems: 'center',
    marginRight: 10,
  },
  tlDot: {
    width: 22,
    height: 22,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  tlDotDone: {
    backgroundColor: '#0D8A4A',
  },
  tlDotPending: {
    backgroundColor: COLOR.NEUTRAL,
    borderWidth: 2,
    borderColor: '#D6D6DC',
  },
  tlLine: {
    width: 2,
    flex: 1,
    minHeight: 22,
    marginTop: 2,
    backgroundColor: '#E2E2E6',
  },
  tlLineDone: {
    backgroundColor: '#BFE6CD',
  },
  tlBody: {
    flex: 1,
    paddingBottom: 14,
  },
  tlHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  tlTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLOR.DARK,
    flexShrink: 1,
  },
  tlTitleMuted: {
    color: COLOR.MUTED,
    fontWeight: '600',
  },
  tlDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tlDate: {
    fontSize: 12,
    color: COLOR.MUTED,
  },
  tlSubtitle: {
    fontSize: 12,
    color: COLOR.MUTED,
    marginTop: 4,
  },
  actionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: COLOR.NEUTRAL,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E2E6',
  },
  btnGhost: {
    flex: 1,
    height: 44,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLOR.NEUTRAL,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D6D6DC',
  },
  btnGhostText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLOR.TEXT,
  },
  btnPrimary: {
    flex: 1.2,
    height: 44,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    // backgroundColor: "#000",
    // backgroundColor: COLOR.BRAND_COLOR,
  },
  btnPrimaryPressed: {
    backgroundColor: COLOR.BRAND_COLOR_LITE,
  },
  btnPrimaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLOR.NEUTRAL,
    includeFontPadding: false,
  },
  btnAccept: {
    flex: 1,
    height: 44,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0D8A4A',
  },
  btnAcceptPressed: {
    backgroundColor: '#0A6B3A',
  },
  btnAcceptText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLOR.NEUTRAL,
  },
  btnReject: {
    flex: 1,
    height: 44,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#C62828',
  },
  btnRejectPressed: {
    backgroundColor: '#A01A1A',
  },
  btnRejectText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLOR.NEUTRAL,
  },
  sheetRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheetDismiss: {
    flex: 1,
  },
  sheet: {
    backgroundColor: COLOR.NEUTRAL,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 5,
    backgroundColor: '#D6D6DC',
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLOR.MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    paddingHorizontal: 8,
    marginBottom: 6,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 5,
  },
  sheetRowPressed: {
    backgroundColor: '#F5F5F7',
  },
  sheetDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  sheetRowText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: COLOR.TEXT,
  },
  sheetRowIcon: {
    width: 22,
    textAlign: 'center',
  },
  sheetRowTextDestructive: {
    color: '#C62828',
  },
  sheetCloseRow: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 4,
  },
  sheetCloseText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLOR.MUTED,
  },
  headerBackButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginLeft: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerEllipsis: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginRight: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
