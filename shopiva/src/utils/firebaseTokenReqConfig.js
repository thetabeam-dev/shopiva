import messaging from '@react-native-firebase/messaging';
import { Alert, PermissionsAndroid, Platform } from 'react-native';
import { navigateToActivitiesScreen, navigationRef } from '../navigation/root';

/**
 * Wait until APNs has handed iOS a device token (required before a usable FCM token).
 * @param {number} [timeoutMs]
 * @returns {Promise<string|null>}
 */
async function waitForApnsToken(timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const apnsToken = await messaging().getAPNSToken();
    if (apnsToken) return apnsToken;
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function asString(value) {
  if (value == null) return '';
  return String(value).trim();
}

/**
 * @param {Record<string, unknown>} meta
 * @param {Record<string, unknown>} data
 */
function resolveNotificationTarget(meta, data) {
  const merged = { ...data, ...meta };
  const type = asString(
    merged.type || merged.entity || merged.kind || merged.activity_type,
  ).toLowerCase();

  const orderId = asString(
    merged.order_id ?? merged.orderId ?? merged.order?.id ?? merged.order?.order_id,
  );
  const disputeId = asString(
    merged.dispute_id ?? merged.disputeId ?? merged.dispute?.id,
  );
  const returnId = asString(
    merged.return_id ?? merged.returnId ?? merged.return?.id ?? merged.returnItem?.return_id,
  );
  const roomId = asString(
    merged.room_id ?? merged.roomId ?? merged.chat?.roomId ?? merged.chat?.id,
  );
  const roomName = asString(
    merged.room_name ?? merged.roomName ?? merged.chat?.name ?? merged.name,
  );

  if (
    type === 'message' ||
    type === 'chat' ||
    type === 'new_message' ||
    type === 'mssg'
  ) {
    return roomId
      ? { screen: 'Inbox', params: { chat: { roomId, name: roomName || 'Chat' } } }
      : null;
  }

  if (type === 'order' || type === 'orders') {
    return orderId
      ? {
        screen: 'Order-detail',
        params: {
          orderId,
          order: { id: Number(orderId) || orderId, order_id: Number(orderId) || orderId },
        },
      }
      : null;
  }

  if (type === 'dispute' || type === 'disputes') {
    return disputeId
      ? {
        screen: 'Dispute-detail',
        params: { disputeId, dispute: { id: Number(disputeId) || disputeId } },
      }
      : null;
  }

  if (type === 'return' || type === 'returns') {
    return returnId
      ? {
        screen: 'Return-detail',
        params: {
          returnId,
          returnItem: { return_id: Number(returnId) || returnId },
        },
      }
      : null;
  }

  // Infer from which id is present when type is omitted.
  if (roomId && !orderId && !disputeId && !returnId) {
    return {
      screen: 'Inbox',
      params: { chat: { roomId, name: roomName || 'Chat' } },
    };
  }
  if (disputeId) {
    return {
      screen: 'Dispute-detail',
      params: { disputeId, dispute: { id: Number(disputeId) || disputeId } },
    };
  }
  if (returnId) {
    return {
      screen: 'Return-detail',
      params: {
        returnId,
        returnItem: { return_id: Number(returnId) || returnId },
      },
    };
  }
  if (orderId) {
    return {
      screen: 'Order-detail',
      params: {
        orderId,
        order: { id: Number(orderId) || orderId, order_id: Number(orderId) || orderId },
      },
    };
  }

  // Explicit screen override (legacy)
  const screen = asString(meta.screen || meta.route);
  if (screen) {
    return {
      screen,
      params:
        meta.params && typeof meta.params === 'object'
          ? /** @type {Record<string, unknown>} */ (meta.params)
          : undefined,
    };
  }

  return null;
}

/**
 * @param {import('@react-native-firebase/messaging').FirebaseMessagingTypes.RemoteMessage | null | undefined} remoteMessage
 */
export function parseFcmMessage(remoteMessage) {
  const data =
    remoteMessage?.data && typeof remoteMessage.data === 'object'
      ? remoteMessage.data
      : {};

  let meta = data.meta;
  if (typeof meta === 'string') {
    try {
      meta = JSON.parse(meta);
    } catch {
      meta = {};
    }
  } else if (!meta || typeof meta !== 'object') {
    meta = {};
  }

  let media = data.media;
  if (typeof media === 'string') {
    try {
      media = JSON.parse(media);
    } catch {
      /* keep string */
    }
  }

  const title =
    remoteMessage?.notification?.title ||
    (typeof data.title === 'string' ? data.title : '') ||
    'Deedyte';
  const body =
    remoteMessage?.notification?.body ||
    (typeof data.body === 'string' ? data.body : '') ||
    '';

  return { title, body, data, meta, media };
}

/**
 * Retry until the root navigator is ready, then open the detail screen.
 * @param {{ screen: string; params?: Record<string, unknown> }} target
 */
function navigateWhenReady(target) {
  const tryNavigate = (attempt = 0) => {
    if (navigationRef.isReady()) {
      const ok = navigateToActivitiesScreen(target.screen, target.params);
      if (!ok && attempt < 20) {
        setTimeout(() => tryNavigate(attempt + 1), 250);
      }
      return;
    }
    if (attempt < 40) {
      setTimeout(() => tryNavigate(attempt + 1), 250);
    } else {
      console.warn('[fcm] navigation not ready; skipped', target.screen);
    }
  };
  setTimeout(() => tryNavigate(), 400);
}

/**
 * Handle tap / open from a notification (background, quit, or foreground Alert).
 * @param {import('@react-native-firebase/messaging').FirebaseMessagingTypes.RemoteMessage | null | undefined} remoteMessage
 */
export function handleNotificationOpen(remoteMessage) {
  if (!remoteMessage) return;
  const parsed = parseFcmMessage(remoteMessage);
  console.log('[fcm] notification opened:', parsed);

  const target = resolveNotificationTarget(
    /** @type {Record<string, unknown>} */(parsed.meta),
    /** @type {Record<string, unknown>} */(parsed.data),
  );

  if (!target?.screen) {
    console.warn('[fcm] no navigation target in notification payload');
    return;
  }

  navigateWhenReady(target);
}

/**
 * Foreground message — show Alert; Open uses the same deep-link handler.
 * @param {import('@react-native-firebase/messaging').FirebaseMessagingTypes.RemoteMessage} remoteMessage
 */
export function handleForegroundMessage(remoteMessage) {
  const parsed = parseFcmMessage(remoteMessage);
  console.log('[fcm] foreground message:', parsed);

  if (!parsed.title && !parsed.body) return;

  Alert.alert(parsed.title || 'Deedyte', parsed.body || '', [
    { text: 'Dismiss', style: 'cancel' },
    {
      text: 'Open',
      onPress: () => handleNotificationOpen(remoteMessage),
    },
  ]);
}

/**
 * Register all in-app FCM listeners. Call once from App root.
 * @returns {() => void} unsubscribe
 */
export function setupFcmListeners() {
  const unsubOnMessage = messaging().onMessage(async (remoteMessage) => {
    handleForegroundMessage(remoteMessage);
  });

  const unsubOpened = messaging().onNotificationOpenedApp((remoteMessage) => {
    handleNotificationOpen(remoteMessage);
  });

  messaging()
    .getInitialNotification()
    .then((remoteMessage) => {
      if (remoteMessage) {
        handleNotificationOpen(remoteMessage);
      }
    })
    .catch((e) => {
      console.warn('[fcm] getInitialNotification failed:', e);
    });

  const unsubTokenRefresh = messaging().onTokenRefresh((token) => {
    console.log('[fcm] token refreshed:', token);
  });

  return () => {
    unsubOnMessage();
    unsubOpened();
    unsubTokenRefresh();
  };
}

/**
 * Must be registered early in index.js (outside React tree).
 */
export function registerFcmBackgroundHandler() {
  messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    console.log('[fcm] background message:', parseFcmMessage(remoteMessage));
  });
}

