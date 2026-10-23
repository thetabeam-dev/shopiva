import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useProfile } from '../context/ProfileContext';
import { fetchShopDetails, updateVendorShop } from '../api/shop';
import { resolvePrimaryShopId } from '../utils/vendorShippingGate';
import { reverseGeocodeToPlace } from '../utils/deviceLocation';
import { useLocationLookup } from '../hooks/useLocationLookup';

function locationObject(raw) {
  if (raw && typeof raw === 'object') return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      return {};
    }
  }
  return {};
}

function hasShopLocation(location) {
  const city = String(location.city ?? '').trim();
  const state = String(location.state ?? '').trim();
  return Boolean(city || state);
}

export default function VendorShopLocationGate() {
  const { user, refresh } = useProfile();
  const userId = user?.id;
  const [open, setOpen] = useState(false);
  const [shopId, setShopId] = useState(null);
  const [busy, setBusy] = useState(false);
  const { locate, locationOverlay } = useLocationLookup();

  const checkLocation = useCallback(async () => {
    const uid = Number(userId);
    if (!Number.isFinite(uid) || uid <= 0) {
      setOpen(false);
      return;
    }
    try {
      const sid = await resolvePrimaryShopId(uid);
      setShopId(sid);
      if (!sid) {
        setOpen(false);
        return;
      }
      const shop = await fetchShopDetails(sid, uid);
      const location = locationObject(shop.location ?? shop.Location);
      setOpen(!hasShopLocation(location));
    } catch {
      setOpen(false);
    }
  }, [userId]);

  useEffect(() => {
    void checkLocation();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void checkLocation();
    });
    return () => sub.remove();
  }, [checkLocation]);

  const onUseLocation = async () => {
    const uid = Number(userId);
    if (!shopId || !Number.isFinite(uid)) return;
    setBusy(true);
    try {
      const coords = await locate();
      if (!coords) return;
      const place = await reverseGeocodeToPlace(coords.latitude, coords.longitude);
      const shop = await fetchShopDetails(shopId, uid);
      const current = locationObject(shop.location ?? shop.Location);
      const city = place.city || String(current.city ?? '');
      const state = place.state || String(current.state ?? '');
      const country = place.country || String(current.country ?? '') || 'Nigeria';
      if (!city && !state) {
        Alert.alert('Location', 'We could not get your location. Enter your city and state manually.');
        return;
      }
      await updateVendorShop(shopId, uid, {
        name: shop.name,
        slug: shop.slug,
        description: shop.description ?? null,
        logo: shop.logo ?? null,
        banner: shop.banner ?? null,
        category: shop.category,
        tags: Array.isArray(shop.tags) ? shop.tags : [],
        contactEmail: shop.contactemail ?? shop.contactEmail ?? null,
        contactPhone: shop.contactphone ?? shop.contactPhone ?? null,
        vendorType: shop.vendortype ?? shop.vendorType ?? 'reseller',
        socialLinks: shop.sociallinks ?? shop.socialLinks ?? {},
        isActive: shop.isactive ?? shop.isActive ?? true,
        isVerified: shop.isverified ?? shop.isVerified ?? false,
        status: shop.status ?? 'pending_approval',
        verificationDocuments: shop.verificationdocuments ?? shop.verificationDocuments ?? {},
        location: {
          ...current,
          city,
          state,
          country,
          coordinates: { lat: coords.latitude, lng: coords.longitude },
          address: [city, state, country].filter(Boolean).join(', '),
        },
      });
      await refresh().catch(() => {});
      setOpen(false);
    } catch (error) {
      Alert.alert('Location', error?.message || 'Could not save your shop location.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => {}}>
      {locationOverlay}
      <View style={styles.root}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Icon name="location-outline" size={36} color="#00926E" />
          </View>
          <Text style={styles.title}>Set your shop location</Text>
          <Text style={styles.body}>
            Buyers use your shop location to find you. Use your current position to save the city and state now.
          </Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={onUseLocation}
            disabled={busy}
            activeOpacity={0.88}
          >
            {busy ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryBtnText}>Use my current location</Text>
            )}
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
    minHeight: 48,
    justifyContent: 'center',
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
