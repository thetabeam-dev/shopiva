import { useCallback, useEffect, useState } from 'react';
import { AppState, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { navigationRef } from '../navigation/root';
import { useProfile } from '../context/ProfileContext';
import { getVendorShippingCreateGate, resolvePrimaryShopId } from '../utils/vendorShippingGate';
import { WebView } from 'react-native-webview';

const GUIDE_URL =
  'https://app.trupeer.ai/embed/2W2wF19jJ/doc?app=69f9261c487f9d6e7dbfc075&embed=doc';
const SETUP_ROUTES = new Set(['profile-shop-info', 'shipping-zones', 'shipping-zone-edit']);

function currentRouteName() {
  if (!navigationRef.isReady()) return '';
  return navigationRef.getCurrentRoute()?.name || '';
}

export default function VendorShippingRequiredGate() {
  const { user } = useProfile();
  const userId = user?.id;
  const [blocked, setBlocked] = useState(false);
  const [shopId, setShopId] = useState(null);
  const [onSetup, setOnSetup] = useState(false);

  const refresh = useCallback(async () => {
    const uid = Number(userId);
    if (!Number.isFinite(uid) || uid <= 0) {
      setBlocked(false);
      return;
    }
    try {
      const sid = await resolvePrimaryShopId(uid);
      setShopId(sid);
      if (!sid) {
        setBlocked(false);
        return;
      }
      const gate = await getVendorShippingCreateGate(sid, uid);
      setBlocked(!gate.ready);
    } catch {
      setBlocked(false);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    const navSub = navigationRef.addListener('state', () => {
      setOnSetup(SETUP_ROUTES.has(currentRouteName()));
      void refresh();
    });
    return () => {
      appSub.remove();
      navSub();
    };
  }, [refresh]);

  const goToZones = () => {
    if (!navigationRef.isReady() || !shopId || !userId) return;
    navigationRef.navigate('home', {
      screen: 'Profile',
      params: {
        state: {
          index: 2,
          routes: [
            { name: 'Profile' },
            { name: 'profile-shop-info' },
            { name: 'shipping-zones', params: { shopId, userId, showTutorial: true } },
          ],
        },
      },
    });
  };

  return (
    <Modal visible={blocked && !onSetup} transparent animationType="fade" onRequestClose={() => { }}>
      <View style={styles.root}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Icon name="alert-circle" size={36} color="#B45309" />
          </View>
          <Text style={styles.title}>Set up shipping zones</Text>
          {/* <View style={styles.videoWrap}>
            <WebView
              source={{ uri: GUIDE_URL }}
              style={styles.video}
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              javaScriptEnabled
              domStorageEnabled
            />
          </View> */}
          <Text style={styles.body}>
            Add shipping zones and fees in Shop info before you can use the rest of the app. Buyers need those fees to place an order.
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={goToZones} activeOpacity={0.88}>
            <Text style={styles.primaryBtnText}>Set up shipping zones</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  videoWrap: {
    height: 180,
    borderRadius: 7,
    overflow: 'hidden',
    marginBottom: 14,
    backgroundColor: '#F3F4F6',
  },
  video: { flex: 1, backgroundColor: 'transparent' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 7,
    paddingHorizontal: 22,
    paddingVertical: 24,
  },
  iconWrap: { alignItems: 'center', marginBottom: 10 },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111111',
    textAlign: 'center',
    marginBottom: 10,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
  },
  primaryBtn: {
    backgroundColor: '#00926E',
    borderRadius: 7,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
