import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import PlaceLocationField from './PlaceLocationField';
import Icon from 'react-native-vector-icons/Ionicons';
import { useProfile } from '../context/ProfileContext';
import { fetchShopDetails, updateVendorShop } from '../api/shop';
import { resolvePrimaryShopId } from '../utils/vendorShippingGate';

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

function hasShopCoordinates(location) {
  const coords = location.coordinates && typeof location.coordinates === 'object' ? location.coordinates : location;
  const latitude = Number(coords.latitude ?? coords.lat);
  const longitude = Number(coords.longitude ?? coords.lng);
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
}

export default function VendorShopLocationGate() {
  const { user, refresh } = useProfile();
  const userId = user?.id;
  const [open, setOpen] = useState(false);
  const [shopId, setShopId] = useState(null);
  const [busy, setBusy] = useState(false);

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
      setOpen(!hasShopCoordinates(location));
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

  const savePlace = async (city, state, country, latitude, longitude) => {
    const uid = Number(userId);
    if (!shopId || !Number.isFinite(uid)) return;
    const shop = await fetchShopDetails(shopId, uid);
    const current = locationObject(shop.location ?? shop.Location);
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
        coordinates: { lat: latitude, lng: longitude },
        address: [city, state, country].filter(Boolean).join(', '),
      },
    });
    await refresh().catch(() => {});
    setOpen(false);
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.root}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Icon name="location-outline" size={36} color="#00926E" />
          </View>
          <Text style={styles.title}>Set your shop location</Text>
          <Text style={styles.body}>
            Buyers find your shop on the map. Use your current position, or type a place and choose a suggestion. A typed address without coordinates cannot be saved.
          </Text>
          <PlaceLocationField
            disabled={busy}
            onPlace={async (place) => {
              if (!place || busy) return;
              setBusy(true);
              try {
                await savePlace(place.city, place.state, place.country || 'Nigeria', place.latitude, place.longitude);
              } catch (error) {
                Alert.alert('Location', error?.message || 'Could not save your shop location.');
              } finally {
                setBusy(false);
              }
            }}
          />
          {busy ? <ActivityIndicator color="#00926E" style={{ marginTop: 16 }} /> : null}
          </View>
        </ScrollView>
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
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 48,
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
    marginBottom: 16,
  },
});