export async function requestPermission() {
  try {
    const authStatus = await messaging().requestPermission();

    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (!enabled) {
      console.warn('[fcm] notification permission not granted:', authStatus);
      return null;
    }

    if (Platform.OS === 'ios') {
      const apnsToken = await waitForApnsToken();
      console.log('APNs Token:', apnsToken);
      if (!apnsToken) {
        console.warn(
          '[fcm] No APNs token yet. Use a real device, enable Push Notifications capability, and confirm Bundle ID matches Firebase (com.thetabeam.deedyte).',
        );
        return null;
      }
    }

    const fcmToken = await messaging().getToken();
    console.log('FCM Token:', fcmToken);
    return fcmToken;
  } catch (error) {
    console.warn(
      '[fcm] permission/token setup failed:',
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}

export async function requestAndroidPermission() {
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    const status = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );

    if (status !== PermissionsAndroid.RESULTS.GRANTED) {
      console.warn('[fcm] POST_NOTIFICATIONS permission was not granted:', status);
      return false;
    }
  }

  return true;
}

export async function getFcmToken() {
  if (Platform.OS === 'ios') {
    const apnsToken = await messaging().getAPNSToken();
    if (!apnsToken) {
      console.warn('[fcm] getFcmToken called before APNs token is available');
      return null;
    }
  }
  try {
    const token = await messaging().getToken();
    console.log('FCM Token:', token);
    return token;
  } catch (error) {
    console.warn(
      '[fcm] getFcmToken failed:',
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}
